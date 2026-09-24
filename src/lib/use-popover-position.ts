import { useCallback, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

export function usePopoverPosition(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  minimumWidth = 208,
  maximumHeight = 288,
  maximumWidth = Infinity,
  fitViewport = false,
) {
  const [position, setPosition] = useState<CSSProperties>({});
  const update = useCallback(() => {
    if (!anchor.current) return;
    const rect = anchor.current.getBoundingClientRect();
    const margin = 12;
    const gap = 8;
    const width = Math.min(
      Math.max(rect.width, minimumWidth),
      maximumWidth,
      window.innerWidth - margin * 2,
    );
    const below = window.innerHeight - rect.bottom - margin - gap;
    const above = rect.top - margin - gap;
    const placeAbove = below < maximumHeight && above > below;
    if (fitViewport && Math.max(above, below) < maximumHeight) {
      const height = Math.min(maximumHeight, window.innerHeight - margin * 2);
      setPosition({
        left: Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin),
        top: Math.max(margin, Math.min(rect.bottom + gap, window.innerHeight - margin - height)),
        width,
        maxHeight: height,
      });
      return;
    }
    setPosition({
      left: Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin),
      width,
      maxHeight: Math.max(80, Math.min(maximumHeight, placeAbove ? above : below)),
      ...(placeAbove
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    });
  }, [anchor, minimumWidth, maximumHeight, maximumWidth, fitViewport]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, update]);
  return position;
}
