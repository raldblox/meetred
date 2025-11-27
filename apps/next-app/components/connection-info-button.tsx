import { ServerIcon } from 'lucide-react'
import { Button } from '@heroui/react'
import React from 'react'

interface ConnectionInfoButtonProps {
  onClick: () => void
}

export default function ConnectionInfoButton({ onClick }: ConnectionInfoButtonProps) {
  return (
    <Button
      isIconOnly
      className="text-xs h-7"
      color="default"
      radius="sm"
      size="sm"
      startContent={<ServerIcon className="h-4 w-4" />}
      variant="flat"
      onPress={onClick}
    />
  )
}
