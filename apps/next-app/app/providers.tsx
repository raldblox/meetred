'use client'

import type { ThemeProviderProps } from 'next-themes'

import * as React from 'react'
import { HeroUIProvider } from '@heroui/system'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useRouter } from 'next/navigation'

import { Libp2pProvider } from '@/context/libp2p-ctx'
import { CreateSessionProvider } from '@/context/create-session-ctx'
import { CreateSessionModal } from '@/components/ui/create-session-modal'

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
          <CreateSessionProvider>
            {children}
            <CreateSessionModal />
          </CreateSessionProvider>
        </Libp2pProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  )
}
