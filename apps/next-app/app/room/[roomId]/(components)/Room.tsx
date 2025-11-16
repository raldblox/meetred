// app/room/[roomId]/page.tsx
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  useDisclosure,
  User,
} from "@heroui/react";
import ReactQRCode from "react-qr-code";
import {
  Camera,
  CameraOff,
  CopyIcon,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  PhoneCall,
  PhoneIcon,
  PhoneIncoming,
  PhoneOff,
  QrCode,
  Share,
  UserRound,
  Video,
  VideoOff,
} from "lucide-react";
import { ThemeSwitch } from "@/components/theme-switch";

type SignalMessage =
  | { type: "offer"; sdp: RTCSessionDescriptionInit; sender: string }
  | { type: "answer"; sdp: RTCSessionDescriptionInit; sender: string }
  | { type: "candidate"; candidate: RTCIceCandidateInit; sender: string };

type RoomEvent =
  | { type: "joined"; sender: string }
  | { type: "joined-ack"; sender: string; hostId: string }
  | { type: "call-start"; sender: string }
  | { type: "call-end"; sender: string }
  | { type: "call-declined"; sender: string }
  | { type: "left"; sender: string }
  | { type: "room-full"; sender: string; target: string; hostId: string }
  | {
      type: "media-state";
      sender: string;
      cameraEnabled: boolean;
      micEnabled: boolean;
    };

export default function RoomPage({ roomId }: { roomId: string }) {
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
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const {
    isOpen: isQrModalOpen,
    onOpen: openQrModal,
    onOpenChange: onQrModalOpenChange,
  } = useDisclosure();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
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
  const [isHost, setIsHost] = useState(false);
  const [peerRole, setPeerRole] = useState<"host" | "guest" | null>(null);

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
    [refreshParticipantState]
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
    [refreshParticipantState]
  );

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }
    setStatus("Requesting access");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    stream.getVideoTracks().forEach((track) => {
      track.enabled = isCameraEnabled;
    });
    stream.getAudioTracks().forEach((track) => {
      track.enabled = isMicEnabled;
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  }, [isCameraEnabled, isMicEnabled]);

  // Create Supabase client (works both server/client, but we only use it in effects)
  const supabase = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_METERED_SUPABASESUPABASE_URL!,
        process.env.NEXT_PUBLIC_METERED_SUPABASESUPABASE_ANON_KEY!
      ),
    []
  );

  // Initialize myId once on client
  useEffect(() => {
    myIdRef.current = crypto.randomUUID();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setRoomLink(window.location.href);
  }, [roomId]);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(document.fullscreenElement === callAreaRef.current);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

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

  const createPeerConnection = () => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }, // public STUN; fine for demo
      ],
    });

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
      if (!remoteVideoRef.current) return;
      const [stream] = event.streams;
      remoteVideoRef.current.srcObject = stream;
      setHasRemoteStream(true);
      if (event.track.kind === "video") {
        setIsRemoteVideoEnabled(!event.track.muted);
        event.track.onmute = () => setIsRemoteVideoEnabled(false);
        event.track.onunmute = () => setIsRemoteVideoEnabled(true);
        event.track.onended = () => setIsRemoteVideoEnabled(false);
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
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current as MediaStream);
      });
    }

    pcRef.current = pc;
    return pc;
  };

  const handleSignal = async (msg: SignalMessage) => {
    // Ignore our own messages
    if (msg.sender === myIdRef.current) return;

    const pc = createPeerConnection();

    if (msg.type === "offer") {
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

  const sendSignal = async (msg: SignalMessage) => {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type: "broadcast",
      event: "signal",
      payload: msg,
    });
  };

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
        console.error("Error adding queued candidate", err);
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
      console.error("Error adding ice candidate", err);
    }
  };

  const clearVideoElement = (ref: RefObject<HTMLVideoElement | null>) => {
    const video = ref.current;
    if (!video) return;
    video.pause();
    video.srcObject = null;
    video.removeAttribute("src");
    try {
      video.load();
    } catch {
      // ignore load errors
    }
    if (ref === remoteVideoRef) {
      setHasRemoteStream(false);
      setIsRemoteVideoEnabled(null);
      setIsRemoteAudioEnabled(null);
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
    [sendRoomEvent]
  );

  const resetLocalMediaState = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.enabled = false;
      });
    }
    setIsCameraEnabled(false);
    setIsMicEnabled(false);
    broadcastMediaState(false, false);
  }, [broadcastMediaState]);

  const handleRoomCapacityExceeded = useCallback(() => {
    setStatus("Room full");
    if (channelRef.current) {
      void sendRoomEvent({ type: "left", sender: myIdRef.current });
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    participantsRef.current.delete(myIdRef.current);
    refreshParticipantState();
    setIsJoined(false);
    setIsCalling(false);
    setIsAwaitingAnswer(false);
    clearVideoElement(remoteVideoRef);
  }, [refreshParticipantState, sendRoomEvent, supabase]);

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
      if (pcRef.current) {
        pcRef.current.getSenders().forEach((s) => s.track?.stop());
        pcRef.current.close();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      participantsRef.current.clear();
    };
  }, [sendRoomEvent, supabase]);

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
      return;
    }

    if (event.type === "joined-ack") {
      hostIdRef.current = event.hostId;
      addParticipant(event.sender);
      refreshParticipantState();
      return;
    }

    if (event.type === "left") {
      removeParticipant(event.sender);
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

    if (event.type === "call-end") {
      setIsCalling(false);
      setIsRinging(false);
      clearVideoElement(remoteVideoRef);
      setIsRemoteVideoEnabled(null);
      setIsRemoteAudioEnabled(null);
      resetLocalMediaState();
      setIncomingOffer(null);
      setIncomingCaller(null);
      setIsAwaitingAnswer(false);
      pendingCandidatesRef.current.length = 0;
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
        .channel(`webrtc-room-${roomId}`, {
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
      console.error(err);
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
    clearVideoElement(remoteVideoRef);
    setIsRemoteVideoEnabled(null);
    setIsRemoteAudioEnabled(null);
  }, [refreshParticipantState, roomId, supabase]);

  useEffect(() => {
    if (isJoined) return;
    if (autoJoinAttemptedRef.current) return;
    autoJoinAttemptedRef.current = true;
    void joinRoom();
  }, [isJoined, joinRoom]);

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
    setStatus("Waiting for answer");
  };

  const hangUp = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    clearVideoElement(remoteVideoRef);
    setIsRemoteVideoEnabled(null);
    setIsRemoteAudioEnabled(null);
    resetLocalMediaState();
    setIncomingOffer(null);
    setIncomingCaller(null);
    setIsAwaitingAnswer(false);
    pendingCandidatesRef.current.length = 0;
    setIsCalling(false);
    setIsRinging(false);
    setStatus("Call ended");
    void sendRoomEvent({ type: "call-end", sender: myIdRef.current });
  };

  const copyRoomLink = async () => {
    const link =
      roomLink ||
      (typeof window !== "undefined" ? window.location.href : undefined);
    if (!link) {
      setStatus("Room link unavailable");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setStatus("Copied to clipboard");
    } catch {
      setStatus("Unable to copy link");
    }
  };

  const handleOpenQrModal = () => {
    if (!roomLink) {
      setStatus("Room link unavailable");
      return;
    }
    openQrModal();
  };

  const toggleCamera = useCallback(async () => {
    try {
      const stream = await ensureLocalStream();
      const nextEnabled = !isCameraEnabled;
      stream.getVideoTracks().forEach((track) => {
        track.enabled = nextEnabled;
      });
      setIsCameraEnabled(nextEnabled);
      broadcastMediaState(nextEnabled, isMicEnabled);
      setStatus(nextEnabled ? "Camera on" : "Camera off");
    } catch (err) {
      console.error("Error toggling camera", err);
      setStatus("Cannot toggle camera");
    }
  }, [broadcastMediaState, ensureLocalStream, isCameraEnabled, isMicEnabled]);

  const toggleMicrophone = useCallback(async () => {
    try {
      const stream = await ensureLocalStream();
      const nextEnabled = !isMicEnabled;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = nextEnabled;
      });
      setIsMicEnabled(nextEnabled);
      broadcastMediaState(isCameraEnabled, nextEnabled);
      setStatus(nextEnabled ? "Microphone on" : "Microphone muted");
    } catch (err) {
      console.error("Error toggling microphone", err);
      setStatus("Cannot toggle microphone");
    }
  }, [broadcastMediaState, ensureLocalStream, isCameraEnabled, isMicEnabled]);

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
  const formattedDuration = `${String(Math.floor(callDuration / 60)).padStart(2, "0")}:${String(callDuration % 60).padStart(2, "0")}`;

  const toggleFullscreen = async () => {
    const area = callAreaRef.current;
    if (!area) return;
    try {
      if (document.fullscreenElement === area) {
        await document.exitFullscreen();
      } else {
        await area.requestFullscreen();
      }
    } catch (err) {
      console.error("Unable to toggle fullscreen", err);
      setStatus("Cannot change fullscreen");
    }
  };

  return (
    <main className="flex flex-1 flex-col w-full gap-3 p-3 min-h-0">
      <audio
        ref={ringtoneRef}
        src="/skype_caller_tone.mp3"
        preload="auto"
        loop
      />
      <header className="flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-default-100 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:bg-black/30">
        <div className="flex flex-col gap-0">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-default-400">
            Room id
          </p>
          <div className="flex items-center gap-0">
            <h1 className="text-2xl font-semibold text-default-900 break-all">
              {roomId}
            </h1>
            <Button
              isIconOnly
              variant="light"
              radius="full"
              size="sm"
              aria-label="Show room QR code"
              onPress={handleOpenQrModal}
            >
              <QrCode size={18} />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* <Chip
            size="sm"
            variant="dot"
            color={peerPresent ? "success" : "default"}
            className="text-xs font-semibold uppercase tracking-widest"
            classNames={{ base: "border border-default-200 px-3" }}
          >
            {peerPresent ? "Ready" : "Waiting"}
          </Chip> */}
          {isCalling && !isAwaitingAnswer && (
            <Chip
              size="sm"
              color="default"
              variant="flat"
              className="font-mono"
            >
              {formattedDuration}
            </Chip>
          )}
        </div>
      </header>

      {isRinging && (
        <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm font-semibold text-amber-900 shadow">
          <div className="flex flex-1 flex-col gap-1">
            <p aria-live="assertive">
              Incoming call{incomingCaller ? ` from ${incomingCaller}` : ""}.
            </p>
            <p className="text-xs font-normal uppercase tracking-wider text-amber-700">
              Consent required: answer or decline to proceed.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onPress={acceptIncomingCall}
              disabled={!incomingOffer}
              className="rounded-full bg-emerald-600 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-900"
            >
              Answer
            </Button>
            <Button
              onPress={declineIncomingCall}
              className="rounded-full bg-slate-900/80 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600"
            >
              Decline
            </Button>
          </div>
        </div>
      )}

      <section
        ref={callAreaRef}
        className={`relative flex-1 w-full min-h-0 grid gap-3 ${isFullscreen ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}
      >
        <div
          className={`${
            isFullscreen
              ? "pointer-events-none absolute top-4 left-4 z-20 h-28 w-36 sm:h-36 sm:w-52"
              : "relative h-full w-full min-h-0"
          } flex overflow-hidden rounded-2xl border border-default-100 bg-black/70 shadow-lg`}
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <span className="pointer-events-none absolute bottom-3 left-3">
            <Chip
              size="sm"
              variant="dot"
              color={isJoined ? "success" : "default"}
              className="uppercase tracking-widest bg-foreground/10 text-white border-none"
            >
              <span className="text-xs font-semibold">
                You · {isHost ? "Host" : isJoined ? "Guest" : "Offline"}
              </span>
            </Chip>
          </span>
          {!isCameraEnabled && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
              <UserRound size={48} />
            </div>
          )}
        </div>

        <div className="relative flex h-full w-full min-h-0 overflow-hidden rounded-2xl border border-default-100 shadow-lg">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <span className="pointer-events-none absolute bottom-3 left-3">
            <Chip
              size="sm"
              variant="dot"
              color={peerPresent ? "success" : "default"}
              className="uppercase tracking-widest bg-foreground/10 text-white border-none"
            >
              <span className="text-xs font-semibold">
                {peerPresent
                  ? `Peer · ${peerRole === "host" ? "Host" : "Guest"}`
                  : "Peer · Offline"}
              </span>
            </Chip>
          </span>
          {showRemoteStatus && !remoteVideoActive && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <UserRound size={48} />
            </div>
          )}
          {showRemoteStatus && (
            <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
              <Chip
                aria-label={remoteVideoLabel}
                size="sm"
                className="border border-default-100 bg-black/60 text-white"
              >
                {remoteVideoActive ? (
                  <Camera className="h-3 w-3" />
                ) : (
                  <CameraOff className="h-3 w-3" />
                )}
              </Chip>
              <Chip
                aria-label={remoteAudioLabel}
                size="sm"
                className="border border-default-100 bg-black/60 text-white"
              >
                {remoteAudioActive ? (
                  <Mic className="h-3 w-3" />
                ) : (
                  <MicOff className="h-3 w-3" />
                )}
              </Chip>
            </div>
          )}
          {isFullscreen && (
            <button
              type="button"
              aria-label="Exit fullscreen"
              onClick={toggleFullscreen}
              className="absolute bottom-3 right-3 z-30 rounded-full bg-black/60 p-2 text-white shadow-md transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Minimize2 size={16} />
            </button>
          )}
        </div>
      </section>

      <div className="flex relative flex-wrap items-center justify-center gap-3 rounded-2xl border border-default-100 bg-default-50 p-3 shadow-sm backdrop-blur-sm">
        {isJoined && (
          <div className="flex gap-2">
            <Button
              isIconOnly
              radius="full"
              aria-pressed={isCameraEnabled}
              startContent={
                isCameraEnabled ? <Video size={16} /> : <VideoOff size={16} />
              }
              onPress={toggleCamera}
              color={isCameraEnabled ? "default" : "secondary"}
            ></Button>
            <Button
              isIconOnly
              radius="full"
              color={isMicEnabled ? "default" : "secondary"}
              aria-pressed={isMicEnabled}
              startContent={
                isMicEnabled ? <Mic size={16} /> : <MicOff size={16} />
              }
              onPress={toggleMicrophone}
            ></Button>
          </div>
        )}

        {!isJoined && (
          <Button
            onPress={joinRoom}
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Join room
          </Button>
        )}

        {isJoined && !isCalling && !isAwaitingAnswer && (
          <Button
            size="lg"
            color="primary"
            isIconOnly
            radius="full"
            onPress={startCall}
            startContent={<PhoneIcon size={16} />}
          ></Button>
        )}

        {/* {isAwaitingAnswer && (
          <p className="text-sm font-medium text-default-700">
            <PhoneIncoming />
          </p>
        )} */}

        {isCalling && (
          <Button
            color="danger"
            size="lg"
            isIconOnly
            radius="full"
            onPress={hangUp}
            startContent={<PhoneOff size={16} />}
          ></Button>
        )}

        <div className="flex gap-2">
          <Button
            radius="full"
            color="default"
            size="md"
            isIconOnly
            startContent={<Share size={16} />}
            onPress={copyRoomLink}
          ></Button>
          <Button
            isIconOnly
            radius="full"
            aria-pressed={isFullscreen}
            onPress={toggleFullscreen}
            className="border border-default-200 text-default-700"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </Button>
        </div>
      </div>
      <footer className="flex items-center p-3 gap-3 opacity-50 justify-between w-full">
        <Chip
          variant="dot"
          color={
            isCalling
              ? "secondary"
              : isAwaitingAnswer
                ? "warning"
                : peerPresent
                  ? "primary"
                  : isJoined
                    ? "success"
                    : "default"
          }
          size="sm"
          classNames={{ base: "border-1 !py-0 !px-2" }}
          className="px-3 py-1"
        >
          {status}
        </Chip>
        <ThemeSwitch />
      </footer>
      <Modal
        size="xs"
        isOpen={isQrModalOpen}
        onOpenChange={onQrModalOpenChange}
        placement="center"
        hideCloseButton={false}
      >
        <ModalContent>
          {(_onClose) => (
            <>
              <ModalHeader className="flex flex-col items-center gap-1">
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-default-400">
                  Share room
                </p>
                <h2 className="text-lg text-center font-semibold text-default-900">
                  Scan to join
                </h2>
              </ModalHeader>
              <ModalBody className="pb-6 pt-0">
                <div className="flex flex-col items-center gap-3">
                  {roomLink ? (
                    <div className="rounded-2xl border border-default-200 bg-white p-4 dark:bg-black/30">
                      <ReactQRCode value={roomLink} className="h-full w-full" />
                    </div>
                  ) : (
                    <div className="flex h-48 w-48 items-center justify-center rounded-2xl border border-default-200 bg-default-100 text-[10px] font-semibold uppercase tracking-widest text-default-500">
                      Preparing link
                    </div>
                  )}
                  <p className="text-xs mt-3 text-default-500 break-all text-center">
                    {roomLink || "Room link ready after loading"}
                  </p>
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </main>
  );
}
