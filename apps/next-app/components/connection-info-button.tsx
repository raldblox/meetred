import { ServerIcon } from '@heroicons/react/24/outline'
import { Button } from '@heroui/react'
import React from 'react'

interface ConnectionInfoButtonProps {
  onClick: () => void
}

export default function ConnectionInfoButton({ onClick }: ConnectionInfoButtonProps) {
  return (
    <Button
      radius="sm"
      variant="flat"
      className="text-xs h-7"
      color="default"
      size="sm"
      startContent={<ServerIcon className="h-4 w-4" />}
      onPress={onClick}
    >
      Network
    </Button>
  )
}
