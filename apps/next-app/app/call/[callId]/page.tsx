import { CallRoom } from '@/components/call/call-room'
import { CallProvider } from '@/context/call-ctx'

export default async function Call({ params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params

  if (!callId) {
    return <div>Peer ID is required</div>
  }

  return (
    <CallProvider callId={callId}>
      <div className="relative text-foreground bg-background flex flex-col h-screen overflow-y-scroll md:overflow-y-hidden">
        <main className="px-6 bg-background border-default-100 w-full flex flex-col flex-grow min-h-0">
          <CallRoom callId={callId} />
        </main>

        <footer className="w-full border-primary !px-6 py-3 bg-background flex items-center justify-between">
          <div className="text-xs">Meetred</div>
        </footer>
      </div>
    </CallProvider>
  )
}
