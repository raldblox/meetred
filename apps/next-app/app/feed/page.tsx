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
      hideFooter={true}
      main={
        <div className="h-full w-full overflow-y-auto scroll-smooth isolate">
          <div className="w-full mx-auto gap-6 h-full min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-6">
            <div className="hidden rounded-sm h-full lg:block" />
            <main className="col-span-1 lg:col-span-4 min-h-0 h-full overflow-auto">
              <FeedRoom />
            </main>
            <div className="hidden rounded-sm h-full lg:block" />
          </div>
          <GradualBlurMemo
            curve="ease-in"
            divCount={5}
            exponential={true}
            height="5rem"
            opacity={1}
            position="bottom"
            strength={1}
            target="page"
          />
        </div>
      }
    />
  )
}
