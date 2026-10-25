// Minimal inline icon set (stroke icons, 24px grid) — avoids an icon dependency.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const VideoIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="6" width="13" height="12" rx="3" />
    <path d="m15.5 10.5 5-3v9l-5-3" />
  </Icon>
);

export const VideoOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 6h2.5a3 3 0 0 1 3 3v1.5l5-3v9l-1.4-.84M15.5 15v0a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V9a3 3 0 0 1 2.2-2.9" />
    <path d="m3 3 18 18" />
  </Icon>
);

export const MicIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </Icon>
);

export const MicOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 9.5V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.5 11a6.4 6.4 0 0 1-.6 2.7M12 17.5V21" />
    <path d="m3 3 18 18" />
  </Icon>
);

export const PhoneOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.6 14.2c-.9-.9-.8-2.4.3-3.1A14.6 14.6 0 0 1 12 8.7c3 0 5.8.9 8.1 2.4 1.1.7 1.2 2.2.3 3.1l-1.2 1.2a1.6 1.6 0 0 1-2 .2l-1.7-1.1a1.6 1.6 0 0 1-.7-1.4v-1a12 12 0 0 0-5.6 0v1c0 .6-.3 1.1-.7 1.4l-1.7 1.1a1.6 1.6 0 0 1-2-.2z" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h13M12 5l7 7-7 7" />
  </Icon>
);

export const LocateIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
  </Icon>
);

export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 5 6v5.5c0 4.3 2.9 8 7 9.5 4.1-1.5 7-5.2 7-9.5V6z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

export const GhostIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 20V10a6 6 0 0 1 12 0v10l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z" />
    <path d="M10 10h.01M14 10h.01" />
  </Icon>
);

export const PinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </Icon>
);

export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Icon>
);

export const EyeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const VeilIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 10c2.5 2.5 5.2 3.5 8 3.5s5.5-1 8-3.5" />
    <path d="m6.5 12.6-1.6 2.4M12 13.5V16.5M17.5 12.6l1.6 2.4" />
  </Icon>
);
