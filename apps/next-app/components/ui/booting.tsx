import Image from 'next/image'
import React from 'react'

interface Props {
  error?: string
}

export function Booting({ error }: Props) {
  return (
    <div className="grid h-screen place-items-center">
      <div className="text-center flex-col flex items-center justify-center">
        <Image
          alt="metered logo"
          className={`text-foreground mx-auto mb-3 ${!error ? 'animate-pulse' : ''}`}
          height="64"
          src="/metered.svg"
          width="64"
        />

        {error && error !== '' && (
          <p className="text-xs text-center max-w-lg text-danger break-all whitespace-pre-wrap">{error}</p>
        )}
        {error && error === '' && <p className="text-xs text-default-900">Unknown error</p>}
      </div>
    </div>
  )
}
