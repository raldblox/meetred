import { StreamRoom } from '@/components/stream/stream-room'

export default async function StreamPage({ params }: { params: Promise<{ streamId: string }> }) {
  const { streamId } = await params

  return <StreamRoom streamId={streamId} />
}
