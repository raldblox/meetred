"use client";

import type { ComponentProps } from "react";

import { Button, Chip } from "@heroui/react";
import { Waves } from "lucide-react";
import clsx from "clsx";

export type NoiseSuppressionStatus =
  | "idle"
  | "pending"
  | "active"
  | "error"
  | "unsupported";

type NoiseSuppressionBaseProps = {
  isMicEnabled: boolean;
  isNoiseSuppressionEnabled: boolean;
  status: NoiseSuppressionStatus;
};

type NoiseSuppressionToggleProps = NoiseSuppressionBaseProps & {
  onToggle: () => void;
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
      onPress={onToggle}
    />
  );
}

type NoiseSuppressionStatusChipProps = NoiseSuppressionBaseProps & {
  className?: string;
};

export function NoiseSuppressionStatusChip({
  isMicEnabled,
  isNoiseSuppressionEnabled,
  status,
  className,
}: NoiseSuppressionStatusChipProps) {
  let chipColor = STATUS_META[status].chipColor;
  let chipLabel = STATUS_META[status].chipLabel;

  if (!isMicEnabled) {
    chipColor = "default";
    chipLabel = "Microphone muted";
  } else if (status === "idle") {
    chipLabel = isNoiseSuppressionEnabled
      ? "Noise suppression ready"
      : "Noise suppression disabled";
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
