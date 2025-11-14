// app/room/[roomId]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

type SignalMessage =
  | { type: "offer"; sdp: RTCSessionDescriptionInit; sender: string }
  | { type: "answer"; sdp: RTCSessionDescriptionInit; sender: string }
  | { type: "candidate"; candidate: RTCIceCandidateInit; sender: string };

export default function RoomPage({ roomId }: { roomId: string }) {
  const [status, setStatus] = useState<string>("Not joined");
  const [isJoined, setIsJoined] = useState(false);
  const [isCalling, setIsCalling] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const myIdRef = useRef<string>("");

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pcRef.current) {
        pcRef.current.getSenders().forEach((s) => s.track?.stop());
        pcRef.current.close();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [supabase]);

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
      setStatus("Received offer, creating answer…");
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendSignal({
        type: "answer",
        sdp: answer,
        sender: myIdRef.current,
      });
      setIsCalling(true);
      setStatus("In call");
    } else if (msg.type === "answer") {
      setStatus("Received answer, connecting…");
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      setIsCalling(true);
      setStatus("In call");
    } else if (msg.type === "candidate") {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      } catch (err) {
        console.error("Error adding candidate", err);
      }
    }
  };

  const sendSignal = async (msg: SignalMessage) => {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type: "broadcast",
      event: "signal",
      payload: msg,
    });
  };

  const joinRoom = async () => {
    try {
      setStatus("Requesting camera/mic…");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Join Supabase channel for this room
      setStatus("Joining signaling channel…");
      const channel = supabase
        .channel(`webrtc-room-${roomId}`, {
          config: {
            broadcast: {
              self: false, // we don't need to receive our own messages
            },
          },
        })
        .on("broadcast", { event: "signal" }, (event) => {
          const payload = event.payload as SignalMessage;
          handleSignal(payload);
        });

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setStatus("Joined room. You can start the call.");
          setIsJoined(true);
        } else if (status === "CHANNEL_ERROR") {
          setStatus("Channel error");
        } else if (status === "TIMED_OUT") {
          setStatus("Channel timed out");
        } else if (status === "CLOSED") {
          setStatus("Channel closed");
        }
      });

      channelRef.current = channel;
    } catch (err) {
      console.error(err);
      setStatus("Error: cannot access camera/mic");
    }
  };

  const startCall = async () => {
    if (!isJoined) {
      setStatus("Join the room first");
      return;
    }

    const pc = createPeerConnection();
    setStatus("Creating offer…");

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await sendSignal({
      type: "offer",
      sdp: offer,
      sender: myIdRef.current,
    });

    setIsCalling(true);
    setStatus("Calling… waiting for answer");
  };

  const hangUp = () => {
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((s) => s.track?.stop());
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setIsCalling(false);
    setStatus("Call ended. You’re still in the room.");
  };

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("Room link copied to clipboard");
    } catch {
      setStatus("Unable to copy link");
    }
  };

  const statusAccentColor = isCalling
    ? "bg-emerald-400"
    : isJoined
      ? "bg-amber-400"
      : "bg-slate-400";

  return (
    <main className="flex flex-1 flex-col w-full gap-3 bg-default-50 p-3 min-h-0">
      <header className="flex w-full gap-2 flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-default-500">
            Active room
          </p>
          <h1 className="text-2xl font-semibold text-default-900 break-all">
            {roomId}
          </h1>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-default-200 bg-white/70 px-4 py-2 backdrop-blur">
          <span className="text-xs font-semibold uppercase tracking-wide text-default-500">
            Status
          </span>
          <span className="flex items-center gap-2 text-sm font-medium text-default-900">
            <span className={`h-2.5 w-2.5 rounded-full ${statusAccentColor}`} />
            {status}
          </span>
        </div>
      </header>

      <section className="flex-1 w-full min-h-0 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="relative flex h-full w-full min-h-0 overflow-hidden rounded-2xl border border-default-100 bg-black/70 shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-foreground/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            You
          </span>
        </div>

        <div className="relative flex h-full w-full min-h-0 overflow-hidden rounded-2xl border border-default-100 bg-black/70 shadow-lg">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-foreground/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            Guest
          </span>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-default-100 bg-default-100 p-3 shadow-sm backdrop-blur-sm">
        <button
          onClick={joinRoom}
          disabled={isJoined}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-900"
        >
          {isJoined ? "Joined" : "Join room"}
        </button>

        <button
          onClick={startCall}
          disabled={!isJoined || isCalling}
          className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:bg-blue-900"
        >
          Start call
        </button>

        <button
          onClick={hangUp}
          disabled={!isCalling}
          className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:bg-red-900"
        >
          Hang up
        </button>

        {/* <button
          onClick={copyRoomLink}
          className="rounded-full border border-default-200 px-5 py-2 text-sm font-semibold text-default-700 transition-colors hover:border-default-400 hover:bg-default-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default-300"
        >
          Copy room link
        </button> */}
      </div>
    </main>
  );
}
