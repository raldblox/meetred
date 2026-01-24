import { MetricsDashboard } from './metrics-dashboard'

import Grid from '@/components/grid'

export const metadata = {
  title: 'Metrics',
}

export default function MetricsPage() {
  return (
    <Grid
      main={
        <div className="w-full mx-auto gap-6 h-full min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-6">
          <div className="hidden rounded-sm h-full lg:block" />
          <main className="col-span-1 lg:col-span-4 min-h-0 h-full overflow-hidden">
            <MetricsDashboard />
          </main>
          <div className="hidden rounded-sm h-full lg:block" />
        </div>
      }
    />
  )
}
