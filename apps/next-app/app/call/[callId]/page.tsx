import { CallRoom } from '@/components/call/call-room'
import { Navbar } from '@/components/ui/navbar'

export default async function Call({ params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params

  if (!callId) {
    return <div>Peer ID is required</div>
  }

  return (
    <div className="relative text-foreground bg-background flex flex-col h-screen overflow-y-scroll md:overflow-y-hidden">
      <Navbar />
      <main className="px-6 bg-background border-default-100 w-full flex flex-col flex-grow min-h-0">
        <CallRoom callId={callId} />
      </main>

      <footer className="w-full border-primary !px-6 py-3 bg-background flex items-center justify-between">
        <div className="text-xs">Metered</div>
      </footer>
    </div>
  )
}
