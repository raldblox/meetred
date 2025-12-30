import path from 'path'
import fs from 'fs/promises'

import { NextResponse } from 'next/server'

const ALLOWED = new Set([
  'messaging-architecture',
  'network-basics',
  'dm-history',
  'security-privacy',
  'faq-chat',
  'howto-troubleshoot',
  'identity',
])

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug

  if (!ALLOWED.has(slug)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const filePath = path.join(process.cwd(), 'docs', `${slug}.md`)

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
