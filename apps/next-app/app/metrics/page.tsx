import { MetricsDashboard } from './metrics-dashboard'

import Grid from '@/components/grid'

export const metadata = {
  title: 'Metrics',
}

export default function MetricsPage() {
  return <Grid main={<MetricsDashboard />} />
}
