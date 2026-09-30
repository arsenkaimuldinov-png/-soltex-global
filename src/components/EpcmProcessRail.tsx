import React, { useEffect, useRef, useState } from 'react';

/**
 * Scroll-linked process visualisation for the /epcm stage list.
 * A thin rail in the page gutter fills as the reader moves through the 8 stages; the stage
 * crossing the middle of the viewport becomes "active" (node emphasised, card top line drawn).
 * The scroll listener is only attached while the list is on screen and is rAF-throttled;
 * the fill is a GPU transform. The rail is decorative (aria-hidden) and hidden below lg.
 */
export function useEpcmProgress(count: number) {
  const listRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);
  const [nodeTops, setNodeTops] = useState<number[]>([]);

  // Node positions follow the real card positions (text length differs per language)
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-epcm-stage]'));
      setNodeTops(cards.map((c) => (c.closest('[data-reveal]') as HTMLElement | null ?? c).offsetTop + 52));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [count]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = list.getBoundingClientRect();
      const center = window.innerHeight * 0.5;
      const p = Math.min(1, Math.max(0, (center - rect.top) / rect.height));
      fillRef.current?.style.setProperty('--p', p.toFixed(4));
      const cards = list.querySelectorAll<HTMLElement>('[data-epcm-stage]');
      let idx = -1;
      cards.forEach((c, i) => {
        if (c.getBoundingClientRect().top < center) idx = i;
      });
      setActive((prev) => (prev === idx ? prev : idx));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        update();
      } else {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
    });
    io.observe(list);
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [count]);

  return { listRef, fillRef, active, nodeTops };
}

export const EpcmProcessRail: React.FC<{
  fillRef: React.RefObject<HTMLDivElement | null>;
  nodeTops: number[];
  active: number;
}> = ({ fillRef, nodeTops, active }) => (
  <div aria-hidden="true" className="hidden lg:block absolute top-0 bottom-0 -start-7 w-px pointer-events-none">
    <div className="absolute inset-0 bg-[#16211B]/12" />
    <div ref={fillRef} className="epcm-rail-fill absolute inset-0 bg-[#0E482C]" />
    {nodeTops.map((top, i) => (
      <span
        key={i}
        style={{ top }}
        className={`epcm-node absolute start-1/2 -translate-x-1/2 rtl:translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-[#16211B]/25 bg-[#FBFBF8] ${
          i === active ? 'is-active' : i < active ? 'is-passed' : ''
        }`}
      />
    ))}
  </div>
);
