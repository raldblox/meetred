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
  ScreenShare,
  Share,
  UserRound,
  Video,
  VideoOff,
} from "lucide-react";

import { useRoomController } from "../(hooks)/useRoomController";

import { ThemeSwitch } from "@/components/theme-switch";

export default function RoomPage({ roomId }: { roomId: string }) {
  const {
    ringtoneRef,
    callAreaRef,
    localVideoRef,
    remoteVideoRef,
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
    hangUp,
    toggleScreenShare,
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

  const screenShareActive = isRemoteScreenSharing || isScreenSharing;
  const showScreenPanel = isRemoteScreenSharing;
  const screenShareChipLabel = isRemoteScreenSharing
    ? "Peer - Screen"
    : isScreenSharing
      ? "You - Screen"
      : "Screen share idle";

  return (
    <main className="flex flex-1 flex-col w-full gap-3 p-3 min-h-0">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={ringtoneRef}
        loop
        preload="auto"
        src="/skype_caller_tone.mp3"
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
              className="font-mono"
              color="default"
              size="sm"
              variant="flat"
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
          isFullscreen
            ? "grid-cols-1"
            : showScreenPanel
              ? "grid-cols-1 md:grid-cols-3"
              : "grid-cols-1 md:grid-cols-2"
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
        {showScreenPanel && (
          <div className="relative flex h-full min-h-[240px] w-full overflow-hidden rounded-2xl bg-default-50 md:col-span-2 aspect-video">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={remoteScreenVideoRef}
              autoPlay
              playsInline
              className={`h-full w-full object-contain ${
                isRemoteScreenSharing ? "opacity-100" : "opacity-0"
              } transition-opacity duration-300`}
            />
            <span className="pointer-events-none absolute bottom-3 left-3">
              <Chip
                className="uppercase tracking-widest bg-foreground/10 text-foreground border-none"
                color={screenShareActive ? "success" : "default"}
                size="sm"
                variant="dot"
              >
                <span className="text-xs font-semibold">
                  {screenShareChipLabel}
                </span>
              </Chip>
            </span>
            {isFullscreen && (
              <Button
                isIconOnly
                aria-label="Exit fullscreen"
                className="absolute bottom-3 right-3 z-30"
                color="default"
                radius="full"
                type="button"
                onPress={toggleFullscreen}
              >
                <Minimize2 size={16} />
              </Button>
            )}
          </div>
        )}
        <div
          className={`${
            isFullscreen
              ? "hidden"
              : showScreenPanel
                ? "flex flex-col gap-3 md:col-span-1"
                : "grid gap-3 md:grid-cols-2 md:col-span-2"
          }`}
        >
          <div className="relative flex h-full w-full min-h-[200px] overflow-hidden rounded-2xl !bg-default-50 aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0" />
            <span className="pointer-events-none absolute bottom-3 left-3">
              <Chip
                className="uppercase tracking-widest text-foreground border-none"
                color={isJoined ? "success" : "default"}
                size="sm"
                variant="dot"
              >
                <span className="text-xs font-semibold">
                  You - {isHost ? "Host" : isJoined ? "Guest" : "Offline"}
                </span>
              </Chip>
            </span>
            {!isCameraEnabled && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
                <UserRound size={48} />
              </div>
            )}
          </div>

          <div className="relative flex h-full w-full min-h-[200px] overflow-hidden rounded-2xl bg-default-50 aspect-video">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0" />
            <span className="pointer-events-none absolute bottom-3 left-3">
              <Chip
                className="uppercase tracking-widest bg-foreground/10 text-foreground border-none"
                color={peerPresent ? "success" : "default"}
                size="sm"
                variant="dot"
              >
                <span className="text-xs font-semibold">
                  {peerPresent
                    ? `Peer - ${peerRole === "host" ? "Host" : "Guest"}`
                    : "Peer - Offline"}
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
                  className="border-1 border-default-100 text-foreground"
                  size="sm"
                  variant="bordered"
                >
                  {remoteVideoActive ? (
                    <Camera className="h-3 w-3" />
                  ) : (
                    <CameraOff className="h-3 w-3" />
                  )}
                </Chip>
                <Chip
                  aria-label={remoteAudioLabel}
                  className="border-1 border-default-100 text-foreground"
                  size="sm"
                  variant="bordered"
                >
                  {remoteAudioActive ? (
                    <Mic className="h-3 w-3" />
                  ) : (
                    <MicOff className="h-3 w-3" />
                  )}
                </Chip>
              </div>
            )}
          </div>
        </div>
      </section>

      <div
        className={`flex relative flex-wrap items-center justify-center gap-3 rounded-2xl bg-default-50 p-3 backdrop-blur-sm ${isFullscreen ? "hidden" : ""}`}
      >
        {isJoined && (
          <div className="flex gap-2">
            <Button
              isIconOnly
              aria-pressed={isCameraEnabled}
              color={isCameraEnabled ? "default" : "secondary"}
              radius="full"
              startContent={
                isCameraEnabled ? <Video size={16} /> : <VideoOff size={16} />
              }
              onPress={toggleCamera}
            />
            <Button
              isIconOnly
              aria-pressed={isMicEnabled}
              color={isMicEnabled ? "default" : "secondary"}
              radius="full"
              startContent={
                isMicEnabled ? <Mic size={16} /> : <MicOff size={16} />
              }
              onPress={toggleMicrophone}
            />
          </div>
        )}

        {!isJoined && (
          <Button
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            onPress={joinRoom}
          >
            Join room
          </Button>
        )}

        {isJoined && !isCalling && !isAwaitingAnswer && (
          <Button
            isIconOnly
            color="primary"
            radius="full"
            size="lg"
            startContent={<PhoneIcon size={16} />}
            onPress={startCall}
          />
        )}

        {isCalling && needsResume && (
          <Button
            isIconOnly
            aria-label="Resume call"
            color="warning"
            radius="full"
            size="lg"
            startContent={<RotateCcw size={16} />}
            onPress={resumeCall}
          />
        )}

        {isCalling && (
          <Button
            isIconOnly
            color="danger"
            radius="full"
            size="lg"
            startContent={<PhoneOff size={16} />}
            onPress={hangUp}
          />
        )}

        <div className="flex gap-2">
          <Button
            isIconOnly
            aria-pressed={isScreenSharing}
            color={isScreenSharing ? "success" : "default"}
            isDisabled={!isJoined}
            radius="full"
            size="md"
            startContent={<ScreenShare size={16} />}
            onPress={toggleScreenShare}
          />
          <Button
            isIconOnly
            color="default"
            radius="full"
            size="md"
            startContent={<Share size={16} />}
            onPress={handleOpenQrModal}
          />
          <Button
            isIconOnly
            aria-pressed={isFullscreen}
            className="border border-default-200 text-default-700"
            radius="full"
            onPress={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </Button>
        </div>
      </div>
      <footer
        className={`flex items-center px-3 gap-3 opacity-50 justify-between w-full ${isFullscreen ? "hidden" : ""}`}
      >
        <Chip
          className="px-3 py-1"
          classNames={{ base: "border-1 !py-0 !px-2" }}
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
          variant="dot"
        >
          {status}
        </Chip>
        <ThemeSwitch />
      </footer>
      <Modal
        hideCloseButton
        backdrop="blur"
        classNames={{
          base: "bg-transparent",
        }}
        isDismissable={false}
        isOpen={isRinging}
        placement="center"
        size="sm"
        onOpenChange={() => undefined}
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
                  isIconOnly
                  className="h-18 w-18"
                  color="danger"
                  radius="full"
                  size="lg"
                  startContent={<PhoneOff className="h-5 w-5" />}
                  onPress={declineIncomingCall}
                />
                <Button
                  isIconOnly
                  className="h-18 w-18 animate-"
                  color="success"
                  disabled={!incomingOffer}
                  radius="full"
                  size="lg"
                  startContent={<PhoneCall className="h-5 w-5" />}
                  onPress={acceptIncomingCall}
                />
              </div>
            </div>
          )}
        </ModalContent>
      </Modal>
      <Modal
        hideCloseButton={false}
        isOpen={isQrModalOpen}
        placement="center"
        size="xs"
        onOpenChange={onQrModalOpenChange}
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
                      <ReactQRCode className="h-full w-full" value={roomLink} />
                    </div>
                  ) : (
                    <div className="flex h-48 w-48 items-center justify-center rounded-2xl border border-default-200 bg-default-100 text-[10px] font-semibold uppercase tracking-widest text-default-500">
                      Preparing link
                    </div>
                  )}

                  <Snippet
                    hideSymbol
                    className="pl-5 bg-transparent uppercase hover:bg-default-100 transition-all"
                    codeString={roomLink}
                    color="primary"
                    hideCopyButton={!roomLink}
                    size="sm"
                    variant="flat"
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
