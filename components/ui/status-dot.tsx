import { cn } from "@/lib/utils";

/** Status dot: pulses green when the engine is reachable, muted when offline. */
export function StatusDot({
  online = true,
  size = 9,
  className,
}: {
  online?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn(
        "inline-block rounded-full",
        online ? "bg-fern animate-status-pulse" : "bg-stone/40",
        className,
      )}
    />
  );
}
