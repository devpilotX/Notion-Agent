import * as React from "react";
import { cn } from "@/lib/utils";

export type IconProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string;
  /** When provided, the icon is exposed to AT with this label. */
  title?: string;
};

/** Shared SVG shell: single-weight, rounded caps, inherits currentColor. */
function Svg({
  size = 20,
  className,
  strokeWidth = 1.7,
  title,
  children,
  ...props
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("shrink-0", className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* ============================== Nature ============================== */

export const Leaf = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 19c0-8 5-14 14-14 0 8-5 14-14 14Z" />
    <path d="M6.5 17.5 16.5 7.5" />
    <path d="M12.5 7.8 13 5.2M9.8 11.2 9 8.8M15.2 10.8 16.4 9" />
  </Svg>
);

export const Fern = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21c.2-6 .6-12 1.4-18" />
    <path d="M12.1 17.5c-1.8-.2-3-1.4-3.4-3.1" />
    <path d="M12.5 13c-1.6-.2-2.7-1.3-3-2.9" />
    <path d="M13 8.8c-1.3-.2-2.2-1.1-2.5-2.5" />
    <path d="M12.3 15.4c1.6.2 2.9-.6 3.6-2.1" />
    <path d="M12.8 11.2c1.4.1 2.5-.6 3.1-1.9" />
    <path d="M13.3 7.2c1.1.1 2-.5 2.5-1.6" />
  </Svg>
);

export const Vine = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20c5-2 3-8 7-9s2-6 7-7" />
    <path d="M18 4c2-1 3 0 3 2-2 1-3 0-3-2Z" />
    <path d="M9.5 12c-2-.6-3 .2-3.4 2 2 .5 3-.3 3.4-2Z" />
  </Svg>
);

export const Sprout = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21c0-4 0-7 0-9" />
    <path d="M12 13C9.2 13 7 11 6.6 8c2.8 0 5 2 5.4 5Z" />
    <path d="M12 12c.4-2.8 2.6-4.6 5.4-4.4C17 10.4 14.8 12.2 12 12Z" />
  </Svg>
);

export const Seed = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5c4 3.5 4 13 0 17-4-4-4-13.5 0-17Z" />
    <path d="M12 9v6" />
  </Svg>
);

export const Sun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.8" />
    <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
  </Svg>
);

export const Moon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 13.4A7.5 7.5 0 1 1 10.6 4a6 6 0 0 0 9.4 9.4Z" />
  </Svg>
);

/* ============================== Functional ============================== */

export const ChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 6 9 12l6 6" />
  </Svg>
);

export const ChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9.5 12 15l6-5.5" />
  </Svg>
);

export const Plus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const ArrowUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
);

export const Paperclip = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.6 6.4 7.8 13.2a2.7 2.7 0 0 0 3.8 3.8L18 10.6a4.5 4.5 0 0 0-6.4-6.4L5 10.8a6.3 6.3 0 0 0 8.9 8.9" />
  </Svg>
);

export const Star = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4.2l2.3 5 5.4.5-4.1 3.6 1.3 5.3L12 15.8 7.1 18.6l1.3-5.3-4.1-3.6 5.4-.5Z" />
  </Svg>
);

export const Share = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6.5" cy="12" r="2.3" />
    <circle cx="17" cy="6" r="2.3" />
    <circle cx="17" cy="18" r="2.3" />
    <path d="M8.5 10.9 15 7.1M8.5 13.1 15 16.9" />
  </Svg>
);

export const More = (p: IconProps) => (
  <Svg {...p} strokeWidth={0}>
    <circle cx="6" cy="12" r="1.6" fill="currentColor" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    <circle cx="18" cy="12" r="1.6" fill="currentColor" />
  </Svg>
);

export const Sliders = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8h16M4 16h16" />
    <circle cx="9" cy="8" r="2.2" fill="var(--paper)" />
    <circle cx="15" cy="16" r="2.2" fill="var(--paper)" />
  </Svg>
);

export const Rotate = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12a7.5 7.5 0 1 1 2.3 5.4" />
    <path d="M4 17.5V12h5.5" />
  </Svg>
);

export const Trash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 7h14" />
    <path d="M9 7V5.4A1.4 1.4 0 0 1 10.4 4h3.2A1.4 1.4 0 0 1 15 5.4V7" />
    <path d="M6.8 7l.7 12a1.6 1.6 0 0 0 1.6 1.5h5.8A1.6 1.6 0 0 0 16.5 19l.7-12" />
    <path d="M10.5 11v6M13.5 11v6" />
  </Svg>
);

export const Pencil = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20l.9-3.6L15.6 5.7a1.7 1.7 0 0 1 2.4 0l.3.3a1.7 1.7 0 0 1 0 2.4L7.6 19.1 4 20z" />
    <path d="M13.8 7.5l2.7 2.7" />
  </Svg>
);

export const Search = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.6-4.6" />
  </Svg>
);

export const Check = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 13l4.5 4.5L19 7" />
  </Svg>
);

export const Close = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const Link = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 14a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L11 8" />
    <path d="M14 10a3.5 3.5 0 0 0-5 0l-2.5 2.5a3.5 3.5 0 0 0 5 5L13 16" />
  </Svg>
);

export const At = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M15.2 12v1.6a2.4 2.4 0 0 0 4.8 0V12a8 8 0 1 0-3 6.2" />
  </Svg>
);

export const Play = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.5 5.6 18 12 7.5 18.4Z" />
  </Svg>
);

export const Chat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 13.5a2 2 0 0 1-2 2H9.5L5 19v-3.5H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
  </Svg>
);

export const Globe = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M4 12h16" />
    <path d="M12 4c2.8 3 2.8 13 0 16-2.8-3-2.8-13 0-16Z" />
  </Svg>
);

export const Help = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M9.7 9.6a2.4 2.4 0 1 1 3.4 2.3c-.8.4-1.1 1-1.1 1.8" />
    <path d="M12 16.3v.01" strokeWidth={2} />
  </Svg>
);

export const Folder = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h3.8l2 2.2h9.2A1.5 1.5 0 0 1 21 9.7V17a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17Z" />
  </Svg>
);

export const Mic = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M6 11a6 6 0 0 0 12 0" />
    <path d="M12 17v3.5M9 20.5h6" />
  </Svg>
);

export const Speaker = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 9.5h3l4-3.5v12l-4-3.5H5Z" />
    <path d="M16 9a4 4 0 0 1 0 6M18.5 7a7 7 0 0 1 0 10" />
  </Svg>
);

export const Stop = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none" />
  </Svg>
);

/* ===================== Provider marks (abstract, custom) ===================== */

export type Provider =
  | "openai"
  | "anthropic"
  | "mistral"
  | "google"
  | "groq"
  | "openrouter"
  | "xai"
  | "deepseek"
  | "cohere"
  | "together";

export function ProviderMark({
  provider,
  size = 18,
  className,
}: {
  provider: Provider;
  size?: number;
  className?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    className: cn("shrink-0", className),
    "aria-hidden": true as const,
  };
  switch (provider) {
    case "anthropic":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <path d="M12 4v16M5 7.5l14 9M19 7.5l-14 9" />
        </svg>
      );
    case "openai":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
          <path d="M12 4.5l6.5 3.75v7.5L12 19.5 5.5 15.75v-7.5z" />
          <path d="M12 4.5v7.5l6.5 3.75M12 12 5.5 15.75" />
        </svg>
      );
    case "mistral":
      return (
        <svg {...common} fill="currentColor">
          <rect x="4" y="6" width="16" height="3" rx="1" opacity="0.55" />
          <rect x="4" y="10.5" width="16" height="3" rx="1" />
          <rect x="4" y="15" width="16" height="3" rx="1" opacity="0.55" />
        </svg>
      );
    case "google":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <path d="M18 8.5A7 7 0 1 0 19 12h-7" />
        </svg>
      );
    case "groq":
      return (
        <svg {...common} fill="currentColor">
          <path d="M13 3 8 13h4l-1 8 8-11h-4l1-7z" />
        </svg>
      );
    case "openrouter":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
          <path d="M5 8h6l4 8h4M5 16h6l2-4" />
          <circle cx="19" cy="8" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "xai":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round">
          <path d="M5 5l14 14M19 5 5 19" />
        </svg>
      );
    case "deepseek":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
          <path d="M4 9c4 0 6 3 10 3s4-3 6-3" />
          <path d="M4 14c4 0 6 3 10 3s4-3 6-3" opacity="0.55" />
        </svg>
      );
    case "cohere":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <circle cx="12" cy="12" r="7" />
          <path d="M9 12h6" />
        </svg>
      );
    case "together":
      return (
        <svg {...common} fill="currentColor">
          <circle cx="9" cy="12" r="4" opacity="0.6" />
          <circle cx="15" cy="12" r="4" />
        </svg>
      );
    default:
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
          <circle cx="9" cy="9" r="4.5" />
          <path d="M12.5 12.5 20 20M16 20h4v-4" />
        </svg>
      );
  }
}
