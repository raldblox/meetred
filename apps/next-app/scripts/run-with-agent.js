const { spawn } = require('node:child_process')
const path = require('node:path')

const { startLocalModelAgent, stopLocalModelAgent } = require('../local-agent/server')
const { startLocalRelay, stopLocalRelay } = require('../local-agent/relay')
const { startArchivalNode, stopArchivalNode } = require('../local-agent/archival')
const { startMetricsNode, stopMetricsNode } = require('../local-agent/metrics')
const { createLogger } = require('../lib/table‑logger.ts')

const mode = process.argv[2] === 'start' ? 'start' : 'dev'
const nextArgs =
  mode === 'start'
    ? ['start']
    : ['dev', '--turbopack', ...(process.argv.includes('--no-https') ? [] : ['--experimental-https'])]

const nextBin = require.resolve('next/dist/bin/next')

async function main() {
  const log = createLogger()
  try {
    const instance = await startLocalModelAgent()

    if (instance) {
      const address = instance.server.address()
      log('[lm-agent]', `http://${address?.address ?? '127.0.0.1'}:${address?.port ?? '4312'}`)
    } else {
      console.warn('[lm-agent] skipped starting proxy (likely running on Vercel/serverless)')
    }
  } catch (error) {
    console.error('[lm-agent] failed to boot', error)
    process.exit(1)
    return
  }

  const allowLocalRelay = process.env.NEXT_PUBLIC_NODE_ENV === 'development' || process.env.NODE_ENV === 'development'

  if (allowLocalRelay) {
    // for local testing
    try {
      const relay = await startLocalRelay()

      if (relay) {
        const listenAddrs = relay.getMultiaddrs().map((addr) => addr.toString())
        log('[relay]', `${listenAddrs.join(', ')}`)
      } else {
        console.warn('[relay] skipped starting relay')
      }
    } catch (error) {
      console.error('[relay] failed to boot', error)
      process.exit(1)
      return
    }
  }

  // init archival/analytics node
  try {
    const archival = await startArchivalNode()

    if (archival?.node) {
      const listenAddrs = archival.node.getMultiaddrs().map((addr) => addr.toString())
      log('[archival]', `${listenAddrs.join(', ')}`)
    } else {
      console.warn('[archival] skipped starting archival node')
    }
  } catch (error) {
    console.error('[archival] failed to boot', error)
    process.exit(1)
    return
  }

  // init metrics node
  try {
    const metrics = await startMetricsNode()

    if (metrics?.node) {
      const listenAddrs = metrics.node.getMultiaddrs().map((addr) => addr.toString())
      log('[metrics]', `${listenAddrs.join(', ')}`)
    } else {
      console.warn('[metrics] skipped starting metrics node')
    }
  } catch (error) {
    console.error('[metrics] failed to boot', error)
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
    await stopArchivalNode()
    await stopMetricsNode()

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
    await stopArchivalNode()
    await stopMetricsNode()

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
