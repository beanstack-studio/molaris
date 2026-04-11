"use client";

/**
 * Full-viewport background layer.
 * Must be a real DOM element (not a pseudo-element) so z-index: -1
 * reliably sits behind all content without stacking context conflicts.
 * Image, blur, and color are all driven by CSS custom properties set
 * by applyTheme() / ThemeLoader at runtime.
 */
export function ThemeBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        backgroundImage: "var(--theme-bg-image)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        filter: "blur(var(--theme-bg-blur, 0px))",
        transform: "scale(1.08)",
        pointerEvents: "none",
      }}
    />
  );
}
