import { AgentRoom } from '@/components/agent/agent-room'
import { AgentProvider } from '@/context/agent-ctx'

export default async function AgentPage({ params }: { params: Promise<{ peerId: string }> }) {
  const { peerId } = await params

  if (!peerId) {
    return <div>Peer ID is required</div>
  }

  return (
    <AgentProvider hostPeerId={peerId}>
      <div className="relative text-foreground bg-background flex flex-col min-h-screen h-screen overflow-hidden">
        <main className="px-6 bg-background border-default-100 w-full flex flex-col flex-grow min-h-0 overflow-hidden">
          <AgentRoom peerId={peerId} />
        </main>

        <footer className="w-full border-primary !px-6 py-3 bg-background flex items-center justify-between shrink-0">
          <div className="text-xs">Meetred</div>
        </footer>
      </div>
    </AgentProvider>
  )
}
