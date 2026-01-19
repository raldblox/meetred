import type { Libp2pType } from '@/context/libp2p-ctx'

import { CHAT_TOPIC } from '@/config/constants'
import { encodeZeroWidth } from '@/lib/metered-envelope'

const ANALYTICS_WRAPPER = 'metered-analytics'
const ANALYTICS_APP_ID = 'metered'

export type AnalyticsEvent = {
  event: string
  timestamp?: number
  peerId?: string
  roomId?: string
  roomType?: string
  role?: 'host' | 'viewer'
  variant?: 'user' | 'model'
  provider?: string
  modelId?: string
  status?: 'pending' | 'complete' | 'error'
  minutes?: number
  isFree?: boolean
  ratePerMinute?: number
  channel?: 'public' | 'dm'
  props?: Record<string, unknown>
}

const encoder = new TextEncoder()

export async function publishAnalyticsEvent(libp2p: Libp2pType, event: AnalyticsEvent): Promise<void> {
  try {
    const payload = {
      type: ANALYTICS_WRAPPER,
      app: ANALYTICS_APP_ID,
      payload: {
        ...event,
        timestamp: event.timestamp ?? Date.now(),
        version: 1,
      },
    }

    const encoded = encodeZeroWidth(JSON.stringify(payload))

    await libp2p.services.pubsub.publish(CHAT_TOPIC, encoder.encode(encoded))
  } catch {
    // best-effort analytics
  }
}
