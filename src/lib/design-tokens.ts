/**
 * BrowserOps — Design Tokens & GSAP Animation Presets
 * ═══════════════════════════════════════════════════
 * Central export for all design system constants
 */

// ── Color Palette ──
export const colors = {
  obsidian: {
    DEFAULT: "#0A0A0B",
    light: "#111113",
    surface: "#18181B",
    elevated: "#1E1E22",
    border: "#27272A",
  },
  gold: {
    DEFAULT: "#D4AF37",
    light: "#E5C75E",
    dim: "#A68B2A",
    glow: "rgba(212, 175, 55, 0.25)",
    subtle: "rgba(212, 175, 55, 0.08)",
  },
  cyan: {
    DEFAULT: "#00F5FF",
    light: "#66F9FF",
    dim: "#00B8C0",
    glow: "rgba(0, 245, 255, 0.25)",
    subtle: "rgba(0, 245, 255, 0.06)",
  },
  smoke: {
    DEFAULT: "rgba(20, 20, 22, 0.7)",
    heavy: "rgba(10, 10, 11, 0.85)",
    light: "rgba(30, 30, 34, 0.5)",
  },
  text: {
    primary: "#FAFAFA",
    secondary: "#A1A1AA",
    muted: "#71717A",
    inverse: "#0A0A0B",
  },
  status: {
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    running: "#00F5FF",
    paused: "#D4AF37",
    healed: "#A78BFA",
  },
} as const;

// ── Typography ──
export const typography = {
  fontFamily: {
    sans: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
    mono: "var(--font-geist-mono), 'Fira Code', monospace",
  },
  fontSize: {
    xs: ["0.75rem", { lineHeight: "1rem" }],
    sm: ["0.875rem", { lineHeight: "1.25rem" }],
    base: ["1rem", { lineHeight: "1.5rem" }],
    lg: ["1.125rem", { lineHeight: "1.75rem" }],
    xl: ["1.25rem", { lineHeight: "1.75rem" }],
    "2xl": ["1.5rem", { lineHeight: "2rem" }],
    "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
    "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
    "5xl": ["3rem", { lineHeight: "1" }],
    hero: ["3.75rem", { lineHeight: "1.1" }],
  },
} as const;

// ── GSAP Animation Presets ──
export const animations = {
  /** Staggered 3D flip entrance for bento grid items */
  staggeredFlip: {
    from: {
      rotateX: -90,
      rotateY: 15,
      opacity: 0,
      y: 60,
      scale: 0.9,
      transformPerspective: 1200,
      transformOrigin: "center bottom",
    },
    to: {
      rotateX: 0,
      rotateY: 0,
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.8,
      ease: "power3.out",
      stagger: {
        each: 0.1,
        from: "start",
      },
    },
  },

  /** Lift effect on hover */
  hoverLift: {
    scale: 1.02,
    y: -4,
    duration: 0.3,
    ease: "power2.out",
    boxShadow: "0 16px 48px rgba(0, 0, 0, 0.7)",
  },

  /** Return from hover */
  hoverReturn: {
    scale: 1,
    y: 0,
    duration: 0.3,
    ease: "power2.out",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
  },

  /** Camera zoom page transition */
  pageEnter: {
    from: {
      scale: 0.95,
      opacity: 0,
      y: 20,
    },
    to: {
      scale: 1,
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: "power3.out",
    },
  },

  /** Fade-slide for content sections */
  fadeSlideUp: {
    from: {
      opacity: 0,
      y: 30,
    },
    to: {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: "power2.out",
    },
  },

  /** Glow pulse for alerts/active states */
  glowPulse: {
    keyframes: [
      { boxShadow: "0 0 10px rgba(212, 175, 55, 0.2)" },
      { boxShadow: "0 0 30px rgba(212, 175, 55, 0.5), 0 0 60px rgba(212, 175, 55, 0.2)" },
      { boxShadow: "0 0 10px rgba(212, 175, 55, 0.2)" },
    ],
    duration: 2,
    repeat: -1,
    ease: "sine.inOut",
  },

  /** Nebula background pulse */
  nebulaPulse: {
    opacity: 0.15,
    duration: 3,
    yoyo: true,
    repeat: -1,
    ease: "sine.inOut",
  },
} as const;

// ── Workflow Step Types ──
export type StepType =
  | "open_url"
  | "click_element"
  | "type_text"
  | "wait_for_selector"
  | "extract_text"
  | "extract_table"
  | "download_file"
  | "upload_file"
  | "save_output"
  | "human_intervention";

export const stepTypeConfig: Record<
  StepType,
  { label: string; icon: string; color: string; description: string }
> = {
  open_url: {
    label: "Open URL",
    icon: "Globe",
    color: colors.cyan.DEFAULT,
    description: "Navigate to a webpage",
  },
  click_element: {
    label: "Click Element",
    icon: "MousePointerClick",
    color: colors.gold.DEFAULT,
    description: "Click a selector or text target",
  },
  type_text: {
    label: "Type Text",
    icon: "Keyboard",
    color: colors.gold.DEFAULT,
    description: "Fill input fields",
  },
  wait_for_selector: {
    label: "Wait For Selector",
    icon: "Clock",
    color: colors.cyan.dim,
    description: "Wait until a page element appears",
  },
  extract_text: {
    label: "Extract Text",
    icon: "FileText",
    color: colors.status.healed,
    description: "Extract text from elements",
  },
  extract_table: {
    label: "Extract Table",
    icon: "Table",
    color: colors.status.healed,
    description: "Extract tabular data",
  },
  download_file: {
    label: "Download File",
    icon: "Download",
    color: colors.status.success,
    description: "Capture a browser download",
  },
  upload_file: {
    label: "Upload File",
    icon: "Upload",
    color: colors.status.success,
    description: "Upload a user-provided file",
  },
  save_output: {
    label: "Save Output",
    icon: "Save",
    color: colors.status.success,
    description: "Persist extracted data or files",
  },
  human_intervention: {
    label: "Human Intervention",
    icon: "Hand",
    color: colors.gold.DEFAULT,
    description: "Pause workflow for manual input",
  },
};

// ── Run Status Types ──
export type RunStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export const runStatusConfig: Record<
  RunStatus,
  { label: string; color: string; bgColor: string }
> = {
  queued: {
    label: "Queued",
    color: colors.text.muted,
    bgColor: "rgba(113, 113, 122, 0.15)",
  },
  running: {
    label: "Running",
    color: colors.cyan.DEFAULT,
    bgColor: colors.cyan.subtle,
  },
  paused: {
    label: "Awaiting Input",
    color: colors.gold.DEFAULT,
    bgColor: colors.gold.subtle,
  },
  completed: {
    label: "Completed",
    color: colors.status.success,
    bgColor: "rgba(34, 197, 94, 0.1)",
  },
  failed: {
    label: "Failed",
    color: colors.status.error,
    bgColor: "rgba(239, 68, 68, 0.1)",
  },
  cancelled: {
    label: "Cancelled",
    color: colors.text.muted,
    bgColor: "rgba(113, 113, 122, 0.1)",
  },
};
