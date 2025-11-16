// app/room/[roomId]/page.tsx
"use client";

import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Snippet,
  useDisclosure,
} from "@heroui/react";
import ReactQRCode from "react-qr-code";
import {
  Camera,
  CameraOff,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  PhoneCall,
  PhoneIcon,
  PhoneOff,
  RotateCcw,
  Share,
  UserRound,
  Video,
  VideoOff,
} from "lucide-react";
import { ThemeSwitch } from "@/components/theme-switch";
import { useRoomController } from "../(hooks)/useRoomController";

export default function RoomPage({ roomId }: { roomId: string }) {
  const {
    ringtoneRef,
    callAreaRef,
    localVideoRef,
    remoteVideoRef,
    status,
    isCalling,
    isAwaitingAnswer,
    peerPresent,
    isJoined,
    isHost,
    peerRole,
    isCameraEnabled,
    isMicEnabled,
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
    hangUp,
    toggleCamera,
    toggleMicrophone,
    acceptIncomingCall,
    declineIncomingCall,
    isRinging,
    incomingCaller,
    incomingOffer,
    roomLink,
    ensureRoomLinkAvailable,
    resumeCall,
    needsResume,
  } = useRoomController(roomId);

  const {
    isOpen: isQrModalOpen,
    onOpen: openQrModal,
    onOpenChange: onQrModalOpenChange,
  } = useDisclosure();

  const handleOpenQrModal = () => {
    if (!ensureRoomLinkAvailable()) {
      return;
    }
    openQrModal();
  };

  return (
    <main className="flex flex-1 flex-col w-full gap-3 p-3 min-h-0">
      <audio
        ref={ringtoneRef}
        src="/skype_caller_tone.mp3"
        preload="auto"
        loop
      />
      <header
        className={`flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-default-100 /80 px-4 py-3  backdrop-blur ${isFullscreen ? "hidden" : ""}`}
      >
        <div className="flex flex-col gap-0">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-default-400">
            Room id
          </p>
          <div className="flex items-center gap-0">
            <h1 className="text-2xl font-semibold text-default-900 break-all">
              {roomId}
            </h1>
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

      <section
        ref={callAreaRef}
        className={`${
          isFullscreen
            ? "fixed inset-0 z-40 w-screen"
            : "relative flex-1 w-full min-h-0"
        } grid gap-3 ${
          isFullscreen ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
        }`}
        style={
          isFullscreen
            ? {
                height: immersiveViewportHeight,
                minHeight: immersiveViewportHeight,
                paddingTop: immersivePadding.top,
                paddingBottom: immersivePadding.bottom,
                paddingLeft: immersivePadding.left,
                paddingRight: immersivePadding.right,
              }
            : undefined
        }
      >
        <div
          className={`${
            isFullscreen
              ? "pointer-events-none bg-default-100 absolute !border-foreground/10 top-4 left-4 z-20 h-28 w-36 sm:h-36 sm:w-52"
              : "relative h-full w-full min-h-0 bg-default-50"
          } flex overflow-hidden rounded-2xl `}
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0" />
          <span className="pointer-events-none absolute bottom-3 left-3">
            <Chip
              size="sm"
              variant="dot"
              color={isJoined ? "success" : "default"}
              className="uppercase tracking-widest bg-foreground/10 text-foreground border-none"
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

        <div className="relative flex h-full w-full min-h-0 overflow-hidden rounded-2xl bg-default-50">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0" />
          <span className="pointer-events-none absolute bottom-3 left-3">
            <Chip
              size="sm"
              variant="dot"
              color={peerPresent ? "success" : "default"}
              className="uppercase tracking-widest bg-foreground/10 text-foreground border-none"
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
                variant="bordered"
                aria-label={remoteVideoLabel}
                size="sm"
                className="border-1 border-default-100 text-foreground"
              >
                {remoteVideoActive ? (
                  <Camera className="h-3 w-3" />
                ) : (
                  <CameraOff className="h-3 w-3" />
                )}
              </Chip>
              <Chip
                variant="bordered"
                aria-label={remoteAudioLabel}
                size="sm"
                className="border-1 border-default-100 text-foreground"
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
            <Button
              isIconOnly
              color="default"
              radius="full"
              type="button"
              aria-label="Exit fullscreen"
              onPress={toggleFullscreen}
              className="absolute bottom-3 right-3 z-30"
            >
              <Minimize2 size={16} />
            </Button>
          )}
        </div>
      </section>

      <div
        className={`flex relative flex-wrap items-center justify-center gap-3 rounded-2xl bg-default-50 p-3 backdrop-blur-sm ${isFullscreen ? "hidden" : ""}`}
      >
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
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
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

        {isCalling && needsResume && (
          <Button
            size="lg"
            color="warning"
            isIconOnly
            radius="full"
            aria-label="Resume call"
            onPress={resumeCall}
            startContent={<RotateCcw size={16} />}
          ></Button>
        )}

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
            onPress={handleOpenQrModal}
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
      <footer
        className={`flex items-center px-3 gap-3 opacity-50 justify-between w-full ${isFullscreen ? "hidden" : ""}`}
      >
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
        size="sm"
        backdrop="blur"
        isOpen={isRinging}
        onOpenChange={() => undefined}
        placement="center"
        hideCloseButton
        isDismissable={false}
        classNames={{
          base: "bg-transparent",
        }}
      >
        <ModalContent className="shadow-none px-6 pb-6 pt-8">
          {() => (
            <div className="flex flex-col items-center gap-5">
              <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-foreground/10 bg-default-800 shadow-inner">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-default-700">
                  <UserRound className="h-14 w-14 text-foreground/80" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-foreground/60">
                  Incoming call
                </p>
                <h3 className="mt-1 text-2xl font-semibold">
                  {incomingCaller ?? "Guest"}
                </h3>
                <p className="text-sm text-foreground/60">
                  wants to start a call with you
                </p>
              </div>
              <div className="flex w-full items-center justify-center gap-6 py-6">
                <Button
                  radius="full"
                  className="h-18 w-18"
                  size="lg"
                  isIconOnly
                  onPress={declineIncomingCall}
                  color="danger"
                  startContent={<PhoneOff className="h-5 w-5" />}
                ></Button>
                <Button
                  radius="full"
                  size="lg"
                  className="h-18 w-18 animate-"
                  isIconOnly
                  onPress={acceptIncomingCall}
                  disabled={!incomingOffer}
                  color="success"
                  startContent={<PhoneCall className="h-5 w-5" />}
                ></Button>
              </div>
            </div>
          )}
        </ModalContent>
      </Modal>
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
                    <div className="rounded-xl border border-default-200 p-3">
                      <ReactQRCode value={roomLink} className="h-full w-full" />
                    </div>
                  ) : (
                    <div className="flex h-48 w-48 items-center justify-center rounded-2xl border border-default-200 bg-default-100 text-[10px] font-semibold uppercase tracking-widest text-default-500">
                      Preparing link
                    </div>
                  )}

                  <Snippet
                    size="sm"
                    color="primary"
                    variant="flat"
                    hideSymbol
                    hideCopyButton={!roomLink}
                    className="pl-5 bg-transparent uppercase hover:bg-default-100 transition-all"
                    codeString={roomLink}
                  >
                    Copy Room Link
                  </Snippet>
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </main>
  );
}
