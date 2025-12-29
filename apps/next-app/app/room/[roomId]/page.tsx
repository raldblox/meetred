import RoomPage from '@/components/meeting/meeting-room'
import { Navbar } from '@/components/ui/navbar'

export default async function Room({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params

  if (!roomId) {
    return <div>Peer ID is required</div>
  }

  return (
    <div className="relative text-foreground bg-background flex flex-col h-screen overflow-y-scroll">
      <Navbar />
      <main className="px-6 bg-background border-default-100 w-full flex flex-col flex-grow min-h-0">
        <RoomPage roomId={roomId} />
      </main>

      <footer className="w-full border-primary !p-6 bg-background flex items-center justify-between">
        <div className="text-xs">Metered</div>
      </footer>
    </div>
  )
}
