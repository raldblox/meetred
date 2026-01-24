const path = require('node:path')

const METRICS_KEY_PATH = path.join(__dirname, 'metrics.key')

const metricsPort = process.env.LIBP2P_METRICS_PORT ?? '15014'
const metricsServerPort = process.env.LIBP2P_METRICS_HTTP_PORT ?? process.env.LIBP2P_METRICS_METRICS_PORT ?? '15015'

const { createMetricsNode } = require('./metrics-node')

let instancePromise

async function startMetricsNode() {
  if (!instancePromise) {
    instancePromise = createMetricsNode({
      port: metricsPort,
      keyPath: METRICS_KEY_PATH,
      metricsPort: metricsServerPort,
    }).catch((error) => {
      instancePromise = undefined
      throw error
    })
  }

  const instance = await instancePromise

  if (instance?.metricsHttpPort) {
    const host = instance.metricsHttpHost && instance.metricsHttpHost !== '0.0.0.0' ? instance.metricsHttpHost : '127.0.0.1'
    const url = `http://${host}:${instance.metricsHttpPort}/metrics`
    if (!process.env.LIBP2P_METRICS_HTTP_URL) {
      process.env.LIBP2P_METRICS_HTTP_URL = url
    }
    if (!process.env.NEXT_PUBLIC_LIBP2P_METRICS_HTTP_URL) {
      process.env.NEXT_PUBLIC_LIBP2P_METRICS_HTTP_URL = url
    }
  }

  return instance
}

async function stopMetricsNode() {
  if (!instancePromise) {
    return
  }

  try {
    const instance = await instancePromise
    if (instance?.metricsServer) {
      await new Promise((resolve) => instance.metricsServer.close(resolve))
    }
    if (instance?.onlineInterval) {
      clearInterval(instance.onlineInterval)
    }
    if (instance?.node) {
      await instance.node.stop()
    }
  } finally {
    instancePromise = undefined
  }
}

if (require.main === module) {
  startMetricsNode()
    .then((instance) => {
      if (!instance) {
        console.warn('[metrics] skipped starting metrics node')
        return
      }

      const shutdown = async () => {
        await stopMetricsNode()
        process.exit(0)
      }

      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
    })
    .catch((error) => {
      console.error('failed to start metrics node', error)
      process.exit(1)
    })
}

module.exports = {
  startMetricsNode,
  stopMetricsNode,
}
