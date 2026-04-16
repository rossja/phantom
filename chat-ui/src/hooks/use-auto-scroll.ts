import { useCallback, useEffect, useRef, useState } from "react";

export function useAutoScroll(): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isAtBottom: boolean;
  scrollToBottom: (instant?: boolean) => void;
} {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const userScrolledRef = useRef(false);

  const scrollToBottom = useCallback((instant?: boolean) => {
    const el = containerRef.current;
    if (!el) return;
    userScrolledRef.current = false;
    setIsAtBottom(true);
    el.scrollTo({
      top: el.scrollHeight,
      behavior: instant ? "instant" : "smooth",
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const threshold = 40;

    const handleScroll = (): void => {
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      setIsAtBottom(atBottom);
      if (!atBottom) {
        userScrolledRef.current = true;
      }
    };

    // MutationObserver alone is enough: every new message is a direct
    // child append and every delta update triggers a childList mutation.
    // Previous double-observer (ResizeObserver + MutationObserver) caused
    // two reflows per tick and visible jitter on slower devices.
    let rafPending = false;
    const mutationObserver = new MutationObserver(() => {
      if (!userScrolledRef.current && !rafPending) {
        rafPending = true;
        requestAnimationFrame(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
          rafPending = false;
        });
      }
    });
    mutationObserver.observe(el, { childList: true, subtree: true });

    el.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      el.removeEventListener("scroll", handleScroll);
      mutationObserver.disconnect();
    };
  }, []);

  return { containerRef, isAtBottom, scrollToBottom };
}
