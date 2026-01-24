'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Navbar, NavbarContent } from '@heroui/navbar'
import { BarChart3, LayoutGrid, MessageCircle } from 'lucide-react'

import { Logo } from '@/components/ui/icons'

type Tab = {
  href: string
  label: string
  match: (pathname: string) => boolean
  icon: 'logo' | 'feed' | 'chat' | 'metrics'
}

const tabs: Tab[] = [
  {
    href: '/',
    label: 'Home',
    match: (pathname) => pathname === '/',
    icon: 'logo',
  },
  {
    href: '/feed',
    label: 'Feed',
    match: (pathname) => pathname.startsWith('/feed'),
    icon: 'feed',
  },
  {
    href: '/chat',
    label: 'Public room',
    match: (pathname) => pathname === '/chat' || pathname === '/',
    icon: 'chat',
  },
  {
    href: '/metrics',
    label: 'Metrics',
    match: (pathname) => pathname.startsWith('/metrics'),
    icon: 'metrics',
  },
]

const TabIcon = ({ icon }: { icon: Tab['icon'] }) => {
  if (icon === 'logo') {
    return <Logo className="text-white" size={18} />
  }
  if (icon === 'feed') {
    return <LayoutGrid className="h-4 w-4" />
  }
  if (icon === 'chat') {
    return <MessageCircle className="h-4 w-4" />
  }

  return <BarChart3 className="h-4 w-4" />
}

export function TopTabs() {
  const pathname = usePathname()

  return (
    <Navbar className="bg-transparent shadow-none" isBlurred={false} maxWidth="full" position="sticky">
      <NavbarContent justify="start">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
            {tabs.map((tab) => {
              const isActive = tab.match(pathname)

              return (
                <Link
                  key={tab.href}
                  aria-label={tab.label}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition ${
                    isActive
                      ? 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/40'
                      : 'text-white/70 hover:bg-white/10'
                  }`}
                  href={tab.href}
                  title={tab.label}
                >
                  <TabIcon icon={tab.icon} />
                </Link>
              )
            })}
          </div>
        </div>
      </NavbarContent>
    </Navbar>
  )
}
