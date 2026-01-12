'use client'

import { Button } from '@heroui/react'
import { Coins } from 'lucide-react'

interface PayPerMinuteChipProps {
  label: string
  onPress: () => void
  isReady: boolean
}

export function PayPerMinuteChip({ label, onPress, isReady }: PayPerMinuteChipProps) {
  return (
    <Button
      className="font-mono"
      color={isReady ? 'success' : 'default'}
      radius="full"
      size="sm"
      startContent={<Coins className="h-4 w-4" />}
      variant="flat"
      onPress={onPress}
    >
      {label}
    </Button>
  )
}
