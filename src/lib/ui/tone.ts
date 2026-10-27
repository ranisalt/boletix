import CircleCheck from "@lucide/svelte/icons/circle-check";
import CircleX from "@lucide/svelte/icons/circle-x";
import Clock from "@lucide/svelte/icons/clock";
import Info from "@lucide/svelte/icons/info";
import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

export type Tone = "success" | "warning" | "destructive" | "info" | "neutral";

export const TONE_CLASSES: Record<Tone, string> = {
  success: "border-success text-success",
  warning: "border-warning text-warning",
  destructive: "border-destructive text-destructive",
  info: "border-primary text-primary",
  neutral: "border-border text-muted-foreground",
};

export const TONE_ICONS = {
  success: CircleCheck,
  warning: TriangleAlert,
  destructive: CircleX,
  info: Info,
  neutral: Clock,
};
