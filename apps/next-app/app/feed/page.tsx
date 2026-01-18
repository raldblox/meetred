'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { NavbarContent, NavbarBrand, Navbar } from '@heroui/navbar'

import FeedRoom from '@/components/feed/feed-room'
import { Logo } from '@/components/ui/icons'
import GradualBlurMemo from '@/components/ui/gradual-blur'

export default function FeedPage() {
  useEffect(() => {
    document.body.classList.add('feed-scroll')
    document.documentElement.classList.add('feed-scroll')

    return () => {
      document.body.classList.remove('feed-scroll')
      document.documentElement.classList.remove('feed-scroll')
    }
  }, [])

  return (
    <div className="min-h-screen scroll-smooth isolate">
      <Navbar
        className="bg-transparent shadow-none"
        data-feed-navbar
        isBlurred={false}
        shouldHideOnScroll
        maxWidth="full"
      >
        <NavbarContent justify="start">
          <NavbarBrand>
            <Link
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-white/10 !mix-blend-difference"
              href="/"
            >
              <Logo className="text-white" size={20} />
            </Link>
          </NavbarBrand>
        </NavbarContent>
      </Navbar>
      <main className="max-w-6xl mx-auto">
        <FeedRoom />
      </main>

      <GradualBlurMemo
        target="page"
        position="bottom"
        height="5rem"
        strength={2}
        divCount={5}
        curve="bezier"
        exponential={true}
        opacity={1}
      />
    </div>
  )
}
