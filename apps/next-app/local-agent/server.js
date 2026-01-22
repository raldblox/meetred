const Fastify = require('fastify')
const cors = require('@fastify/cors')
const crypto = require('node:crypto')

const DEFAULT_TARGET = (process.env.LM_AGENT_TARGET ?? 'http://127.0.0.1:1234').trim() || 'http://127.0.0.1:1234'
const PORT = Number.parseInt(process.env.LM_AGENT_PORT ?? '4312', 10)
const HOST = (process.env.LM_AGENT_HOST ?? '127.0.0.1').trim() || '127.0.0.1'
const OPENAI_SECRET = crypto
  .createHash('sha256')
  .update(process.env.LM_AGENT_SECRET ?? 'meetred-local-agent')
  .digest()

let instancePromise
let encryptedOpenAIKey = null

const normalizeBaseUrl = (input) => {
  const trimmed = (input ?? DEFAULT_TARGET).trim()

  if (!trimmed) {
    return DEFAULT_TARGET
  }

  return trimmed.replace(/\/+$/, '')
}

const resolveTarget = (overrides = []) => {
  for (const override of overrides) {
    if (typeof override === 'string' && override.trim().length > 0) {
      return normalizeBaseUrl(override)
    }
  }

  return normalizeBaseUrl(DEFAULT_TARGET)
}

const encryptAPIKey = (plain) => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', OPENAI_SECRET, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    iv: iv.toString('base64'),
    content: encrypted.toString('base64'),
    tag: tag.toString('base64'),
  }
}

const decryptAPIKey = () => {
  if (!encryptedOpenAIKey) {
    return null
  }

  const iv = Buffer.from(encryptedOpenAIKey.iv, 'base64')
  const content = Buffer.from(encryptedOpenAIKey.content, 'base64')
  const tag = Buffer.from(encryptedOpenAIKey.tag, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', OPENAI_SECRET, iv)

  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([decipher.update(content), decipher.final()])

  return decrypted.toString('utf8')
}

const parseOpenAIError = async (response) => {
  let message = `OpenAI responded with ${response.status}`

  try {
    const payload = await response.json()

    if (payload?.error?.message) {
      message = payload.error.message
    }
  } catch {
    // ignore body parsing issues, fall back to generic message
  }

  return message
}

const createAgentServer = async () => {
  const fastify = Fastify({
    logger: {
      level: process.env.LM_AGENT_LOGGER ?? 'error',
    },
  })

  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  })

  fastify.get('/health', async (request, reply) => {
    const target = resolveTarget([request.query?.target])

    reply.send({
      ok: true,
      target,
      openAIConfigured: Boolean(encryptedOpenAIKey),
    })
  })

  fastify.get('/v1/models', async (request, reply) => {
    const target = resolveTarget([request.query?.target])

    try {
      const response = await fetch(`${target}/v1/models`, {
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        reply.status(response.status === 404 ? 404 : 502).send({ error: `LM Studio responded with ${response.status}` })

        return
      }

      const payload = await response.json()

      reply.send(payload)
    } catch (error) {
      reply.status(502).send({
        error: error?.message ?? 'Failed to reach LM Studio',
      })
    }
  })

  fastify.post('/v1/chat/completions', async (request, reply) => {
    const overrides = [
      typeof request.body?.baseUrl === 'string' ? request.body.baseUrl : undefined,
      typeof request.body?.target === 'string' ? request.body.target : undefined,
    ]
    const target = resolveTarget(overrides)
    const payload = request.body && typeof request.body === 'object' ? { ...request.body } : {}

    delete payload.baseUrl
    delete payload.target

    try {
      const response = await fetch(`${target}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        reply.status(response.status === 404 ? 404 : 502).send({
          error: `LM Studio responded with ${response.status}`,
        })

        return
      }

      const data = await response.json()

      reply.send(data)
    } catch (error) {
      reply.status(502).send({
        error: error?.message ?? 'Failed to reach LM Studio',
      })
    }
  })

  fastify.post('/openai/key', async (request, reply) => {
    const apiKey = typeof request.body?.apiKey === 'string' ? request.body.apiKey.trim() : ''

    if (!apiKey) {
      reply.status(400).send({ error: 'API key is required.' })

      return
    }

    encryptedOpenAIKey = encryptAPIKey(apiKey)

    reply.send({ ok: true })
  })

  fastify.get('/openai/models', async (_request, reply) => {
    const apiKey = decryptAPIKey()

    if (!apiKey) {
      reply.status(400).send({ error: 'OpenAI API key not configured.' })

      return
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorMessage = await parseOpenAIError(response)
        reply.status(response.status).send({ error: errorMessage })

        return
      }

      const payload = await response.json()

      reply.send(payload)
    } catch (error) {
      reply.status(502).send({ error: error?.message ?? 'Failed to reach OpenAI' })
    }
  })

  fastify.post('/openai/chat', async (request, reply) => {
    const apiKey = decryptAPIKey()

    if (!apiKey) {
      reply.status(400).send({ error: 'OpenAI API key not configured.' })

      return
    }

    const modelId = typeof request.body?.modelId === 'string' ? request.body.modelId : ''
    const prompt = typeof request.body?.prompt === 'string' ? request.body.prompt : ''
    const temperature =
      typeof request.body?.temperature === 'number' && Number.isFinite(request.body.temperature)
        ? request.body.temperature
        : 0.2
    const systemPrompt = typeof request.body?.systemPrompt === 'string' ? request.body.systemPrompt.trim() : ''

    if (!modelId || !prompt) {
      reply.status(400).send({ error: 'modelId and prompt are required' })

      return
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
          temperature,
        }),
      })

      if (!response.ok) {
        const errorMessage = await parseOpenAIError(response)
        reply.status(response.status).send({ error: errorMessage })

        return
      }

      const payload = await response.json()

      reply.send(payload)
    } catch (error) {
      reply.status(502).send({ error: error?.message ?? 'Failed to reach OpenAI' })
    }
  })

  await fastify.listen({ host: HOST, port: PORT })

  fastify.log.info(`local model agent listening on http://${HOST}:${PORT} -> ${DEFAULT_TARGET}`)

  return fastify
}

async function startLocalModelAgent() {
  if (!process.env.START_LM_AGENT && process.env.NODE_ENV === 'production' && process.env.VERCEL) {
    // prevent serverless environments from trying to open localhost listener
    return null
  }

  if (!instancePromise) {
    instancePromise = createAgentServer().catch((error) => {
      instancePromise = undefined
      throw error
    })
  }

  return instancePromise
}

async function stopLocalModelAgent() {
  if (!instancePromise) {
    return
  }

  try {
    const instance = await instancePromise

    if (instance) {
      await instance.close()
    }
  } catch {
    // ignore shutdown failures
  } finally {
    instancePromise = undefined
  }
}

module.exports = {
  startLocalModelAgent,
  stopLocalModelAgent,
}
