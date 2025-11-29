import RoomPage from './(components)/Room'

export default async function Room({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params

  return (
    <main className="max-w-7xl mx-auto">
      <RoomPage roomId={roomId} />
    </main>
  )
}
