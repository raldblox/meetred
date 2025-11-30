import { act, cleanup, render, waitFor } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { describe, beforeAll, afterAll, afterEach, it, expect, vi } from 'vitest'

import { Libp2pContext } from '@/context/libp2p-ctx'
import { StreamProvider, useStreamContext, type StreamContextValue } from '@/context/stream-ctx'

class MockMediaStream {
  private tracks = [{ stop: vi.fn() }]

  getTracks() {
    return this.tracks
  }
}

let peerConnectionSeq = 0

class MockRTCPeerConnection {
  public onicecandidate: ((event: { candidate: { toJSON: () => any } } | null) => void) | null = null
  public ontrack: ((event: { streams: MockMediaStream[] }) => void) | null = null
  public onconnectionstatechange: (() => void) | null = null
  public connectionState: string = 'new'
  public localDescription: any = null
  public remoteDescription: any = null
  public candidates: any[] = []
  private hasLocalMedia = false
  private readonly id = ++peerConnectionSeq

  addTrack(): void {
    this.hasLocalMedia = true
  }

  async setRemoteDescription(desc: any): Promise<void> {
    this.remoteDescription = desc

    if (!this.hasLocalMedia && desc?.type === 'answer') {
      this.ontrack?.({ streams: [new MockMediaStream()] })
      this.connectionState = 'connected'
      this.onconnectionstatechange?.()
    }
  }

  async createAnswer(): Promise<{ type: string; sdp: string }> {
    return { type: 'answer', sdp: `answer-sdp-${this.id}` }
  }

  async createOffer(): Promise<{ type: string; sdp: string }> {
    return { type: 'offer', sdp: `offer-sdp-${this.id}` }
  }

  async setLocalDescription(desc: any): Promise<void> {
    this.localDescription = desc

    if (desc?.type === 'offer' || desc?.type === 'answer') {
      this.onicecandidate?.({
        candidate: {
          toJSON: () => ({ candidate: `${desc.type}-candidate-${this.id}` }),
        },
      })
    }
  }

  async addIceCandidate(candidate: any): Promise<void> {
    this.candidates.push(candidate)
  }

  close(): void {
    this.connectionState = 'closed'
  }
}

type PubSubHandler = (event: CustomEvent<any>) => void

class MockPubSubBus {
  private handlerSets = new Map<string, Set<PubSubHandler>>()
  private messages: { topic: string; from: string; data: Uint8Array }[] = []
  private decoder = new TextDecoder()

  attachPeer(peerId: string, handlers: Set<PubSubHandler>) {
    this.handlerSets.set(peerId, handlers)
  }

  detachPeer(peerId: string) {
    this.handlerSets.delete(peerId)
  }

  publish(from: string, topic: string, data: Uint8Array) {
    this.messages.push({ topic, from, data })
    const detail = { topic, data, type: 'signed', from: { toString: () => from } }
    const event = new CustomEvent('message', { detail })

    for (const handlers of this.handlerSets.values()) {
      handlers.forEach((handler) => handler(event))
    }
  }

  getMessagesByAction(action: string) {
    return this.messages
      .map((entry) => ({
        ...entry,
        body: JSON.parse(this.decoder.decode(entry.data)),
      }))
      .filter((entry) => entry.body?.payload?.action === action)
  }
}

const createLibp2pMock = (peerId: string, bus: MockPubSubBus) => {
  const handlers = new Set<PubSubHandler>()

  bus.attachPeer(peerId, handlers)

  const pubsub = {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    addEventListener: vi.fn((event: string, handler: PubSubHandler) => {
      if (event === 'message') {
        handlers.add(handler)
      }
    }),
    removeEventListener: vi.fn((event: string, handler: PubSubHandler) => {
      if (event === 'message') {
        handlers.delete(handler)
      }
    }),
    publish: vi.fn(async (topic: string, data: Uint8Array) => {
      bus.publish(peerId, topic, data)
    }),
  }

  return {
    peerId: { toString: () => peerId },
    services: { pubsub },
  } as any
}

const createLibp2pProviderValue = (libp2p: any) => ({
  libp2p,
  createNewIdentity: vi.fn(),
  rotatingIdentity: false,
  importIdentity: vi.fn(),
})

const createProbe = () => {
  const state: { current?: StreamContextValue } = {}

  const Probe = () => {
    state.current = useStreamContext()

    return null
  }

  return { state, Component: Probe }
}

const renderWithLibp2p = (libp2p: any, streamId: string, children: ReactNode) => {
  return (
    <Libp2pContext.Provider value={createLibp2pProviderValue(libp2p)}>
      <StreamProvider streamId={streamId}>{children}</StreamProvider>
    </Libp2pContext.Provider>
  )
}

describe('StreamProvider', () => {
  const originalNavigator = globalThis.navigator
  const originalRTCPeerConnection = globalThis.RTCPeerConnection
  const mockGetUserMedia = vi.fn(async () => new MockMediaStream())

  beforeAll(() => {
    vi.stubGlobal('React', React)
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        ...originalNavigator,
        mediaDevices: { getUserMedia: mockGetUserMedia },
      },
      writable: true,
    })

    Object.defineProperty(globalThis, 'RTCPeerConnection', {
      value: MockRTCPeerConnection,
      writable: true,
    })
  })

  afterAll(() => {
    vi.unstubAllGlobals()
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
    })
    Object.defineProperty(globalThis, 'RTCPeerConnection', {
      value: originalRTCPeerConnection,
      writable: true,
    })
  })

  afterEach(() => {
    cleanup()
    mockGetUserMedia.mockClear()
  })

  it('connects a single viewer automatically once the host starts streaming', async () => {
    const bus = new MockPubSubBus()
    const hostLibp2p = createLibp2pMock('peer-host', bus)
    const viewerLibp2p = createLibp2pMock('peer-viewer', bus)
    const hostProbe = createProbe()
    const viewerProbe = createProbe()

    render(
      <>
        {renderWithLibp2p(hostLibp2p, 'peer-host', <hostProbe.Component />)}
        {renderWithLibp2p(viewerLibp2p, 'peer-host', <viewerProbe.Component />)}
      </>,
    )

    await waitFor(() => expect(hostProbe.state.current).toBeDefined())
    await waitFor(() => expect(viewerProbe.state.current?.status).toBe('connecting'))

    await act(async () => {
      await hostProbe.state.current?.startHosting()
    })

    await waitFor(() => expect(hostProbe.state.current?.status).toBe('live'))
    await waitFor(() => expect(viewerProbe.state.current?.status).toBe('live'))

    const hostAnswers = bus.getMessagesByAction('host-answer')

    expect(hostAnswers).toHaveLength(1)
    expect(hostAnswers[0].body.payload.to).toBe('peer-viewer')
  })

  it('flushes pending offers for multiple viewers when host starts streaming', async () => {
    const bus = new MockPubSubBus()
    const hostLibp2p = createLibp2pMock('peer-host', bus)
    const viewerOne = createLibp2pMock('peer-viewer-1', bus)
    const viewerTwo = createLibp2pMock('peer-viewer-2', bus)
    const hostProbe = createProbe()
    const viewerProbeOne = createProbe()
    const viewerProbeTwo = createProbe()

    render(
      <>
        {renderWithLibp2p(hostLibp2p, 'peer-host', <hostProbe.Component />)}
        {renderWithLibp2p(viewerOne, 'peer-host', <viewerProbeOne.Component />)}
        {renderWithLibp2p(viewerTwo, 'peer-host', <viewerProbeTwo.Component />)}
      </>,
    )

    await waitFor(() => expect(viewerProbeOne.state.current?.status).toBe('connecting'))
    await waitFor(() => expect(viewerProbeTwo.state.current?.status).toBe('connecting'))

    await act(async () => {
      await hostProbe.state.current?.startHosting()
    })

    await waitFor(() => expect(hostProbe.state.current?.status).toBe('live'))
    await waitFor(() => expect(viewerProbeOne.state.current?.status).toBe('live'))
    await waitFor(() => expect(viewerProbeTwo.state.current?.status).toBe('live'))

    const hostAnswers = bus.getMessagesByAction('host-answer')

    expect(hostAnswers).toHaveLength(2)
    const recipients = hostAnswers.map((msg) => msg.body.payload.to).sort()

    expect(recipients).toEqual(['peer-viewer-1', 'peer-viewer-2'])
  })
})
