'use client'

import { useEffect } from 'react'

import FeedRoom from '@/components/feed/feed-room'
import GradualBlurMemo from '@/components/ui/gradual-blur'
import Grid from '@/components/grid'

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
    <Grid
      main={
        <div className="h-full w-full overflow-y-auto scroll-smooth isolate">
          <main className="max-w-6xl mx-auto">
            <FeedRoom />
          </main>
          <GradualBlurMemo
            curve="bezier"
            divCount={5}
            exponential={true}
            height="5rem"
            opacity={1}
            position="bottom"
            strength={2}
            target="page"
          />
        </div>
      }
    />
  )
}
