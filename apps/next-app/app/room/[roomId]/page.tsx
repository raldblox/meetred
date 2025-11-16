import RoomPage from "./(components)/Room";

export default async function Room({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  return <RoomPage roomId={roomId} />;
}
