"use client";

export type SignalMessage =
  | { type: "offer"; sdp: RTCSessionDescriptionInit; sender: string }
  | { type: "answer"; sdp: RTCSessionDescriptionInit; sender: string }
  | { type: "candidate"; candidate: RTCIceCandidateInit; sender: string };

export type RoomEvent =
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

export const ROOM_CHANNEL_PREFIX = "webrtc-room-";

export const ICE_SERVER_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
