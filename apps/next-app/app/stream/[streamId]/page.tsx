import { StreamRoom } from '@/components/stream/stream-room'
import { Navbar } from '@/components/ui/navbar'
import { StreamProvider } from '@/context/stream-ctx'

export default async function StreamPage({ params }: { params: Promise<{ streamId: string }> }) {
  const { streamId } = await params

  return (
    <StreamProvider streamId={streamId}>
      <div className="relative text-foreground bg-background flex flex-col h-screen overflow-y-scroll md:overflow-y-hidden">
        <Navbar />
        <main className="px-6 bg-background border-default-100 w-full flex flex-col flex-grow min-h-0">
          <StreamRoom streamId={streamId} />
        </main>

        <footer className="w-full border-primary !px-6 py-3 bg-background flex items-center justify-between">
          <div className="text-xs">Metered</div>
        </footer>
      </div>
    </StreamProvider>
  )
}
