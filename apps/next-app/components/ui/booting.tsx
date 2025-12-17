import Image from 'next/image'
import React from 'react'
import { Logo } from './icons'

interface Props {
  error?: string
}

export function Booting({ error }: Props) {
  return (
    <div className="grid h-screen place-items-center">
      <div className="text-center flex-col flex items-center justify-center">
        <Logo size={36} className="animate-pulse" />
        {error && error !== '' && (
          <p className="text-xs text-center max-w-lg text-danger break-all whitespace-pre-wrap">{error}</p>
        )}
        {error && error === '' && <p className="text-xs text-default-900">Unknown error</p>}
      </div>
    </div>
  )
}
