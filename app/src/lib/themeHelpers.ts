export type Theme = {
  id: string;
  name: string;
  hue: number;
  /** Saturation % for the accent scale (default 70). Lower = softer. */
  sat?: number;
  bgImage: string;   // url() pointing to /bg/bg-*.png
  bgColor: string;   // solid color fallback when image hasn't loaded
  /** CSS blur radius applied to the background image (default "0px") */
  bgBlur?: string;
  previewBg: string; // plain url() used for the card preview swatch
  /** Color for body text rendered on top of the themed background */
  textOnBg: string;
};

export const THEMES: Theme[] = [
  {
    id: "ocean",
    name: "Ocean",
    hue: 210,
    sat: 70,
    bgImage: "url('/bg/bg-ocean.png')",
    bgColor: "#bfdbfe",
    bgBlur: "0px",
    previewBg: "url('/bg/bg-ocean.png')",
    textOnBg: "#1e3a5f",  // deep navy — readable on blue water
  },
  {
    id: "spring",
    name: "Spring",
    hue: 340,
    sat: 60,
    bgImage: "url('/bg/bg-spring.png')",
    bgColor: "#fce7f3",
    bgBlur: "2px",
    previewBg: "url('/bg/bg-spring.png')",
    textOnBg: "#5b1a38",  // deep rose — readable on pink/blush
  },
  {
    id: "forest",
    name: "Forest",
    hue: 142,
    sat: 55,
    bgImage: "url('/bg/bg-forest.png')",
    bgColor: "#bbf7d0",
    bgBlur: "8px",
    previewBg: "url('/bg/bg-forest.png')",
    textOnBg: "#14371f",  // deep forest green — readable on green bg
  },
  {
    id: "sunset",
    name: "Sunset",
    hue: 22,
    sat: 78,
    bgImage: "url('/bg/bg-sunset.png')",
    bgColor: "#fed7aa",
    bgBlur: "0px",
    previewBg: "url('/bg/bg-sunset.png')",
    textOnBg: "#5c2000",  // deep burnt orange/brown — readable on warm sunset
  },
];

export const DEFAULT_THEME_ID = "ocean";

export function getStoredThemeId(): string {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  return localStorage.getItem("theme-id") ?? DEFAULT_THEME_ID;
}

export function getThemeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const sat = theme.sat ?? 70;
  root.style.setProperty("--accent-hue", String(theme.hue));
  root.style.setProperty("--accent-sat", `${sat}%`);
  root.style.setProperty("--theme-bg-image", theme.bgImage);
  root.style.setProperty("--theme-bg-color", theme.bgColor);
  root.style.setProperty("--theme-bg-blur", theme.bgBlur ?? "0px");
  root.style.setProperty("--text-on-bg", theme.textOnBg);
  localStorage.setItem("theme-id", theme.id);
}
