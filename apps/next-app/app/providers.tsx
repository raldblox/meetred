'use client'

import type { ThemeProviderProps } from 'next-themes'

import * as React from 'react'
import { HeroUIProvider } from '@heroui/system'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { ChatProvider } from '@/context/chat-ctx'
import { Libp2pProvider } from '@/context/libp2p-ctx'
import { useRouter } from 'next/navigation'

export interface ProvidersProps {
  children: React.ReactNode
  themeProps?: ThemeProviderProps
}

declare module '@react-types/shared' {
  interface RouterConfig {
    routerOptions: NonNullable<Parameters<ReturnType<typeof useRouter>['push']>[1]>
  }
}

export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter()

  return (
    <HeroUIProvider navigate={router.push}>
      <NextThemesProvider {...themeProps}>
        <Libp2pProvider>
          <ChatProvider>{children}</ChatProvider>
        </Libp2pProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  )
}
