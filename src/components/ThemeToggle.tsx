"use client";

import { useTheme } from "@/lib/theme";

const BASE =
  "grid size-7 shrink-0 place-items-center rounded-md border border-line bg-panel text-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:text-ink";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={BASE}
    >
      {theme === "light" ? (
        // Moon: light mode is active, clicking goes back to dark.
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        // Sun: dark mode is active, clicking switches to light.
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
