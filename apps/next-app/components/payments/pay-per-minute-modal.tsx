'use client'

import type { PayPerMinuteConfig, PaymentConnection } from '@/lib/payments'
import type { PayPerMinuteStatus } from '@/hooks/usePayPerMinute'

import { Button, Chip, Input, Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react'

interface PayPerMinuteModalProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  config: PayPerMinuteConfig
  status: PayPerMinuteStatus
  statusLabel: string
  connection: PaymentConnection | null
  formattedAmount: string
  formattedRate: string
  rateAccepted: boolean
  rateAvailable: boolean
  requiresRateAcceptance: boolean
  onAcceptRate: () => void
  onConnectCoinbase: () => void
  onConnectWallet: () => void
  onRequestApproval: () => void
  onReset: () => void
  mode?: 'host' | 'viewer'
  payoutAddress?: string
  onPayoutAddressChange?: (value: string) => void
}

const statusColorMap: Record<PayPerMinuteStatus, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
  disconnected: 'default',
  connected: 'primary',
  authorizing: 'warning',
  checking: 'warning',
  ready: 'success',
  paused: 'warning',
  error: 'danger',
}

const connectionLabelMap: Record<PaymentConnection, string> = {
  coinbase: 'Coinbase Pay',
  wallet: 'Wallet signature',
}

export function PayPerMinuteModal({
  isOpen,
  onOpenChange,
  config,
  status,
  statusLabel,
  connection,
  formattedAmount,
  formattedRate,
  rateAccepted,
  rateAvailable,
  requiresRateAcceptance,
  onAcceptRate,
  onConnectCoinbase,
  onConnectWallet,
  onRequestApproval,
  onReset,
  mode = 'viewer',
  payoutAddress = '',
  onPayoutAddressChange,
}: PayPerMinuteModalProps) {
  const connectionReady = status !== 'disconnected' && status !== 'error'
  const approvalReady = status === 'authorizing' || status === 'checking' || status === 'ready'
  const balanceReady = status === 'checking' || status === 'ready'

  const approvalActive = status === 'authorizing'
  const balanceActive = status === 'checking'

  const connectionLabel = connection ? connectionLabelMap[connection] : 'Not connected'

  return (
    <Modal
      aria-labelledby="pay-per-minute-modal"
      hideCloseButton={false}
      isOpen={isOpen}
      placement="center"
      size="md"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col items-start gap-1">
              <p className="text-[11px] uppercase tracking-[0.3em] text-default-400">Paid minutes</p>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-default-900">Session payment</h2>
                <Chip className="capitalize" color={statusColorMap[status]} size="sm" variant="flat">
                  {statusLabel}
                </Chip>
              </div>
              <p className="text-xs text-default-500">
                {rateAvailable ? formattedRate : 'Rate pending'} on {config.network} via {config.provider} (
                {config.rail}).
              </p>
            </ModalHeader>
            <ModalBody className="pb-6 pt-0 space-y-4">
              {mode === 'viewer' ? (
                <div className="grid gap-2 rounded-xl border border-default-100 bg-default-50 p-3 text-xs text-default-600">
                  <div className="flex items-center justify-between">
                    <span>Paid so far</span>
                    <span className="font-mono text-default-900">{formattedAmount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Connection</span>
                    <span>{connectionLabel}</span>
                  </div>
                </div>
              ) : null}

              {mode === 'viewer' ? (
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-default-500">Status checks</p>
                  <div className="grid gap-2">
                    {requiresRateAcceptance ? (
                      <div className="flex items-center justify-between rounded-lg border border-default-100 bg-white/60 px-3 py-2 text-xs">
                        <span>0. Accept the rate</span>
                        <Chip color={rateAccepted ? 'success' : 'default'} size="sm" variant="flat">
                          {rateAccepted ? 'Accepted' : 'Pending'}
                        </Chip>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between rounded-lg border border-default-100 bg-white/60 px-3 py-2 text-xs">
                      <span>1. Connection</span>
                      <Chip color={connectionReady ? 'success' : 'default'} size="sm" variant="flat">
                        {connectionReady ? 'Connected' : 'Pending'}
                      </Chip>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-default-100 bg-white/60 px-3 py-2 text-xs">
                      <span>2. Signature approval</span>
                      <Chip
                        color={approvalActive ? 'warning' : approvalReady ? 'success' : 'default'}
                        size="sm"
                        variant="flat"
                      >
                        {approvalActive ? 'Awaiting' : approvalReady ? 'Approved' : 'Locked'}
                      </Chip>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-default-100 bg-white/60 px-3 py-2 text-xs">
                      <span>3. Balance check</span>
                      <Chip
                        color={balanceActive ? 'warning' : balanceReady ? 'success' : 'default'}
                        size="sm"
                        variant="flat"
                      >
                        {balanceActive ? 'Checking' : balanceReady ? 'Cleared' : 'Locked'}
                      </Chip>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-default-500">Payout address</p>
                  <Input
                    aria-label="Payout address"
                    className="w-full"
                    placeholder="0x... or wallet address"
                    size="sm"
                    value={payoutAddress}
                    onChange={(event) => onPayoutAddressChange?.(event.target.value)}
                  />
                  <p className="text-[11px] text-default-500">This is where received funds will land.</p>
                </div>
              )}

              {mode === 'viewer' && status === 'disconnected' ? (
                <div className="space-y-3">
                  {requiresRateAcceptance && !rateAccepted ? (
                    <Button
                      color="primary"
                      isDisabled={!rateAvailable}
                      radius="sm"
                      variant="solid"
                      onPress={onAcceptRate}
                    >
                      {rateAvailable ? `Accept ${formattedRate}` : 'Waiting for host rate'}
                    </Button>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      color="primary"
                      isDisabled={requiresRateAcceptance && !rateAccepted}
                      radius="sm"
                      variant="solid"
                      onPress={onConnectCoinbase}
                    >
                      Coinbase Pay (no wallet)
                    </Button>
                    <Button
                      color="secondary"
                      isDisabled={requiresRateAcceptance && !rateAccepted}
                      radius="sm"
                      variant="bordered"
                      onPress={onConnectWallet}
                    >
                      Wallet signature
                    </Button>
                  </div>
                  <div className="rounded-xl border border-dashed border-default-200 p-3 text-center text-[11px] uppercase tracking-[0.2em] text-default-500">
                    QR code placeholder
                  </div>
                </div>
              ) : null}

              {mode === 'viewer' && status === 'connected' ? (
                <Button color="success" radius="sm" variant="solid" onPress={onRequestApproval}>
                  Request approval to start
                </Button>
              ) : null}

              {mode === 'viewer' && status === 'authorizing' ? (
                <Button isDisabled color="warning" radius="sm" variant="flat">
                  Awaiting signature confirmation...
                </Button>
              ) : null}

              {mode === 'viewer' && status === 'checking' ? (
                <Button isDisabled color="warning" radius="sm" variant="flat">
                  Checking balance on Base...
                </Button>
              ) : null}

              {mode === 'viewer' && status === 'ready' ? (
                <div className="flex items-center justify-between rounded-xl border border-success-200 bg-success-50/40 p-3 text-xs text-success-800">
                  <span>Payment active. Timer is now billing.</span>
                  <Button color="success" size="sm" variant="bordered" onPress={onReset}>
                    Reset
                  </Button>
                </div>
              ) : null}
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
