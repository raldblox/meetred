export type PaymentNetwork = 'base'
export type PaymentProvider = 'coinbase'
export type PaymentRail = 'x402'
export type PaymentConnection = 'coinbase' | 'wallet'

export type PayPerMinuteConfig = {
  ratePerMinute: number
  currency: string
  network: PaymentNetwork
  provider: PaymentProvider
  rail: PaymentRail
}
