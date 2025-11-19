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
import { motion } from "framer-motion";
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
    audioLevel,
    latency,
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

  const springTransition = { type: "spring", damping: 28, stiffness: 320 };
  const MotionSection = motion.section;
  const MotionDiv = motion.div;
  const screenShareActive = isRemoteScreenSharing || isScreenSharing;
  const showScreenPanel = screenShareActive;
  const screenShareChipLabel = isRemoteScreenSharing
    ? "Peer - Screen"
    : isScreenSharing
      ? "You - Screen"
      : "Screen share idle";
  const baseCallAreaClass =
    "relative flex-1 w-full min-h-[360px] md:min-h-[70vh]";
  const gridScaffoldClass =
    "grid grid-cols-1 gap-3 auto-rows-[minmax(0,1fr)] items-stretch";

  const renderLocalTile = (extraClasses = "", compact = false) => (
    <div
      className={`relative flex overflow-hidden rounded-2xl bg-default-50 ${
        compact
          ? "aspect-video w-[280px] min-w-[220px] max-w-[320px]"
          : "h-full min-h-[200px] w-full"
      } ${extraClasses}`}
    >
      {}
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
          className="uppercase tracking-widest bg-foreground/10 text-foreground border-none"
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
  );

  const renderRemoteTile = (extraClasses = "", isFullscreenView = false) => {
    if (!isJoined) return null;

    if (!showRemoteStatus) {
      return (
        <div
          className={`flex w-full items-center justify-center rounded-2xl border border-dashed border-default-300 bg-default-50 text-default-500 ${
            isFullscreenView ? "h-full" : "h-full min-h-[200px]"
          } ${extraClasses}`}
        >
          <div className="text-center text-sm font-semibold uppercase tracking-[0.3em]">
            Waiting for peer
          </div>
        </div>
      );
    }

    return (
      <div
        className={`relative flex h-full w-full min-h-[200px] overflow-hidden rounded-2xl bg-default-50 ${extraClasses}`}
      >
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
    );
  };

  const renderScreenSharePanel = (isFullView = false) => {
    const activeVideoRef = isRemoteScreenSharing
      ? remoteScreenVideoRef
      : screenShareVideoRef;

    return (
      <div
        className={`relative flex h-full w-full overflow-hidden rounded-2xl bg-default-50 ${
          isFullView ? "" : "min-h-[240px]"
        }`}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={activeVideoRef}
          autoPlay
          playsInline
          className={`h-full w-full object-contain ${
            screenShareActive ? "opacity-100" : "opacity-0"
          } transition-opacity duration-300`}
          muted={isScreenSharing && !isRemoteScreenSharing}
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
      </div>
    );
  };

  const remoteTile = renderRemoteTile(
    showScreenPanel ? "flex-1 h-auto min-h-0" : "h-full"
  );
  const hasRemoteTile = Boolean(remoteTile);
  const localTileVariant = showScreenPanel ? "flex-1 h-auto min-h-0" : "h-full";
  const gridTemplateClass = showScreenPanel
    ? "md:grid-cols-[2fr_1fr]"
    : hasRemoteTile
      ? "md:grid-cols-2"
      : "grid-cols-1";
  const localTileNode = (
    <MotionDiv
      key="local-tile"
      layout
      className={showScreenPanel ? "flex-1 min-h-0" : "h-full"}
      transition={springTransition}
    >
      {renderLocalTile(localTileVariant)}
    </MotionDiv>
  );
  const remoteTileNode = hasRemoteTile ? (
    <MotionDiv
      key="remote-tile"
      layout
      className={showScreenPanel ? "flex-1 min-h-0" : "h-full"}
      transition={springTransition}
    >
      {remoteTile}
    </MotionDiv>
  ) : null;

  const unifiedLayout = (
    <MotionSection
      ref={callAreaRef}
      layout
      className={`${baseCallAreaClass} ${gridScaffoldClass} transition-all duration-500 ${gridTemplateClass}`}
      transition={springTransition}
    >
      {showScreenPanel && (
        <MotionDiv
          key="screen-share"
          layout
          className="min-h-[220px]"
          transition={springTransition}
        >
          {renderScreenSharePanel()}
        </MotionDiv>
      )}
      {showScreenPanel ? (
        <MotionDiv
          key="stacked-tiles"
          layout
          className="flex h-full min-h-0 flex-row md:flex-col gap-3 overflow-hidden"
          transition={springTransition}
        >
          {localTileNode}
          {remoteTileNode}
        </MotionDiv>
      ) : remoteTileNode ? (
        <>
          {localTileNode}
          {remoteTileNode}
        </>
      ) : (
        localTileNode
      )}
    </MotionSection>
  );

  const callArea = isFullscreen ? (
    <section
      ref={callAreaRef}
      className="fixed inset-0 z-40 w-screen h-screen p-4 grid grid-cols-1 gap-4 bg-default-50/80"
      style={{
        paddingTop: immersivePadding.top,
        paddingBottom: immersivePadding.bottom,
        paddingLeft: immersivePadding.left,
        paddingRight: immersivePadding.right,
      }}
    >
      {showScreenPanel ? (
        <>
          {renderScreenSharePanel(true)}
          <div className="pointer-events-auto absolute bottom-4 right-4 z-40">
            {renderLocalTile(
              "border border-default-200 shadow-2xl bg-background/80",
              true
            )}
          </div>
        </>
      ) : showRemoteStatus ? (
        <>
          {renderRemoteTile("", true)}
          <div className="pointer-events-auto absolute bottom-4 right-4 z-40">
            {renderLocalTile(
              "border border-default-200 shadow-2xl bg-background/80",
              true
            )}
          </div>
        </>
      ) : (
        renderLocalTile()
      )}
    </section>
  ) : (
    unifiedLayout
  );

  return (
    <main className="flex flex-1 flex-col w-full gap-3 p-3 min-h-screen">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={ringtoneRef}
        loop
        preload="auto"
        src="/skype_caller_tone.mp3"
      />
      {!isFullscreen && (
        <header className="flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-default-100 /80 px-4 py-3  backdrop-blur">
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
            {isCalling && !isAwaitingAnswer && (
              <>
                <Chip
                  className="font-mono"
                  color="default"
                  size="sm"
                  variant="flat"
                >
                  {formattedDuration}
                </Chip>
                {latency !== null && (
                  <Chip
                    className="font-mono"
                    color={latency < 100 ? "success" : latency < 200 ? "warning" : "danger"}
                    size="sm"
                    variant="flat"
                  >
                    {latency}ms
                  </Chip>
                )}
              </>
            )}
          </div>
        </header>
      )}

      {callArea}

      {isFullscreen && (
        <div className="pointer-events-none fixed inset-0 z-40 flex flex-col items-start justify-between p-4">
          <div className="pointer-events-auto">
            <Chip
              className="rounded-full bg-background/80 text-foreground"
              size="sm"
            >
              {status}
            </Chip>
          </div>
          <div className="pointer-events-auto self-end flex gap-2">
            <Button
              isIconOnly
              aria-label="Exit fullscreen"
              className="shadow-lg"
              color="default"
              radius="full"
              onPress={toggleFullscreen}
            >
              <Minimize2 size={16} />
            </Button>
          </div>
        </div>
      )}

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
                <motion.div
                  animate={{ scale: isMicEnabled ? 1 + audioLevel * 0.2 : 1 }}
                  transition={{ type: "spring", damping: 10, stiffness: 300 }}
                >
                  {isMicEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                </motion.div>
              }
              onPress={toggleMicrophone}
            />
          </div>
        )}

        {!isJoined && (
          <Button
            className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            size="lg"
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
