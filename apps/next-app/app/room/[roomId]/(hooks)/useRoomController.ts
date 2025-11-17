// app/room/[roomId]/page.tsx
"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  NoiseSuppressionMode,
  NoiseSuppressionStatus,
} from "@/components/noise-suppression";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createRoomSupabaseClient } from "../(libs)/supabaseClient";
import {
  ICE_SERVER_CONFIG,
  ROOM_CHANNEL_PREFIX,
  type RoomEvent,
  type SignalMessage,
} from "../(libs)/roomTypes";
import { clearVideoElement, formatCallDuration } from "../(utils)/media";

const isProduction = process.env.NODE_ENV === "production";
const logError = (...args: unknown[]) => {
  if (!isProduction) {
    // eslint-disable-next-line no-console
    console.error(...args);
  }
};

type WindowWithAudioContext = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

type SpeexNoiseSuppressorModule =
  typeof import("@sapphi-red/web-noise-suppressor");

const SPEEX_WORKLET_URL = new URL(
  "@sapphi-red/web-noise-suppressor/speexWorklet.js",
  import.meta.url,
).toString();

const SPEEX_WASM_URL = new URL(
  "@sapphi-red/web-noise-suppressor/speex.wasm",
  import.meta.url,
).toString();

const isLikelyScreenShareTrack = (track: MediaStreamTrack) => {
  if (typeof track.getSettings === "function") {
    const settings = track.getSettings();

    if (settings && "displaySurface" in settings) {
      return true;
    }
  }
  const label = track.label?.toLowerCase() ?? "";

  return label.includes("screen") || label.includes("display");
};

export function useRoomController(roomId: string) {
  const [status, setStatus] = useState<string>("Not joined");
  const [isJoined, setIsJoined] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [peerPresent, setPeerPresent] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [incomingOffer, setIncomingOffer] =
    useState<RTCSessionDescriptionInit | null>(null);
  const [incomingCaller, setIncomingCaller] = useState<string | null>(null);
  const [isAwaitingAnswer, setIsAwaitingAnswer] = useState(false);
  const [roomLink, setRoomLink] = useState("");
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isRemoteVideoEnabled, setIsRemoteVideoEnabled] = useState<
    boolean | null
  >(null);
  const [isRemoteAudioEnabled, setIsRemoteAudioEnabled] = useState<
    boolean | null
  >(null);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [needsResume, setNeedsResume] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
  const [isNoiseSuppressionEnabled, setIsNoiseSuppressionEnabled] =
    useState(true);
  const [noiseSuppressionStatus, setNoiseSuppressionStatus] =
    useState<NoiseSuppressionStatus>("idle");
  const [noiseSuppressionMode, setNoiseSuppressionMode] =
    useState<NoiseSuppressionMode>("system");
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteScreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenShareStreamRef = useRef<MediaStream | null>(null);
  const screenShareSenderRef = useRef<RTCRtpSender | null>(null);
  const localVideoSenderRef = useRef<RTCRtpSender | null>(null);
  const localAudioSenderRef = useRef<RTCRtpSender | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const myIdRef = useRef<string>("");
  const handleSignalRef = useRef<(msg: SignalMessage) => void>(() => {});
  const handleRoomEventRef = useRef<(event: RoomEvent) => void>(() => {});
  const isJoiningRef = useRef(false);
  const autoJoinAttemptedRef = useRef(false);
  const callAreaRef = useRef<HTMLDivElement | null>(null);
  const participantsRef = useRef<Set<string>>(new Set());
  const hostIdRef = useRef<string | null>(null);
  const remoteScreenStreamRef = useRef<MediaStream | null>(null);
  const remoteScreenStreamIdRef = useRef<string | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteScreenExpectedRef = useRef(false);
  const rawAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const processedAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const speexResourcesRef = useRef<{
    context: AudioContext | null;
    source: MediaStreamAudioSourceNode | null;
    worklet: AudioWorkletNode | null;
    destination: MediaStreamAudioDestinationNode | null;
    originalTrack: MediaStreamTrack | null;
  }>({
    context: null,
    source: null,
    worklet: null,
    destination: null,
    originalTrack: null,
  });
  const speexWasmBinaryRef = useRef<ArrayBuffer | null>(null);
  const speexModuleRef = useRef<SpeexNoiseSuppressorModule | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [peerRole, setPeerRole] = useState<"host" | "guest" | null>(null);
  const resetRemoteScreenShare = useCallback(() => {
    remoteScreenExpectedRef.current = false;
    remoteScreenStreamIdRef.current = null;
    if (remoteScreenStreamRef.current) {
      remoteScreenStreamRef.current
        .getTracks()
        .forEach((track) => track.stop());
      remoteScreenStreamRef.current = null;
    }
    clearVideoElement(remoteScreenVideoRef);
    setIsRemoteScreenSharing(false);
  }, []);

  const resetRemoteVideo = useCallback(() => {
    clearVideoElement(remoteVideoRef);
    remoteStreamRef.current = null;
    setHasRemoteStream(false);
    setIsRemoteVideoEnabled(null);
    setIsRemoteAudioEnabled(null);
    resetRemoteScreenShare();
  }, [resetRemoteScreenShare]);

  const ensureSpeexModule = useCallback(async () => {
    if (typeof window === "undefined") {
      return null;
    }

    if (speexModuleRef.current) {
      return speexModuleRef.current;
    }

    try {
      const speexModule = await import("@sapphi-red/web-noise-suppressor");

      speexModuleRef.current = speexModule;

      return speexModule;
    } catch (err) {
      logError("Unable to load Speex module", err);

      return null;
    }
  }, []);

  const refreshParticipantState = useCallback(() => {
    const participants = participantsRef.current;

    if (participants.size === 0) {
      hostIdRef.current = null;
      setIsHost(false);
      setPeerRole(null);
      setPeerPresent(false);

      return;
    }
    if (!hostIdRef.current || !participants.has(hostIdRef.current)) {
      const firstEntry = participants.values().next().value ?? null;

      hostIdRef.current = firstEntry ?? null;
    }
    const currentHost = hostIdRef.current;

    setIsHost(currentHost === myIdRef.current);
    const peerId =
      Array.from(participants).find((id) => id !== myIdRef.current) ?? null;

    setPeerPresent(Boolean(peerId));
    if (peerId && currentHost) {
      setPeerRole(peerId === currentHost ? "host" : "guest");
    } else {
      setPeerRole(null);
    }
  }, []);

  const addParticipant = useCallback(
    (id: string) => {
      if (!id) return participantsRef.current.size;
      const participants = participantsRef.current;

      if (!participants.has(id)) {
        participants.add(id);
        refreshParticipantState();
      }

      return participants.size;
    },
    [refreshParticipantState],
  );

  const removeParticipant = useCallback(
    (id: string) => {
      if (!id) return participantsRef.current.size;
      const participants = participantsRef.current;

      if (participants.delete(id)) {
        refreshParticipantState();
      }

      return participants.size;
    },
    [refreshParticipantState],
  );

  const sendSignal = async (msg: SignalMessage) => {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type: "broadcast",
      event: "signal",
      payload: msg,
    });
  };

  // Helper to renegotiate peer connection when tracks change
  const renegotiateConnection = useCallback(async () => {
    const pc = pcRef.current;

    if (!pc || pc.signalingState === "closed") return;
    // Only renegotiate when connection is stable (call is established)
    if (pc.signalingState === "stable") {
      try {
        // Only renegotiate if we have a remote description (call is established)
        if (pc.remoteDescription && pc.remoteDescription.type) {
          const offer = await pc.createOffer();

          await pc.setLocalDescription(offer);
          await sendSignal({
            type: "offer",
            sdp: offer,
            sender: myIdRef.current,
          });
        }
      } catch (err) {
        logError("Error renegotiating connection:", err);
      }
    }
  }, []);

  // Helper to update peer connection with current tracks
  const updatePeerConnectionTracks = useCallback(async () => {
    const pc = pcRef.current;
    const stream = localStreamRef.current;

    if (!pc) return;

    const videoTrack = stream?.getVideoTracks()[0] ?? null;
    const audioTrack = stream?.getAudioTracks()[0] ?? null;
    let needsRenegotiation = false;

    const videoSender = localVideoSenderRef.current;

    if (videoTrack) {
      if (videoSender) {
        if (videoSender.track !== videoTrack) {
          try {
            await videoSender.replaceTrack(videoTrack);
          } catch (err) {
            logError("Error replacing video track:", err);
          }
        }
      } else if (stream) {
        try {
          localVideoSenderRef.current = pc.addTrack(videoTrack, stream);
          needsRenegotiation = true;
        } catch (err) {
          logError("Error adding video track:", err);
        }
      }
    } else if (videoSender) {
      try {
        pc.removeTrack(videoSender);
        localVideoSenderRef.current = null;
        needsRenegotiation = true;
      } catch (err) {
        logError("Error removing video track:", err);
      }
    }

    const audioSender = localAudioSenderRef.current;

    if (audioTrack) {
      if (audioSender) {
        if (audioSender.track !== audioTrack) {
          try {
            await audioSender.replaceTrack(audioTrack);
          } catch (err) {
            logError("Error replacing audio track:", err);
          }
        }
      } else if (stream) {
        try {
          localAudioSenderRef.current = pc.addTrack(audioTrack, stream);
          needsRenegotiation = true;
        } catch (err) {
          logError("Error adding audio track:", err);
        }
      }
    } else if (audioSender) {
      try {
        pc.removeTrack(audioSender);
        localAudioSenderRef.current = null;
        needsRenegotiation = true;
      } catch (err) {
        logError("Error removing audio track:", err);
      }
    }

    if (needsRenegotiation && isCalling && !isAwaitingAnswer) {
      await renegotiateConnection();
    }
  }, [isCalling, isAwaitingAnswer, renegotiateConnection]);

  const getNoiseControlledConstraints = useCallback(
    (override?: boolean): MediaTrackConstraints => ({
      echoCancellation: true,
      noiseSuppression:
        typeof override === "boolean"
          ? override
          : isNoiseSuppressionEnabled && noiseSuppressionMode === "system",
      autoGainControl: true,
    }),
    [isNoiseSuppressionEnabled, noiseSuppressionMode],
  );

  const applyNoiseSuppressionToTrack = useCallback(
    async (track?: MediaStreamTrack | null) => {
      if (!track) return false;
      if (typeof track.applyConstraints !== "function") {
        setNoiseSuppressionStatus("unsupported");

        return false;
      }
      try {
        setNoiseSuppressionStatus("pending");
        await track.applyConstraints(getNoiseControlledConstraints());
        setNoiseSuppressionStatus(
          isNoiseSuppressionEnabled ? "active" : "idle",
        );

        return true;
      } catch (err) {
        logError("Error applying noise suppression", err);
        setNoiseSuppressionStatus("error");

        return false;
      }
    },
    [getNoiseControlledConstraints, isNoiseSuppressionEnabled],
  );

  const teardownSpeexSuppression = useCallback(
    async ({
      restoreOriginalTrack = true,
      resetStatus = false,
      stopOriginalTrack = false,
    }: {
      restoreOriginalTrack?: boolean;
      resetStatus?: boolean;
      stopOriginalTrack?: boolean;
    } = {}) => {
      const stream = localStreamRef.current;
      const processedTrack = processedAudioTrackRef.current;
      const originalTrack =
        speexResourcesRef.current.originalTrack ?? rawAudioTrackRef.current;
      const { context, source, worklet, destination } =
        speexResourcesRef.current;

      speexResourcesRef.current = {
        context: null,
        source: null,
        worklet: null,
        destination: null,
        originalTrack,
      };

      [source, worklet, destination].forEach((node) => {
        try {
          node?.disconnect();
        } catch {
          // ignore disconnect errors
        }
      });

      if (context) {
        try {
          await context.close();
        } catch {
          // ignore closing errors
        }
      }

      if (processedTrack) {
        processedAudioTrackRef.current = null;
        if (stream && stream.getAudioTracks().includes(processedTrack)) {
          stream.removeTrack(processedTrack);
        }
        processedTrack.stop();
      }

      if (restoreOriginalTrack && stream && originalTrack) {
        const alreadyInStream = stream.getAudioTracks().includes(originalTrack);

        if (!alreadyInStream) {
          stream.addTrack(originalTrack);
        }
        rawAudioTrackRef.current = originalTrack;
      }

      if (stopOriginalTrack && originalTrack) {
        originalTrack.stop();
        rawAudioTrackRef.current = null;
      }

      if (resetStatus) {
        setNoiseSuppressionStatus("idle");
      }

      if (stream) {
        await updatePeerConnectionTracks();
      }
    },
    [updatePeerConnectionTracks],
  );

  const activateSpeexSuppression = useCallback(
    async (inputTrack?: MediaStreamTrack | null) => {
      const stream = localStreamRef.current;

      if (!stream) {
        return false;
      }
      const AudioContextCtor =
        typeof window === "undefined"
          ? null
          : ((window as WindowWithAudioContext).AudioContext ??
            (window as WindowWithAudioContext).webkitAudioContext ??
            null);

      if (!AudioContextCtor) {
        setNoiseSuppressionStatus("unsupported");

        return false;
      }

      const track =
        inputTrack ??
        rawAudioTrackRef.current ??
        stream.getAudioTracks()[0] ??
        null;

      if (!track) {
        return false;
      }

      const speexModule = await ensureSpeexModule();

      if (!speexModule) {
        setNoiseSuppressionStatus("unsupported");

        return false;
      }
      const { SpeexWorkletNode, loadSpeex } = speexModule;

      rawAudioTrackRef.current = track;

      try {
        await teardownSpeexSuppression({
          restoreOriginalTrack: false,
        });
        setNoiseSuppressionStatus("pending");

        const audioContext = new AudioContextCtor();
        const wasmBinary =
          speexWasmBinaryRef.current ??
          (speexWasmBinaryRef.current = await loadSpeex({
            url: SPEEX_WASM_URL,
          }));

        await audioContext.audioWorklet.addModule(SPEEX_WORKLET_URL);

        const sourceStream = new MediaStream([track]);
        const source = audioContext.createMediaStreamSource(sourceStream);
        const worklet = new SpeexWorkletNode(audioContext, {
          wasmBinary,
          maxChannels: 1,
        });
        const destination = audioContext.createMediaStreamDestination();

        source.connect(worklet).connect(destination);

        const [processedTrack] = destination.stream.getAudioTracks();

        if (!processedTrack) {
          throw new Error("Unable to create processed audio track");
        }

        processedTrack.contentHint = "speech";
        processedAudioTrackRef.current = processedTrack;
        speexResourcesRef.current = {
          context: audioContext,
          source,
          worklet,
          destination,
          originalTrack: track,
        };

        if (stream.getAudioTracks().includes(track)) {
          stream.removeTrack(track);
        }
        stream.addTrack(processedTrack);

        await updatePeerConnectionTracks();
        setNoiseSuppressionStatus("active");

        return true;
      } catch (err) {
        logError("Error enabling Speex noise suppression", err);
        await teardownSpeexSuppression({
          restoreOriginalTrack: true,
          resetStatus: true,
        });

        return false;
      }
    },
    [ensureSpeexModule, teardownSpeexSuppression, updatePeerConnectionTracks],
  );

  const applyNoiseSuppressionPipeline = useCallback(
    async (modeOverride?: NoiseSuppressionMode) => {
      if (!isNoiseSuppressionEnabled) {
        setNoiseSuppressionStatus("idle");

        return;
      }
      const stream = localStreamRef.current;
      const track =
        rawAudioTrackRef.current ?? stream?.getAudioTracks()[0] ?? null;

      if (!track) {
        return;
      }

      const mode = modeOverride ?? noiseSuppressionMode;

      if (mode === "speex") {
        await activateSpeexSuppression(track);
      } else {
        await teardownSpeexSuppression({
          restoreOriginalTrack: true,
        });
        await applyNoiseSuppressionToTrack(track);
      }
    },
    [
      activateSpeexSuppression,
      applyNoiseSuppressionToTrack,
      isNoiseSuppressionEnabled,
      noiseSuppressionMode,
      teardownSpeexSuppression,
    ],
  );

  const changeNoiseSuppressionMode = useCallback(
    async (mode: NoiseSuppressionMode) => {
      setNoiseSuppressionMode(mode);

      if (!isNoiseSuppressionEnabled || !isMicEnabled) {
        return;
      }

      await applyNoiseSuppressionPipeline(mode);
    },
    [applyNoiseSuppressionPipeline, isMicEnabled, isNoiseSuppressionEnabled],
  );

  const ensureLocalStream = useCallback(async () => {
    // If stream exists and has the tracks we need, return it
    if (localStreamRef.current) {
      const stream = localStreamRef.current;
      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;

      // If we need video but don't have it, or need audio but don't have it
      if ((isCameraEnabled && !hasVideo) || (isMicEnabled && !hasAudio)) {
        // Request missing tracks
        const constraints: MediaStreamConstraints = {};

        if (isCameraEnabled && !hasVideo) {
          constraints.video = true;
        }
        if (isMicEnabled && !hasAudio) {
          constraints.audio = getNoiseControlledConstraints();
        }

        try {
          const newStream =
            await navigator.mediaDevices.getUserMedia(constraints);

          newStream.getVideoTracks().forEach((track) => {
            if (stream) {
              stream.addTrack(track);
            }
          });
          newStream.getAudioTracks().forEach((track) => {
            if (stream) {
              stream.addTrack(track);
            }
          });
          // Update peer connection if in call
          if (pcRef.current) {
            updatePeerConnectionTracks();
          }
        } catch (err) {
          logError("Error adding tracks:", err);
          throw err;
        }
      }

      return stream;
    }

    // Create new stream only with requested devices
    setStatus("Requesting access");
    const constraints: MediaStreamConstraints = {
      video: isCameraEnabled,
      audio: isMicEnabled ? getNoiseControlledConstraints() : false,
    };

    // If both are false, we still need to create an empty stream for consistency
    if (!isCameraEnabled && !isMicEnabled) {
      localStreamRef.current = new MediaStream();
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      return localStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    return stream;
  }, [
    getNoiseControlledConstraints,
    isCameraEnabled,
    isMicEnabled,
    updatePeerConnectionTracks,
  ]);

  // Create Supabase client (works both server/client, but we only use it in effects)
  const supabase = useMemo(() => createRoomSupabaseClient(), []);

  // Initialize myId once on client
  useEffect(() => {
    myIdRef.current = crypto.randomUUID();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setRoomLink(window.location.href);
  }, [roomId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyViewportHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight ?? 0;

      setViewportHeight(Math.round(height));
    };

    applyViewportHeight();

    const handleResize = () => applyViewportHeight();
    const handleOrientation = () => applyViewportHeight();
    const visualViewport = window.visualViewport;

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientation);
    visualViewport?.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientation);
      visualViewport?.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || !isFullscreen) return;

    const { style } = document.body;
    const originalOverflow = style.overflow;
    const originalHeight = style.height;

    style.overflow = "hidden";
    style.height = "100%";

    return () => {
      style.overflow = originalOverflow;
      style.height = originalHeight;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (typeof window === "undefined" || !isFullscreen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
        setStatus("Immersive view disabled");
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (isCalling && !isAwaitingAnswer) {
      setCallStartTime((prev) => prev ?? Date.now());
    } else if (!isCalling) {
      setCallStartTime(null);
      setCallDuration(0);
    }
  }, [isAwaitingAnswer, isCalling]);

  useEffect(() => {
    if (callStartTime === null) return;
    const id = window.setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
    }, 1000);

    return () => window.clearInterval(id);
  }, [callStartTime]);

  useEffect(() => {
    const audio = ringtoneRef.current;

    if (!audio) return;

    if (isRinging) {
      audio.currentTime = 0;
      const playPromise = audio.play();

      if (playPromise) {
        playPromise.catch(() => {
          // ignore autoplay rejections
        });
      }
    } else {
      audio.pause();
      audio.currentTime = 0;
    }

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [isRinging]);

  const attachLocalTracks = useCallback(
    (pc: RTCPeerConnection, stream: MediaStream) => {
      stream.getTracks().forEach((track) => {
        if (track.kind === "video" && !localVideoSenderRef.current) {
          localVideoSenderRef.current = pc.addTrack(track, stream);
        }
        if (track.kind === "audio" && !localAudioSenderRef.current) {
          localAudioSenderRef.current = pc.addTrack(track, stream);
        }
      });
    },
    [],
  );

  const createPeerConnection = () => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(ICE_SERVER_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: "candidate",
          candidate: event.candidate.toJSON(),
          sender: myIdRef.current,
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;

      if (event.track.kind === "video") {
        const streamId = stream?.id ?? null;
        const expectedStreamId = remoteScreenStreamIdRef.current;
        const hasExplicitStreamId = Boolean(expectedStreamId);
        const matchesExpectedStream =
          Boolean(streamId) && streamId === expectedStreamId;
        const looksLikeScreen = isLikelyScreenShareTrack(event.track);
        const shouldUseScreen =
          matchesExpectedStream ||
          (!hasExplicitStreamId &&
            (remoteScreenExpectedRef.current || looksLikeScreen));

        if (shouldUseScreen) {
          remoteScreenExpectedRef.current = false;
          if (streamId) {
            remoteScreenStreamIdRef.current = streamId;
          }
          remoteScreenStreamRef.current = stream;
          if (remoteScreenVideoRef.current) {
            remoteScreenVideoRef.current.srcObject = stream;
          }
          setIsRemoteScreenSharing(true);
          event.track.onended = () => resetRemoteScreenShare();

          return;
        }
        remoteStreamRef.current = stream;
        if (!remoteVideoRef.current) return;
        remoteVideoRef.current.srcObject = stream;
        setHasRemoteStream(true);
        setIsRemoteVideoEnabled(!event.track.muted);
        event.track.onmute = () => setIsRemoteVideoEnabled(false);
        event.track.onunmute = () => setIsRemoteVideoEnabled(true);
        event.track.onended = () => setIsRemoteVideoEnabled(false);

        return;
      }
      if (event.track.kind === "audio") {
        setIsRemoteAudioEnabled(!event.track.muted);
        event.track.onmute = () => setIsRemoteAudioEnabled(false);
        event.track.onunmute = () => setIsRemoteAudioEnabled(true);
        event.track.onended = () => setIsRemoteAudioEnabled(false);
      }
    };

    // Attach local tracks if we already have stream
    if (localStreamRef.current) {
      attachLocalTracks(pc, localStreamRef.current);
    }

    pcRef.current = pc;

    return pc;
  };

  const handleSignal = async (msg: SignalMessage) => {
    // Ignore our own messages
    if (msg.sender === myIdRef.current) return;

    const pc = createPeerConnection();

    if (msg.type === "offer") {
      // If we're already in a call with an established connection, this is a renegotiation offer
      if (
        isCalling &&
        !isAwaitingAnswer &&
        pc.remoteDescription &&
        (pc.signalingState === "stable" ||
          pc.signalingState === "have-remote-offer")
      ) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          await flushPendingCandidates();
          const answer = await pc.createAnswer();

          await pc.setLocalDescription(answer);
          await sendSignal({
            type: "answer",
            sdp: answer,
            sender: myIdRef.current,
          });
        } catch (err) {
          logError("Error handling renegotiation offer:", err);
        }

        return;
      }
      // Otherwise, it's a new incoming call
      setIncomingOffer(msg.sdp);
      setIncomingCaller(msg.sender);
      setIsRinging(true);
      setStatus("Incoming call");

      return;
    }

    if (msg.type === "answer") {
      setStatus("Received answer, connecting...");
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      await flushPendingCandidates();
      setIsCalling(true);
      setIsAwaitingAnswer(false);
      setIsRinging(false);
      setStatus("In call");
    } else if (msg.type === "candidate") {
      await queueIceCandidate(msg.candidate);
    }
  };

  handleSignalRef.current = handleSignal;

  const flushPendingCandidates = async () => {
    const pc = pcRef.current;

    if (!pc) return;
    const remoteDesc = pc.remoteDescription;

    if (!remoteDesc || !remoteDesc.type) return;
    const queued = pendingCandidatesRef.current.splice(0);

    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        logError("Error adding queued candidate", err);
      }
    }
  };

  const queueIceCandidate = async (candidate: RTCIceCandidateInit) => {
    const pc = pcRef.current;

    if (!pc) return;
    if (!pc.remoteDescription || !pc.remoteDescription.type) {
      pendingCandidatesRef.current.push(candidate);

      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      logError("Error adding ice candidate", err);
    }
  };

  const sendRoomEvent = useCallback(async (event: RoomEvent) => {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type: "broadcast",
      event: "room-event",
      payload: event,
    });
  }, []);

  const broadcastMediaState = useCallback(
    (cameraEnabled: boolean, micEnabled: boolean) => {
      void sendRoomEvent({
        type: "media-state",
        sender: myIdRef.current,
        cameraEnabled,
        micEnabled,
      });
    },
    [sendRoomEvent],
  );

  const broadcastScreenShareState = useCallback(
    (isSharing: boolean, streamId?: string | null) => {
      void sendRoomEvent({
        type: "screen-share-state",
        sender: myIdRef.current,
        isSharing,
        screenStreamId: streamId,
      });
    },
    [sendRoomEvent],
  );

  const stopScreenShare = useCallback(
    async (shouldBroadcast = true) => {
      const pc = pcRef.current;
      const sender = screenShareSenderRef.current;

      if (sender && pc) {
        try {
          pc.removeTrack(sender);
          await renegotiateConnection();
        } catch (err) {
          logError("Error removing screen share track:", err);
        }
      }
      screenShareSenderRef.current = null;

      const stream = screenShareStreamRef.current;

      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        screenShareStreamRef.current = null;
      }
      clearVideoElement(screenShareVideoRef);
      setIsScreenSharing(false);
      if (shouldBroadcast) {
        broadcastScreenShareState(false, null);
      }
    },
    [broadcastScreenShareState, renegotiateConnection],
  );

  const startScreenShare = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setStatus("Screen share unsupported");

        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          frameRate: { ideal: 30, max: 30 },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      screenShareStreamRef.current = stream;
      if (screenShareVideoRef.current) {
        screenShareVideoRef.current.srcObject = stream;
      }
      const [track] = stream.getVideoTracks();

      if (!track) {
        setStatus("No screen track available");

        return;
      }
      const pc = createPeerConnection();

      screenShareSenderRef.current = pc.addTrack(track, stream);
      track.onended = () => {
        void stopScreenShare();
      };
      setIsScreenSharing(true);
      broadcastScreenShareState(true, stream.id);
      await renegotiateConnection();
      setStatus("Sharing screen");
    } catch (err) {
      logError("Error starting screen share", err);
      setStatus("Cannot start screen share");
    }
  }, [
    broadcastScreenShareState,
    createPeerConnection,
    renegotiateConnection,
    stopScreenShare,
  ]);

  // Sync button state with actual track state to reflect hardware connection
  useEffect(() => {
    const stream = localStreamRef.current;

    if (!stream) {
      // If no stream, ensure state reflects no devices
      if (isCameraEnabled) setIsCameraEnabled(false);
      if (isMicEnabled) setIsMicEnabled(false);

      return;
    }

    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    const hasActiveVideo =
      videoTracks.length > 0 && videoTracks[0].readyState === "live";
    const hasActiveAudio =
      audioTracks.length > 0 && audioTracks[0].readyState === "live";

    // Sync state with actual track state
    if (hasActiveVideo !== isCameraEnabled) {
      setIsCameraEnabled(hasActiveVideo);
    }
    if (hasActiveAudio !== isMicEnabled) {
      setIsMicEnabled(hasActiveAudio);
    }

    // Listen for track ended events to update state
    const handleVideoTrackEnd = () => {
      setIsCameraEnabled(false);
      broadcastMediaState(false, isMicEnabled);
    };
    const handleAudioTrackEnd = () => {
      setIsMicEnabled(false);
      broadcastMediaState(isCameraEnabled, false);
    };

    videoTracks.forEach((track) => {
      track.addEventListener("ended", handleVideoTrackEnd);
    });
    audioTracks.forEach((track) => {
      track.addEventListener("ended", handleAudioTrackEnd);
    });

    return () => {
      videoTracks.forEach((track) => {
        track.removeEventListener("ended", handleVideoTrackEnd);
      });
      audioTracks.forEach((track) => {
        track.removeEventListener("ended", handleAudioTrackEnd);
      });
    };
  }, [isCameraEnabled, isMicEnabled, broadcastMediaState]);

  const resetLocalMediaState = useCallback(() => {
    setIsScreenSharing(false);
    void stopScreenShare();
    const stream = localStreamRef.current;

    if (stream) {
      // Stop all tracks completely
      stream.getTracks().forEach((track) => {
        track.stop();
        stream.removeTrack(track);
      });
    }
    setIsCameraEnabled(false);
    setIsMicEnabled(false);
    broadcastMediaState(false, false);
  }, [broadcastMediaState, stopScreenShare]);

  const handleRoomCapacityExceeded = useCallback(() => {
    setStatus("Room full");
    void stopScreenShare();
    if (channelRef.current) {
      void sendRoomEvent({ type: "left", sender: myIdRef.current });
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    localVideoSenderRef.current = null;
    localAudioSenderRef.current = null;
    participantsRef.current.delete(myIdRef.current);
    refreshParticipantState();
    setIsJoined(false);
    setIsCalling(false);
    setIsAwaitingAnswer(false);
    setNeedsResume(false);
    resetRemoteVideo();
  }, [
    refreshParticipantState,
    resetRemoteVideo,
    sendRoomEvent,
    stopScreenShare,
    supabase,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const notifyDeparture = () => {
      if (!channelRef.current) return;
      void sendRoomEvent({ type: "left", sender: myIdRef.current });
    };

    window.addEventListener("beforeunload", notifyDeparture);

    return () => {
      window.removeEventListener("beforeunload", notifyDeparture);
      notifyDeparture();
      void stopScreenShare();
      if (pcRef.current) {
        // Stop all tracks from senders
        pcRef.current.getSenders().forEach((s) => {
          if (s.track) {
            s.track.stop();
          }
        });
        pcRef.current.close();
        pcRef.current = null;
      }
      localVideoSenderRef.current = null;
      localAudioSenderRef.current = null;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      // Fully disconnect all local devices
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => {
          t.stop(); // Fully stop (disconnects hardware)
        });
        localStreamRef.current = null;
      }
      // Clear video elements
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      participantsRef.current.clear();
    };
  }, [sendRoomEvent, stopScreenShare, supabase]);

  const handleRoomEvent = (event: RoomEvent) => {
    if (event.sender === myIdRef.current) return;

    if (event.type === "joined") {
      if (participantsRef.current.size >= 2) {
        void sendRoomEvent({
          type: "room-full",
          sender: myIdRef.current,
          target: event.sender,
          hostId: hostIdRef.current ?? myIdRef.current,
        });

        return;
      }
      addParticipant(event.sender);
      setStatus("Guest already joined");
      void sendRoomEvent({
        type: "joined-ack",
        sender: myIdRef.current,
        hostId: hostIdRef.current ?? myIdRef.current,
      });
      broadcastMediaState(isCameraEnabled, isMicEnabled);
      if (needsResume) {
        setStatus("Peer rejoined, resuming call");
        void resumeCall();
      }

      return;
    }

    if (event.type === "joined-ack") {
      hostIdRef.current = event.hostId;
      addParticipant(event.sender);
      refreshParticipantState();
      if (needsResume) {
        setStatus("Host rejoined, resuming call");
        void resumeCall();
      }

      return;
    }

    if (event.type === "left") {
      removeParticipant(event.sender);
      resetRemoteScreenShare();
      if (event.sender !== myIdRef.current && isCalling) {
        setNeedsResume(true);
        setStatus("Peer disconnected");
        resetRemoteVideo();
      }

      return;
    }

    if (event.type === "room-full") {
      if (event.target === myIdRef.current) {
        hostIdRef.current = event.hostId;
        handleRoomCapacityExceeded();
      }

      return;
    }

    if (event.type === "call-start") {
      setIsRinging(true);
      setStatus("Incoming call");

      return;
    }

    if (event.type === "media-state") {
      setIsRemoteVideoEnabled(event.cameraEnabled);
      setIsRemoteAudioEnabled(event.micEnabled);

      return;
    }

    if (event.type === "screen-share-state") {
      if (event.sender === myIdRef.current) return;
      if (event.isSharing) {
        remoteScreenExpectedRef.current = true;
        remoteScreenStreamIdRef.current = event.screenStreamId ?? null;
        setIsRemoteScreenSharing(true);
        setStatus("Peer started screen share");
      } else {
        resetRemoteScreenShare();
        setStatus("Peer stopped screen share");
      }

      return;
    }

    if (event.type === "call-end") {
      setIsCalling(false);
      setIsRinging(false);
      resetRemoteVideo();
      resetRemoteScreenShare();
      resetLocalMediaState();
      setIncomingOffer(null);
      setIncomingCaller(null);
      setIsAwaitingAnswer(false);
      pendingCandidatesRef.current.length = 0;
      setNeedsResume(false);
      setStatus("Ended the call");
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }

      return;
    }

    if (event.type === "call-declined") {
      setIsAwaitingAnswer(false);
      setIsCalling(false);
      setStatus("Guest declined the call");
      setNeedsResume(false);

      return;
    }
  };

  handleRoomEventRef.current = handleRoomEvent;

  const acceptIncomingCall = async () => {
    if (!incomingOffer) return;

    const pc = createPeerConnection();

    setStatus("Answering call\u2026");
    await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
    await flushPendingCandidates();

    const answer = await pc.createAnswer();

    await pc.setLocalDescription(answer);

    await sendSignal({
      type: "answer",
      sdp: answer,
      sender: myIdRef.current,
    });

    setIsCalling(true);
    setIsRinging(false);
    setIncomingOffer(null);
    setIncomingCaller(null);
    setIsAwaitingAnswer(false);
    setNeedsResume(false);
    setStatus("In call");
  };

  const declineIncomingCall = async () => {
    setIsRinging(false);
    setIncomingOffer(null);
    setIncomingCaller(null);
    setStatus("Call declined");
    await sendRoomEvent({ type: "call-declined", sender: myIdRef.current });
  };

  const joinRoom = useCallback(async () => {
    if (isJoined || isJoiningRef.current) return;

    isJoiningRef.current = true;
    try {
      await ensureLocalStream();
      setStatus("Joining signaling channel…");
      const channel = supabase
        .channel(`${ROOM_CHANNEL_PREFIX}${roomId}`, {
          config: {
            broadcast: {
              self: false,
            },
          },
        })
        .on("broadcast", { event: "signal" }, (event) => {
          const payload = event.payload as SignalMessage;

          handleSignalRef.current?.(payload);
        })
        .on("broadcast", { event: "room-event" }, (event) => {
          const payload = event.payload as RoomEvent;

          handleRoomEventRef.current?.(payload);
        });

      channelRef.current = channel;
      participantsRef.current.clear();
      refreshParticipantState();

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setStatus("Joined room");
          setIsJoined(true);
          addParticipant(myIdRef.current);
          void sendRoomEvent({ type: "joined", sender: myIdRef.current });
          broadcastMediaState(isCameraEnabled, isMicEnabled);
        } else if (status === "CHANNEL_ERROR") {
          setStatus("Channel error");
        } else if (status === "TIMED_OUT") {
          setStatus("Channel timed out");
        } else if (status === "CLOSED") {
          setStatus("Channel closed");
        }
      });
    } catch (err) {
      logError(err);
      setStatus("Cannot access camera/mic");
    } finally {
      isJoiningRef.current = false;
    }
  }, [
    addParticipant,
    broadcastMediaState,
    ensureLocalStream,
    isCameraEnabled,
    isJoined,
    isMicEnabled,
    roomId,
    supabase,
    refreshParticipantState,
  ]);

  useEffect(() => {
    autoJoinAttemptedRef.current = false;
    isJoiningRef.current = false;
    setIsJoined(false);
    setIsCalling(false);
    setIsRinging(false);
    setIncomingOffer(null);
    setIncomingCaller(null);
    setIsAwaitingAnswer(false);
    pendingCandidatesRef.current.length = 0;
    setStatus("Not joined");
    participantsRef.current.clear();
    refreshParticipantState();
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    resetRemoteVideo();
  }, [refreshParticipantState, resetRemoteVideo, roomId, supabase]);

  const startCall = async () => {
    if (!isJoined) {
      setStatus("Join the room first");

      return;
    }

    await ensureLocalStream();
    const pc = createPeerConnection();

    setStatus("Creating the call");

    const offer = await pc.createOffer();

    await pc.setLocalDescription(offer);

    await sendSignal({
      type: "offer",
      sdp: offer,
      sender: myIdRef.current,
    });

    void sendRoomEvent({ type: "call-start", sender: myIdRef.current });

    setIsCalling(true);
    setIsAwaitingAnswer(true);
    setNeedsResume(false);
    setStatus("Waiting for answer");
  };

  const resumeCall = async () => {
    if (!isCalling) return;
    try {
      await ensureLocalStream();
      const pc = createPeerConnection();

      setStatus("Resuming call");

      const offer = await pc.createOffer();

      await pc.setLocalDescription(offer);

      await sendSignal({
        type: "offer",
        sdp: offer,
        sender: myIdRef.current,
      });

      void sendRoomEvent({ type: "call-start", sender: myIdRef.current });

      setIsAwaitingAnswer(true);
      setNeedsResume(false);
    } catch (err) {
      logError("Error resuming call", err);
      setStatus("Cannot resume call");
    }
  };

  const hangUp = () => {
    resetLocalMediaState();
    // Close peer connection
    if (pcRef.current) {
      // Stop all tracks from senders before closing
      pcRef.current.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.stop();
        }
      });
      pcRef.current.close();
      pcRef.current = null;
    }
    localVideoSenderRef.current = null;
    localAudioSenderRef.current = null;

    // Clear remote video
    resetRemoteVideo();
    clearVideoElement(localVideoRef);
    localStreamRef.current = null;

    // Reset state
    setIsCameraEnabled(false);
    setIsMicEnabled(false);
    setIncomingOffer(null);
    setIncomingCaller(null);
    setIsAwaitingAnswer(false);
    pendingCandidatesRef.current.length = 0;
    setIsCalling(false);
    setIsRinging(false);
    setNeedsResume(false);
    setStatus("Call ended");
    broadcastMediaState(false, false);
    void sendRoomEvent({ type: "call-end", sender: myIdRef.current });
  };

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenShare();
      setStatus("Stopped screen share");

      return;
    }
    await startScreenShare();
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  const toggleCamera = useCallback(async () => {
    try {
      const nextEnabled = !isCameraEnabled;
      let stream = localStreamRef.current;
      const pc = pcRef.current;

      if (nextEnabled) {
        // Enable camera: request new video track
        if (!stream) {
          await ensureLocalStream();
          stream = localStreamRef.current;
        } else {
          const existingStream = stream;

          if (!existingStream) {
            return;
          }
          const hasVideo = existingStream.getVideoTracks().length > 0;

          if (!hasVideo) {
            setStatus("Requesting camera access");
            const newStream = await navigator.mediaDevices.getUserMedia({
              video: true,
            });

            newStream.getVideoTracks().forEach((track) => {
              existingStream.addTrack(track);
            });
            // Update peer connection if in call
            if (pc) {
              await updatePeerConnectionTracks();
            }
          }
        }
        setIsCameraEnabled(true);
        broadcastMediaState(true, isMicEnabled);
        setStatus("Camera on");
      } else {
        // Disable camera: stop and remove all video tracks
        const currentStream = stream;

        if (currentStream) {
          const videoTracks = currentStream.getVideoTracks();

          videoTracks.forEach((track) => {
            track.stop(); // Fully stop the track (disconnects hardware)
            currentStream.removeTrack(track);
          });
          // Remove from peer connection if in call
          if (pc) {
            const senders = pc.getSenders();
            const videoSender = senders.find(
              (s) => s.track && s.track.kind === "video",
            );

            if (videoSender) {
              await pc.removeTrack(videoSender);
            }
          }
        }
        setIsCameraEnabled(false);
        broadcastMediaState(false, isMicEnabled);
        setStatus("Camera off");
      }
    } catch (err) {
      logError("Error toggling camera", err);
      setStatus("Cannot toggle camera");
      // Revert state on error
      setIsCameraEnabled(isCameraEnabled);
    }
  }, [
    broadcastMediaState,
    ensureLocalStream,
    isCameraEnabled,
    isMicEnabled,
    updatePeerConnectionTracks,
  ]);

  const toggleMicrophone = useCallback(async () => {
    try {
      const nextEnabled = !isMicEnabled;
      let stream = localStreamRef.current;
      const pc = pcRef.current;

      if (nextEnabled) {
        // Enable microphone: request new audio track
        if (!stream) {
          await ensureLocalStream();
          stream = localStreamRef.current;
        } else {
          const existingStream = stream;

          if (!existingStream) {
            return;
          }
          const hasAudio = existingStream.getAudioTracks().length > 0;

          if (!hasAudio) {
            setStatus("Requesting microphone access");
            const newStream = await navigator.mediaDevices.getUserMedia({
              audio: getNoiseControlledConstraints(),
            });

            newStream.getAudioTracks().forEach((track) => {
              existingStream.addTrack(track);
            });
            // Update peer connection if in call
            if (pc) {
              await updatePeerConnectionTracks();
            }
          }
        }
        const activeTrack = stream?.getAudioTracks()[0] ?? null;

        if (activeTrack) {
          rawAudioTrackRef.current = activeTrack;
        }
        if (isNoiseSuppressionEnabled && activeTrack) {
          await applyNoiseSuppressionPipeline();
        } else {
          setNoiseSuppressionStatus("idle");
        }
        setIsMicEnabled(true);
        broadcastMediaState(isCameraEnabled, true);
        setStatus("Microphone on");
      } else {
        // Disable microphone: stop and remove all audio tracks
        await teardownSpeexSuppression({
          restoreOriginalTrack: false,
          resetStatus: true,
          stopOriginalTrack: true,
        });
        const currentStream = stream;

        if (currentStream) {
          const audioTracks = currentStream.getAudioTracks();

          audioTracks.forEach((track) => {
            track.stop(); // Fully stop the track (disconnects hardware)
            currentStream.removeTrack(track);
          });
          // Remove from peer connection if in call
          if (pc) {
            const senders = pc.getSenders();
            const audioSender = senders.find(
              (s) => s.track && s.track.kind === "audio",
            );

            if (audioSender) {
              await pc.removeTrack(audioSender);
            }
          }
        }
        setIsMicEnabled(false);
        broadcastMediaState(isCameraEnabled, false);
        setStatus("Microphone off");
        setNoiseSuppressionStatus("idle");
      }
    } catch (err) {
      logError("Error toggling microphone", err);
      setStatus("Cannot toggle microphone");
      // Revert state on error
      setIsMicEnabled(isMicEnabled);
    }
  }, [
    applyNoiseSuppressionPipeline,
    broadcastMediaState,
    ensureLocalStream,
    getNoiseControlledConstraints,
    isCameraEnabled,
    isMicEnabled,
    isNoiseSuppressionEnabled,
    teardownSpeexSuppression,
    updatePeerConnectionTracks,
  ]);

  const toggleNoiseSuppression = useCallback(async () => {
    const nextEnabled = !isNoiseSuppressionEnabled;

    setIsNoiseSuppressionEnabled(nextEnabled);

    if (!nextEnabled) {
      await teardownSpeexSuppression({
        restoreOriginalTrack: true,
        resetStatus: true,
      });
      setNoiseSuppressionStatus("idle");

      return;
    }

    if (!isMicEnabled) {
      setStatus("Noise suppression will activate when the mic is on");

      return;
    }

    await applyNoiseSuppressionPipeline();
  }, [
    applyNoiseSuppressionPipeline,
    isMicEnabled,
    isNoiseSuppressionEnabled,
    teardownSpeexSuppression,
  ]);

  const ensureRoomLinkAvailable = useCallback(() => {
    const link =
      roomLink || (typeof window !== "undefined" ? window.location.href : "");

    if (!link) {
      setStatus("Room link unavailable");

      return null;
    }

    return link;
  }, [roomLink]);

  const remoteVideoActive =
    isRemoteVideoEnabled === null ? hasRemoteStream : isRemoteVideoEnabled;
  const remoteAudioActive =
    isRemoteAudioEnabled === null ? hasRemoteStream : isRemoteAudioEnabled;
  const showRemoteStatus = hasRemoteStream || peerPresent;
  const remoteVideoLabel = remoteVideoActive
    ? "Guest video on"
    : "Guest video off";
  const remoteAudioLabel = remoteAudioActive
    ? "Guest audio on"
    : "Guest audio muted";
  const formattedDuration = formatCallDuration(callDuration);
  const immersiveViewportHeight = viewportHeight
    ? `${viewportHeight}px`
    : "100vh";
  const immersiveInsets = isFullscreen
    ? {
        top: "calc(env(safe-area-inset-top, 0px) + 8px)",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        left: "calc(env(safe-area-inset-left, 0px) + 8px)",
        right: "calc(env(safe-area-inset-right, 0px) + 8px)",
      }
    : null;
  const immersivePadding = immersiveInsets ?? {
    top: "24px",
    bottom: "24px",
    left: "16px",
    right: "16px",
  };
  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;

      return next;
    });
  };

  useEffect(() => {
    if (!isMicEnabled) {
      setNoiseSuppressionStatus("idle");
      void teardownSpeexSuppression({
        restoreOriginalTrack: true,
      });

      return;
    }
    if (!isNoiseSuppressionEnabled) {
      setNoiseSuppressionStatus("idle");

      return;
    }

    void applyNoiseSuppressionPipeline();
  }, [
    applyNoiseSuppressionPipeline,
    isMicEnabled,
    isNoiseSuppressionEnabled,
    teardownSpeexSuppression,
  ]);

  useEffect(() => {
    const video = localVideoRef.current;
    const stream = localStreamRef.current;

    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
    }
  }, [
    isFullscreen,
    isScreenSharing,
    isRemoteScreenSharing,
    showRemoteStatus,
    peerPresent,
    hasRemoteStream,
  ]);

  useEffect(() => {
    const video = remoteVideoRef.current;
    const stream = remoteStreamRef.current;

    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
    }
  }, [
    isFullscreen,
    showRemoteStatus,
    peerPresent,
    isScreenSharing,
    isRemoteScreenSharing,
  ]);

  useEffect(() => {
    const video = remoteScreenVideoRef.current;
    const stream = remoteScreenStreamRef.current;

    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
    }
  }, [isFullscreen, isRemoteScreenSharing]);

  useEffect(() => {
    const video = screenShareVideoRef.current;
    const stream = screenShareStreamRef.current;

    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
    }
  }, [isFullscreen, isScreenSharing]);

  return {
    ringtoneRef,
    callAreaRef,
    localVideoRef,
    remoteVideoRef,
    screenShareVideoRef,
    remoteScreenVideoRef,
    status,
    isCalling,
    isAwaitingAnswer,
    peerPresent,
    isJoined,
    isHost,
    peerRole,
    isCameraEnabled,
    isMicEnabled,
    isScreenSharing,
    isRemoteScreenSharing,
    remoteVideoActive,
    remoteAudioActive,
    remoteVideoLabel,
    remoteAudioLabel,
    showRemoteStatus,
    formattedDuration,
    immersiveViewportHeight,
    immersivePadding,
    isFullscreen,
    toggleFullscreen,
    joinRoom,
    startCall,
    resumeCall,
    hangUp,
    toggleScreenShare,
    toggleCamera,
    toggleMicrophone,
    isNoiseSuppressionEnabled,
    noiseSuppressionStatus,
    noiseSuppressionMode,
    toggleNoiseSuppression,
    changeNoiseSuppressionMode,
    acceptIncomingCall,
    declineIncomingCall,
    isRinging,
    incomingCaller,
    incomingOffer,
    roomLink,
    ensureRoomLinkAvailable,
    needsResume,
  };
}
