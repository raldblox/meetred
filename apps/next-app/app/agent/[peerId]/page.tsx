import { AgentRoom } from '@/components/agent/agent-room'
import { AgentProvider } from '@/context/agent-ctx'

export default async function AgentPage({ params }: { params: Promise<{ peerId: string }> }) {
  const { peerId } = await params

  if (!peerId) {
    return <div>Peer ID is required</div>
  }

  return (
    <AgentProvider hostPeerId={peerId}>
      <AgentRoom peerId={peerId} />
    </AgentProvider>
  )
}
