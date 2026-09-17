import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

const STORAGE_KEY = "culiat-cpss-theme";

function readInitial(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark") return true;
    if (stored === "light") return false;
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

const THEME_FILL_DURATION = 1150;
const THEME_FILL_EASING = "cubic-bezier(0.65, 0, 0.35, 1)";
const THEME_FADE_DURATION = 960;

interface ViewTransitionLike {
  ready: Promise<void>;
}

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => readInitial());
  const isDarkRef = useRef(isDark);

  useEffect(() => {
    const shouldUseDark = readInitial();
    document.documentElement.classList.toggle("dark", shouldUseDark);
    try {
      localStorage.setItem(STORAGE_KEY, shouldUseDark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    try {
      localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, [isDark]);

  const toggleTheme = useCallback((trigger?: HTMLElement | null) => {
    const next = !isDarkRef.current;
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const apply = () => {
      isDarkRef.current = next;
      setIsDark(next);
    };

    const docWithTransition = document as Document & { startViewTransition?: (update: () => void) => ViewTransitionLike };

    if ("startViewTransition" in document && docWithTransition.startViewTransition && !reduce) {
      const transition = docWithTransition.startViewTransition(() => {
        flushSync(() => apply());
      });
      transition.ready
        .then(() => {
          const rect =
            trigger && trigger.isConnected
              ? trigger.getBoundingClientRect()
              : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
          root.animate(
            {
              clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`],
            },
            {
              duration: THEME_FILL_DURATION,
              easing: THEME_FILL_EASING,
              pseudoElement: "::view-transition-new(root)",
            },
          );
        })
        .catch(() => {});
      return;
    }

    root.classList.add("theme-transition");
    apply();
    window.setTimeout(() => {
      root.classList.remove("theme-transition");
    }, THEME_FADE_DURATION);
  }, []);

  return { isDark, toggleTheme };
}
