import type { PayPerMinuteConfig } from '@/lib/payments'

const BASE_X402: Omit<PayPerMinuteConfig, 'ratePerMinute' | 'currency'> = {
  network: 'base',
  provider: 'coinbase',
  rail: 'x402',
}

export const PAY_PER_MINUTE_CONFIG: Record<'stream' | 'call' | 'agent', PayPerMinuteConfig> = {
  stream: {
    ...BASE_X402,
    ratePerMinute: 0,
    currency: 'USD',
  },
  call: {
    ...BASE_X402,
    ratePerMinute: 0,
    currency: 'USD',
  },
  agent: {
    ...BASE_X402,
    ratePerMinute: 0,
    currency: 'USD',
  },
}
