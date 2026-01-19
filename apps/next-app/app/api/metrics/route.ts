import { NextResponse } from 'next/server'

export async function GET() {
  const target =
    process.env.ARN_METRICS_URL ??
    process.env.NEXT_PUBLIC_ARN_METRICS_URL ??
    'http://127.0.0.1:15013/metrics'

  try {
    const res = await fetch(target, { cache: 'no-store' })

    if (!res.ok) {
      return NextResponse.json({ error: `metrics responded ${res.status}` }, { status: 502 })
    }

    const payload = await res.json()
    const streamSessions = payload?.analytics?.streamSessions ?? {}
    const totalMsByRoom = streamSessions.totalMsByRoom ?? {}
    const totalMsByPeer = streamSessions.totalMsByPeer ?? {}

    const toMinutes = (ms: number) => Math.round(ms / 60000)

    const streamMinutesByRoom = Object.fromEntries(
      Object.entries(totalMsByRoom).map(([roomId, ms]) => [roomId, toMinutes(Number(ms) || 0)]),
    )
    const streamMinutesByPeer = Object.fromEntries(
      Object.entries(totalMsByPeer).map(([peerId, ms]) => [peerId, toMinutes(Number(ms) || 0)]),
    )
    const totalStreamMinutes = toMinutes(
      Object.values(totalMsByRoom).reduce((acc: number, ms: any) => acc + (Number(ms) || 0), 0),
    )

    return NextResponse.json({
      ...payload,
      derived: {
        totalStreamMinutes,
        streamMinutesByRoom,
        streamMinutesByPeer,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'metrics fetch failed' }, { status: 502 })
  }
}
