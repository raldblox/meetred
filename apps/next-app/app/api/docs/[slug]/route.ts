import path from 'path'
import fs from 'fs/promises'

import { NextResponse } from 'next/server'

const DOCS_MAP: Record<string, string> = {
  // User
  'user-overview': path.join('user', 'OVERVIEW.md'),
  'user-start': path.join('user', 'START_HERE.md'),
  'user-faq': path.join('user', 'FAQ.md'),
  'user-public': path.join('user', 'PUBLIC_ROOM.md'),
  'user-dms': path.join('user', 'DIRECT_MESSAGES.md'),
  'user-identity': path.join('user', 'IDENTITY.md'),
  'user-streams': path.join('user', 'STREAMS.md'),
  'user-calls': path.join('user', 'CALLS.md'),
  'user-ai': path.join('user', 'AI_ROOMS.md'),
  'user-payments': path.join('user', 'PAYMENTS.md'),
  'user-safety': path.join('user', 'SAFETY.md'),
  'user-troubleshoot': path.join('user', 'TROUBLESHOOTING.md'),
  'user-glossary': path.join('user', 'GLOSSARY.md'),
  // Developer
  'dev-overview': path.join('developer', 'OVERVIEW.md'),
  'dev-tech-stack': path.join('developer', 'TECH_STACK.md'),
  'dev-architecture': path.join('developer', 'ARCHITECTURE.md'),
  'dev-networking': path.join('developer', 'NETWORKING.md'),
  'dev-history': path.join('developer', 'MESSAGE_HISTORY.md'),
  'dev-security': path.join('developer', 'SECURITY_MODEL.md'),
  'dev-ai': path.join('developer', 'AI_INTEGRATION.md'),
  'dev-retention': path.join('developer', 'DATA_RETENTION.md'),
  'dev-threat': path.join('developer', 'THREAT_MODEL.md'),
  'dev-open': path.join('developer', 'OPEN_QUESTIONS.md'),
  // Legacy aliases to keep links working
  'summary': path.join('user', 'OVERVIEW.md'),
  'start-here': path.join('user', 'START_HERE.md'),
  'what-is-meetred': path.join('user', 'OVERVIEW.md'),
  'public-room': path.join('user', 'PUBLIC_ROOM.md'),
  faq: path.join('user', 'FAQ.md'),
  glossary: path.join('user', 'GLOSSARY.md'),
  'direct-messages': path.join('user', 'DIRECT_MESSAGES.md'),
  streams: path.join('user', 'STREAMS.md'),
  calls: path.join('user', 'CALLS.md'),
  'ai-rooms': path.join('user', 'AI_ROOMS.md'),
  identity: path.join('user', 'IDENTITY.md'),
  payments: path.join('user', 'PAYMENTS.md'),
  troubleshooting: path.join('user', 'TROUBLESHOOTING.md'),
  'safety-privacy': path.join('user', 'SAFETY.md'),
  'how-it-works': path.join('user', 'OVERVIEW.md'),
}

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const file = DOCS_MAP[slug]

  if (!file) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const filePath = path.join(process.cwd(), 'docs', file)

  try {
    const content = await fs.readFile(filePath, 'utf8')

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unable to read file' }, { status: 500 })
  }
}
