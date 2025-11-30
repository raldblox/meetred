import { StreamRoom } from '@/components/stream/stream-room'
import { StreamProvider } from '@/context/stream-ctx'

export default async function StreamPage({ params }: { params: Promise<{ streamId: string }> }) {
  const { streamId } = await params

  return (
    <StreamProvider streamId={streamId}>
      <StreamRoom streamId={streamId} />
    </StreamProvider>
  )
}
