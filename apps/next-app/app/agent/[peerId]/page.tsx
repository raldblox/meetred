import { AgentRoom } from '@/components/agent/agent-room'
import { Navbar } from '@/components/ui/navbar'
import { AgentProvider } from '@/context/agent-ctx'

export default async function AgentPage({ params }: { params: Promise<{ peerId: string }> }) {
  const { peerId } = await params

  if (!peerId) {
    return <div>Peer ID is required</div>
  }

  return (
    <AgentProvider hostPeerId={peerId}>
      <div className="relative text-foreground bg-background flex flex-col h-screen overflow-y-scroll">
        <Navbar />
        <main className="px-6 bg-background border-default-100 w-full flex flex-col flex-grow min-h-0">
          <AgentRoom peerId={peerId} />
        </main>

        <footer className="w-full border-primary !px-6 py-3 bg-background flex items-center justify-between">
          <div className="text-xs">Metered</div>
        </footer>
      </div>
    </AgentProvider>
  )
}
