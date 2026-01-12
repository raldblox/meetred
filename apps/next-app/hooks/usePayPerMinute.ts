'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { PayPerMinuteConfig, PaymentConnection } from '@/lib/payments'

export type PayPerMinuteStatus =
  | 'disconnected'
  | 'connected'
  | 'authorizing'
  | 'checking'
  | 'ready'
  | 'paused'
  | 'error'

interface UsePayPerMinuteOptions {
  config: PayPerMinuteConfig
  elapsedMs: number
  sessionActive: boolean
  ratePerMinute?: number | null
  requireRateAcceptance?: boolean
  autoPrompt?: boolean
}

const statusLabels: Record<PayPerMinuteStatus, string> = {
  disconnected: 'Not connected',
  connected: 'Connected',
  authorizing: 'Awaiting signature',
  checking: 'Checking balance',
  ready: 'Payment active',
  paused: 'Paused',
  error: 'Needs attention',
}

export function usePayPerMinute({
  config,
  elapsedMs,
  sessionActive,
  ratePerMinute,
  requireRateAcceptance = false,
  autoPrompt = false,
}: UsePayPerMinuteOptions) {
  const [status, setStatus] = useState<PayPerMinuteStatus>('disconnected')
  const [connection, setConnection] = useState<PaymentConnection | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [rateAccepted, setRateAccepted] = useState(!requireRateAcceptance)
  const [payoutAddress, setPayoutAddress] = useState('')
  const autoPromptedRef = useRef(false)
  const transitionRef = useRef<NodeJS.Timeout | null>(null)
  const lastReadyRef = useRef(false)
  const lastRateRef = useRef<number | null>(null)

  const clearTransition = () => {
    if (transitionRef.current) {
      clearTimeout(transitionRef.current)
      transitionRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      clearTransition()
    }
  }, [])

  useEffect(() => {
    if (status === 'ready') {
      lastReadyRef.current = true
    }
  }, [status])

  const effectiveRate = typeof ratePerMinute === 'number' ? ratePerMinute : config.ratePerMinute
  const isFree = effectiveRate === 0
  const requiresAcceptance = requireRateAcceptance && !isFree

  useEffect(() => {
    if (!requiresAcceptance || isFree) {
      setRateAccepted(true)
    }
  }, [isFree, requiresAcceptance])

  useEffect(() => {
    if (typeof ratePerMinute !== 'number') {
      if (requiresAcceptance) {
        setRateAccepted(false)
        setStatus('disconnected')
        setConnection(null)
        lastReadyRef.current = false
      }
      return
    }

    if (lastRateRef.current === null) {
      lastRateRef.current = ratePerMinute
      return
    }

    if (lastRateRef.current !== ratePerMinute) {
      lastRateRef.current = ratePerMinute
      if (requiresAcceptance) {
        setRateAccepted(false)
        setStatus('disconnected')
        setConnection(null)
        lastReadyRef.current = false
      }
    }
  }, [ratePerMinute, requiresAcceptance])

  useEffect(() => {
    clearTransition()

    if (status === 'authorizing') {
      transitionRef.current = setTimeout(() => {
        setStatus('checking')
      }, 900)
    }

    if (status === 'checking') {
      transitionRef.current = setTimeout(() => {
        setStatus('ready')
      }, 1200)
    }
  }, [status])

  useEffect(() => {
    if (!autoPrompt) {
      return
    }

    if (isFree) {
      return
    }

    if (sessionActive && status !== 'ready' && !autoPromptedRef.current) {
      setModalOpen(true)
      autoPromptedRef.current = true
    }

    if (!sessionActive) {
      autoPromptedRef.current = false
    }
  }, [autoPrompt, isFree, sessionActive, status])

  const formatCurrency = useCallback(
    (value: number) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: config.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value),
    [config.currency],
  )

  const paidAmount = useMemo(() => Math.max(0, (elapsedMs / 60000) * effectiveRate), [elapsedMs, effectiveRate])
  const formattedAmount = useMemo(() => formatCurrency(paidAmount), [formatCurrency, paidAmount])
  const formattedRate = useMemo(() => `${formatCurrency(effectiveRate)}/min`, [effectiveRate, formatCurrency])
  const rateAvailable = typeof ratePerMinute === 'number'

  const isReady = isFree || status === 'ready'
  const isConnected = isFree ? true : status !== 'disconnected' && status !== 'error'
  const statusLabel = isFree ? 'Free access' : statusLabels[status]

  const connectCoinbase = useCallback(() => {
    if (requiresAcceptance && !rateAccepted) {
      return
    }
    setConnection('coinbase')
    setStatus('connected')
  }, [rateAccepted, requiresAcceptance])

  const connectWallet = useCallback(() => {
    if (requiresAcceptance && !rateAccepted) {
      return
    }
    setConnection('wallet')
    setStatus('connected')
  }, [rateAccepted, requiresAcceptance])

  const requestApproval = useCallback(() => {
    if (status === 'connected') {
      setStatus('authorizing')
    }
  }, [status])

  const reset = useCallback(() => {
    clearTransition()
    setStatus('disconnected')
    setConnection(null)
    setRateAccepted(!requiresAcceptance)
    lastReadyRef.current = false
  }, [requiresAcceptance])

  const pause = useCallback(() => {
    clearTransition()
    setStatus('paused')
  }, [])

  const resume = useCallback(() => {
    if (requiresAcceptance && !rateAccepted) {
      return
    }

    if (isFree) {
      setStatus('ready')
      return
    }

    if (lastReadyRef.current) {
      setStatus('ready')
      return
    }

    if (connection) {
      setStatus('connected')
      return
    }

    setStatus('disconnected')
  }, [connection, isFree, rateAccepted, requiresAcceptance])

  const acceptRate = useCallback(() => {
    if (typeof ratePerMinute !== 'number') {
      return
    }

    setRateAccepted(true)
  }, [ratePerMinute])

  const openModal = useCallback(() => setModalOpen(true), [])
  const closeModal = useCallback(() => setModalOpen(false), [])

  const badgeLabel = useMemo(() => {
    if (status === 'ready') {
      return formattedAmount
    }
    if (isFree) {
      return 'FREE'
    }
    if (status === 'paused') {
      return 'Paused'
    }
    if (status === 'connected') {
      return 'Approve to start'
    }
    if (status === 'authorizing') {
      return 'Awaiting signature'
    }
    if (status === 'checking') {
      return 'Balance check'
    }
    if (status === 'error') {
      return 'Resolve payment'
    }
    return 'Connect to start'
  }, [formattedAmount, status])

  return {
    config,
    status,
    statusLabel,
    connection,
    isReady,
    isFree,
    isConnected,
    paidAmount,
    formattedAmount,
    formattedRate,
    badgeLabel,
    modalOpen,
    openModal,
    closeModal,
    connectCoinbase,
    connectWallet,
    requestApproval,
    reset,
    pause,
    resume,
    rateAccepted,
    acceptRate,
    effectiveRate,
    rateAvailable,
    payoutAddress,
    setPayoutAddress,
  }
}
