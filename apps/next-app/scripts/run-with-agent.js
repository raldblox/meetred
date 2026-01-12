const { spawn } = require('node:child_process')
const path = require('node:path')

const { startLocalModelAgent, stopLocalModelAgent } = require('../local-agent/server')
const { startLocalRelay, stopLocalRelay } = require('../local-agent/relay')

const mode = process.argv[2] === 'start' ? 'start' : 'dev'
const nextArgs =
  mode === 'start'
    ? ['start']
    : ['dev', '--turbopack', ...(process.argv.includes('--no-https') ? [] : ['--experimental-https'])]

const nextBin = require.resolve('next/dist/bin/next')

async function main() {
  try {
    const instance = await startLocalModelAgent()

    if (instance) {
      const address = instance.server.address()
      console.log(`[lm-agent] proxy listening on http://${address?.address ?? '127.0.0.1'}:${address?.port ?? '4312'}`)
    } else {
      console.warn('[lm-agent] skipped starting proxy (likely running on Vercel/serverless)')
    }
  } catch (error) {
    console.error('[lm-agent] failed to boot', error)
    process.exit(1)
    return
  }

  try {
    const relay = await startLocalRelay()

    if (relay) {
      const listenAddrs = relay.getMultiaddrs().map((addr) => addr.toString())
      console.log(`[local-relay] listening on ${listenAddrs.join(', ')}`)
    } else {
      console.warn('[local-relay] skipped starting relay')
    }
  } catch (error) {
    console.error('[local-relay] failed to boot', error)
    process.exit(1)
    return
  }

  const child = spawn(process.execPath, [nextBin, ...nextArgs], {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(__dirname, '..'),
  })

  const shutdown = async () => {
    await stopLocalModelAgent()
    await stopLocalRelay()

    if (child.killed) {
      return
    }

    child.kill('SIGTERM')
  }

  process.on('SIGINT', () => {
    shutdown().finally(() => {
      process.exit(0)
    })
  })

  process.on('SIGTERM', () => {
    shutdown().finally(() => {
      process.exit(0)
    })
  })

  child.on('exit', async (code, signal) => {
    await stopLocalModelAgent()
    await stopLocalRelay()

    if (signal) {
      process.kill(process.pid, signal)

      return
    }

    process.exit(code ?? 0)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
