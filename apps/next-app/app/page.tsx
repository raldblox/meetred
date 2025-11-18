"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const router = useRouter();

  const handleJoinRoom = () => {
    if (roomId) {
      router.push(`/room/${roomId}`);
    }
  };

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="flex flex-col items-center justify-center gap-2">
        <input
          type="text"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Enter Room ID"
          className="px-4 py-2 border rounded-md"
        />
        <button
          onClick={handleJoinRoom}
          className="px-4 py-2 text-white bg-blue-500 rounded-md"
        >
          Join Room
        </button>
      </div>
    </section>
  );
}
