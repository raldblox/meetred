"use client";

import type { ComponentProps } from "react";

import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Switch,
} from "@heroui/react";
import clsx from "clsx";
import { CheckCircle2, Waves } from "lucide-react";

export type NoiseSuppressionStatus =
  | "idle"
  | "pending"
  | "active"
  | "error"
  | "unsupported";

export type NoiseSuppressionMode = "system" | "speex";

type NoiseSuppressionPreset = {
  id: NoiseSuppressionMode;
  label: string;
  headline: string;
  description: string;
  subtitle: string;
  badge?: string;
};

export const NOISE_SUPPRESSION_PRESETS: NoiseSuppressionPreset[] = [
  {
    id: "system",
    label: "Browser DSP",
    headline: "WebRTC native stack",
    description:
      "Uses browser-provided echo cancellation, AGC, and noise gates.",
    subtitle: "Zero-config, hardware accelerated",
  },
  {
    id: "speex",
    label: "Speex Pro",
    headline: "@sapphi-red/web-noise-suppressor",
    description:
      "Routes your mic through a SpeexWorkletNode for rnnoise-grade suppression.",
    subtitle: "Great for open offices & devices without Krispr",
    badge: "New",
  },
];

const NOISE_PRESET_MAP: Record<NoiseSuppressionMode, NoiseSuppressionPreset> =
  NOISE_SUPPRESSION_PRESETS.reduce(
    (acc, preset) => {
      acc[preset.id] = preset;

      return acc;
    },
    {} as Record<NoiseSuppressionMode, NoiseSuppressionPreset>,
  );

export const getNoiseSuppressionPreset = (mode: NoiseSuppressionMode) =>
  NOISE_PRESET_MAP[mode];

type NoiseSuppressionBaseProps = {
  isMicEnabled: boolean;
  isNoiseSuppressionEnabled: boolean;
  status: NoiseSuppressionStatus;
};

type NoiseSuppressionToggleProps = NoiseSuppressionBaseProps & {
  onToggle: () => void | Promise<void>;
  className?: string;
};

const STATUS_META: Record<
  NoiseSuppressionStatus,
  { chipLabel: string; chipColor: ComponentProps<typeof Chip>["color"] }
> = {
  idle: { chipLabel: "Noise suppression idle", chipColor: "default" },
  pending: { chipLabel: "Optimizing voice", chipColor: "warning" },
  active: { chipLabel: "Noise suppression active", chipColor: "success" },
  error: { chipLabel: "Noise suppression error", chipColor: "danger" },
  unsupported: {
    chipLabel: "Noise suppression unsupported",
    chipColor: "default",
  },
};

const getToggleColor = (
  props: NoiseSuppressionBaseProps,
): ComponentProps<typeof Button>["color"] => {
  if (!props.isMicEnabled || props.status === "unsupported") {
    return "default";
  }
  if (props.status === "error") {
    return "danger";
  }
  if (props.status === "pending") {
    return "warning";
  }

  return props.isNoiseSuppressionEnabled ? "success" : "default";
};

export function NoiseSuppressionToggle({
  isMicEnabled,
  isNoiseSuppressionEnabled,
  status,
  onToggle,
  className,
}: NoiseSuppressionToggleProps) {
  const ariaLabel = isNoiseSuppressionEnabled
    ? "Disable noise suppression"
    : "Enable noise suppression";
  const isDisabled = !isMicEnabled || status === "unsupported";

  return (
    <Button
      isIconOnly
      aria-label={ariaLabel}
      aria-pressed={isNoiseSuppressionEnabled}
      className={clsx(className)}
      color={getToggleColor({
        isMicEnabled,
        isNoiseSuppressionEnabled,
        status,
      })}
      isDisabled={isDisabled}
      radius="full"
      startContent={<Waves size={16} />}
      onPress={() => {
        void onToggle();
      }}
    />
  );
}

type NoiseSuppressionStatusChipProps = NoiseSuppressionBaseProps & {
  mode: NoiseSuppressionMode;
  className?: string;
};

export function NoiseSuppressionStatusChip({
  isMicEnabled,
  isNoiseSuppressionEnabled,
  status,
  mode,
  className,
}: NoiseSuppressionStatusChipProps) {
  const preset = getNoiseSuppressionPreset(mode);
  let chipColor = STATUS_META[status].chipColor;
  let chipLabel = STATUS_META[status].chipLabel;

  if (!isMicEnabled) {
    chipColor = "default";
    chipLabel = "Microphone muted";
  } else if (status === "idle") {
    chipLabel = isNoiseSuppressionEnabled
      ? `${preset.label} ready`
      : "Noise suppression disabled";
  } else if (status === "active") {
    chipLabel = `${preset.label} active`;
  }

  return (
    <Chip
      className={clsx("px-3 py-1", className)}
      classNames={{ base: "border-1 !py-0 !px-2" }}
      color={chipColor}
      size="sm"
      variant="dot"
    >
      {chipLabel}
    </Chip>
  );
}

type NoiseSuppressionSelectorProps = {
  currentMode: NoiseSuppressionMode;
  isOpen: boolean;
  isEnabled?: boolean;
  statusLabel?: string;
  onModeChange: (mode: NoiseSuppressionMode) => void | Promise<void>;
  onToggle?: (enabled: boolean) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
};

export function NoiseSuppressionSelector({
  currentMode,
  isOpen,
  isEnabled = true,
  statusLabel,
  onModeChange,
  onToggle,
  onOpenChange,
}: NoiseSuppressionSelectorProps) {
  return (
    <Modal
      hideCloseButton={false}
      isOpen={isOpen}
      placement="center"
      size="lg"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-default-500">
                Noise suppression
              </p>
              <span className="text-lg font-semibold text-default-900">
                Choose your voice pipeline
              </span>
            </ModalHeader>
            <ModalBody className="pb-6 space-y-5">
              {onToggle ? (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-content3 bg-content2/40 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-default-500">
                      Status
                    </p>
                    <p className="text-base font-semibold text-default-900">
                      {statusLabel ??
                        (isEnabled ? "Noise suppression enabled" : "Disabled")}
                    </p>
                  </div>
                  <Switch
                    aria-label="Toggle noise suppression"
                    isSelected={isEnabled}
                    size="lg"
                    onValueChange={(value) => {
                      void onToggle(value);
                    }}
                  >
                    {isEnabled ? "Enabled" : "Disabled"}
                  </Switch>
                </div>
              ) : null}
              <div className="grid gap-4">
                {NOISE_SUPPRESSION_PRESETS.map((preset) => {
                  const isActive = preset.id === currentMode;

                  return (
                    <button
                      key={preset.id}
                      className={clsx(
                        "w-full rounded-2xl border px-4 py-3 text-left transition-all",
                        isActive
                          ? "border-primary bg-primary/5"
                          : "border-content3 hover:border-primary/60",
                      )}
                      type="button"
                      onClick={() => {
                        void onModeChange(preset.id);
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.4em] text-default-500">
                            {preset.subtitle}
                          </p>
                          <p className="text-base font-semibold text-default-900">
                            {preset.headline}
                          </p>
                        </div>
                        <Chip
                          color={isActive ? "success" : "default"}
                          size="sm"
                          startContent={
                            isActive ? <CheckCircle2 size={14} /> : null
                          }
                        >
                          {isActive ? "Selected" : "Use"}
                        </Chip>
                      </div>
                      <p className="mt-2 text-sm text-default-600">
                        {preset.description}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-default-500">
                        <span>{preset.label}</span>
                        {preset.badge ? (
                          <Chip color="warning" size="sm" variant="flat">
                            {preset.badge}
                          </Chip>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
