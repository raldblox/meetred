import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { useRoomController } from "./(hooks)/useRoomController";

type SignalHandler = (event: { payload: any }) => void;

class MockMediaStreamTrack {
  kind: "audio" | "video";
  enabled = true;
  muted = false;
  readyState: "live" | "ended" = "live";
  private listeners = new Map<string, Set<() => void>>();

  constructor(kind: "audio" | "video") {
    this.kind = kind;
  }

  stop() {
    this.readyState = "ended";
    this.emit("ended");
  }

  addEventListener(event: string, handler: () => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  removeEventListener(event: string, handler: () => void) {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string) {
    this.listeners.get(event)?.forEach((handler) => handler());
  }
}

class MockMediaStream {
  private tracks: MockMediaStreamTrack[] = [];

  constructor(opts: { audio?: boolean; video?: boolean } = {}) {
    if (opts.video) {
      this.tracks.push(new MockMediaStreamTrack("video"));
    }
    if (opts.audio) {
      this.tracks.push(new MockMediaStreamTrack("audio"));
    }
  }

  getTracks() {
    return [...this.tracks];
  }

  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === "audio");
  }

  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === "video");
  }

  addTrack(track: MockMediaStreamTrack) {
    this.tracks.push(track);
  }

  removeTrack(track: MockMediaStreamTrack) {
    this.tracks = this.tracks.filter((candidate) => candidate !== track);
  }
}

class MockRTCPeerConnection {
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  signalingState: RTCSignalingState = "stable";
  private senders: Array<{
    track: MockMediaStreamTrack | null;
    replaceTrack: (nextTrack: MockMediaStreamTrack | null) => Promise<void>;
  }> = [];
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  ontrack: ((event: RTCTrackEvent) => void) | null = null;

  addTrack(track: MockMediaStreamTrack) {
    const sender = {
      track,
      replaceTrack: async (nextTrack: MockMediaStreamTrack | null) => {
        sender.track = nextTrack;
      },
    };
    this.senders.push(sender);
    return sender;
  }

  getSenders() {
    return this.senders;
  }

  removeTrack(sender: (typeof this.senders)[number]) {
    this.senders = this.senders.filter((candidate) => candidate !== sender);
  }

  async createOffer() {
    return { type: "offer", sdp: "mock-offer" } satisfies RTCSessionDescriptionInit;
  }

  async createAnswer() {
    return { type: "answer", sdp: "mock-answer" } satisfies RTCSessionDescriptionInit;
  }

  async setLocalDescription(description: RTCSessionDescriptionInit) {
    this.localDescription = description;
    this.signalingState =
      description.type === "offer" ? "have-local-offer" : "stable";
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remoteDescription = description;
    this.signalingState =
      description.type === "offer" ? "have-remote-offer" : "stable";
  }

  async addIceCandidate() {
    // no-op
  }

  close() {
    this.signalingState = "closed";
  }
}

class MockRealtimeChannel {
  private signalHandlers: SignalHandler[] = [];
  private roomHandlers: SignalHandler[] = [];
  private statusCallback: ((status: string) => void) | null = null;
  private broadcasts: Array<{ event: string; payload: any }> = [];

  on(_type: string, filter: { event: "signal" | "room-event" }, handler: SignalHandler) {
    if (filter.event === "signal") {
      this.signalHandlers.push(handler);
    } else {
      this.roomHandlers.push(handler);
    }
    return this;
  }

  subscribe(callback: (status: string) => void) {
    this.statusCallback = callback;
    return this;
  }

  async send(payload: { event: string; payload: any }) {
    this.broadcasts.push(payload);
  }

  triggerStatus(status: string) {
    this.statusCallback?.(status);
  }

  emitSignal(payload: any) {
    this.signalHandlers.forEach((handler) =>
      handler({ payload })
    );
  }

  emitRoomEvent(payload: any) {
    this.roomHandlers.forEach((handler) =>
      handler({ payload })
    );
  }

  getSignals() {
    return this.broadcasts
      .filter((item) => item.event === "signal")
      .map((item) => item.payload);
  }

  getRoomEvents() {
    return this.broadcasts
      .filter((item) => item.event === "room-event")
      .map((item) => item.payload);
  }
}

let activeChannel: MockRealtimeChannel | null = null;
let getUserMediaMock: ReturnType<typeof vi.fn>;

const mockSupabaseClient = {
  channel: vi.fn(
    () =>
      (activeChannel = new MockRealtimeChannel())
  ),
  removeChannel: vi.fn(),
};

vi.mock("./(libs)/supabaseClient", () => ({
  createRoomSupabaseClient: () => mockSupabaseClient,
}));

const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("useRoomController", () => {
  beforeAll(() => {
    Object.defineProperty(window, "RTCPeerConnection", {
      writable: true,
      value: MockRTCPeerConnection,
    });
    Object.defineProperty(window, "RTCIceCandidate", {
      writable: true,
      value: class {
        candidate: any;
        constructor(init: any) {
          this.candidate = init;
        }
      },
    });
    Object.defineProperty(window, "RTCSessionDescription", {
      writable: true,
      value: class {
        type: RTCSessionDescriptionInit["type"];
        sdp?: string;
        constructor(init: RTCSessionDescriptionInit) {
          this.type = init.type;
          this.sdp = init.sdp;
        }
      },
    });
    Object.defineProperty(window, "MediaStream", {
      writable: true,
      value: MockMediaStream,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, "srcObject", {
      configurable: true,
      get() {
        return (this as any).__srcObject ?? null;
      },
      set(value) {
        (this as any).__srcObject = value;
      },
    });
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(
      () => Promise.resolve()
    );
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(
      () => {}
    );
  });

  beforeEach(() => {
    activeChannel = null;
    mockSupabaseClient.channel.mockClear();
    mockSupabaseClient.removeChannel.mockClear();
    let nextId = 1;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        randomUUID: () => `user-${nextId++}`,
      },
    });
    getUserMediaMock = vi.fn(
      async (constraints?: MediaStreamConstraints) =>
        new MockMediaStream({
          video:
            typeof constraints?.video === "boolean"
              ? constraints?.video
              : Boolean(constraints?.video),
          audio:
            typeof constraints?.audio === "boolean"
              ? constraints?.audio
              : Boolean(constraints?.audio),
        })
    );
    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: getUserMediaMock },
    });
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn() },
    });
  });

  const setupJoinedRoom = async () => {
    const hook = renderHook(() => useRoomController("demo-room"));
    await waitFor(() => {
      expect(activeChannel).not.toBeNull();
    });
    await act(async () => {
      activeChannel!.triggerStatus("SUBSCRIBED");
      await flushAsync();
    });
    await waitFor(() => {
      expect(hook.result.current.isJoined).toBe(true);
    });
    return { hook, channel: activeChannel! };
  };

  const getLatestMediaState = () => {
    if (!activeChannel) return undefined;
    const mediaEvents = activeChannel
      .getRoomEvents()
      .filter((event) => event.type === "media-state");
    return mediaEvents.at(-1);
  };

  const wasMediaRequested = (check: (constraints?: MediaStreamConstraints) => boolean) =>
    getUserMediaMock.mock.calls.some(([constraints]) => check(constraints));

  it("joins the room and announces presence", async () => {
    const { hook, channel } = await setupJoinedRoom();
    expect(hook.result.current.status).toBe("Joined room");
    expect(
      channel.getRoomEvents().some((evt) => evt.type === "joined")
    ).toBe(true);
  });

  it("starts a call and emits offer plus call-start events", async () => {
    const { hook, channel } = await setupJoinedRoom();
    await act(async () => {
      await hook.result.current.startCall();
    });
    expect(hook.result.current.isCalling).toBe(true);
    expect(
      channel.getSignals().some((payload) => payload.type === "offer")
    ).toBe(true);
    expect(
      channel.getRoomEvents().some((evt) => evt.type === "call-start")
    ).toBe(true);
  });

  it("accepts an incoming offer and responds with an answer", async () => {
    const { hook, channel } = await setupJoinedRoom();
    await act(async () => {
      channel.emitSignal({
        type: "offer",
        sdp: { type: "offer", sdp: "remote-offer" },
        sender: "peer-1",
      });
      await flushAsync();
    });
    expect(hook.result.current.isRinging).toBe(true);
    await act(async () => {
      await hook.result.current.acceptIncomingCall();
    });
    expect(hook.result.current.isCalling).toBe(true);
    expect(
      channel.getSignals().some((payload) => payload.type === "answer")
    ).toBe(true);
  });

  it("toggles camera and microphone before a call and broadcasts media-state updates", async () => {
    const { hook } = await setupJoinedRoom();

    // Enable camera
    await act(async () => {
      await hook.result.current.toggleCamera();
    });
    await waitFor(() => expect(hook.result.current.isCameraEnabled).toBe(true));
    expect(
      wasMediaRequested((constraints) => Boolean(constraints?.video))
    ).toBe(true);
    expect(getLatestMediaState()).toMatchObject({
      cameraEnabled: true,
    });

    // Disable camera
    await act(async () => {
      await hook.result.current.toggleCamera();
    });
    await waitFor(() => expect(hook.result.current.isCameraEnabled).toBe(false));
    expect(getLatestMediaState()).toMatchObject({
      cameraEnabled: false,
    });

    // Enable microphone
    await act(async () => {
      await hook.result.current.toggleMicrophone();
    });
    await waitFor(() => expect(hook.result.current.isMicEnabled).toBe(true));
    expect(
      wasMediaRequested((constraints) => Boolean(constraints?.audio))
    ).toBe(true);
    expect(getLatestMediaState()).toMatchObject({
      micEnabled: true,
    });

    // Disable microphone
    await act(async () => {
      await hook.result.current.toggleMicrophone();
    });
    await waitFor(() => expect(hook.result.current.isMicEnabled).toBe(false));
    expect(getLatestMediaState()).toMatchObject({
      micEnabled: false,
    });
  });

  it("renegotiates media when toggling devices during an active call", async () => {
    const { hook, channel } = await setupJoinedRoom();
    // Turn camera on before call to provide a track
    await act(async () => {
      await hook.result.current.toggleCamera();
    });
    // Start call and simulate answer so call becomes active
    await act(async () => {
      await hook.result.current.startCall();
    });
    await act(async () => {
      channel.emitSignal({
        type: "answer",
        sdp: { type: "answer", sdp: "remote-answer" },
        sender: "peer-remote",
      });
      await flushAsync();
    });
    await waitFor(() => expect(hook.result.current.isAwaitingAnswer).toBe(false));
    const initialOfferCount = channel
      .getSignals()
      .filter((payload) => payload.type === "offer").length;

    // Toggle microphone on during call
    await act(async () => {
      await hook.result.current.toggleMicrophone();
    });
    await waitFor(() => expect(hook.result.current.isMicEnabled).toBe(true));
    expect(getLatestMediaState()).toMatchObject({
      micEnabled: true,
      cameraEnabled: true,
    });

    // Toggle camera off during call
    await act(async () => {
      await hook.result.current.toggleCamera();
    });
    await waitFor(() => expect(hook.result.current.isCameraEnabled).toBe(false));
    expect(getLatestMediaState()).toMatchObject({
      micEnabled: true,
      cameraEnabled: false,
    });

    const renegotiatedOfferCount = channel
      .getSignals()
      .filter((payload) => payload.type === "offer").length;
    expect(renegotiatedOfferCount).toBeGreaterThan(initialOfferCount);
  });

  it("recovers when the remote peer disconnects and rejoins mid-call", async () => {
    const { hook, channel } = await setupJoinedRoom();

    // Simulate remote peer joining so we mark peerPresent true
    await act(async () => {
      channel.emitRoomEvent({ type: "joined", sender: "peer-1" });
      await flushAsync();
    });
    await waitFor(() => expect(hook.result.current.peerPresent).toBe(true));

    await act(async () => {
      await hook.result.current.startCall();
    });
    await act(async () => {
      channel.emitSignal({
        type: "answer",
        sdp: { type: "answer", sdp: "remote-answer" },
        sender: "peer-1",
      });
      await flushAsync();
    });
    await waitFor(() => expect(hook.result.current.isAwaitingAnswer).toBe(false));

    // Remote disconnects
    await act(async () => {
      channel.emitRoomEvent({ type: "left", sender: "peer-1" });
      await flushAsync();
    });
    await waitFor(() => expect(hook.result.current.peerPresent).toBe(false));
    expect(hook.result.current.isCalling).toBe(true);

    // Remote rejoins existing channel
    await act(async () => {
      channel.emitRoomEvent({ type: "joined", sender: "peer-1" });
      await flushAsync();
    });
    await waitFor(() => expect(hook.result.current.peerPresent).toBe(true));
    expect(hook.result.current.status).toBe("Guest already joined");

    const roomEvents = channel.getRoomEvents();
    const joinedAckCount = roomEvents.filter(
      (evt) => evt.type === "joined-ack"
    ).length;
    expect(joinedAckCount).toBeGreaterThanOrEqual(1);
    expect(roomEvents.at(-1)).toMatchObject({ type: "media-state" });
  });
});
