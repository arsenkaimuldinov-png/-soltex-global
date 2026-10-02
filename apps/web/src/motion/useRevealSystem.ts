import { useLayoutEffect } from 'react';

/**
 * The single IntersectionObserver behind the Soltex motion system (see src/styles/motion.css).
 *
 * - Registers every [data-reveal] element and every [data-reveal-group].
 * - Auto-applies the two signature reveals inside page content ([data-page]):
 *     framed images (.image-zoom-container)  -> data-reveal="image"
 *     section headings (h2)                  -> data-reveal="mask"
 *   except inside [data-motion="manual"] (hero / page headers have their own choreography),
 *   dialogs and cards (which reveal as a unit).
 * - Members of a group reveal together, staggered by DOM order (--rv-i).
 * - Progress is written to data-rv="in" → "done"; "done" hands transitions back to the
 *   element's own hover styles.
 * A MutationObserver picks up content that appears later (tabs, language switch, lazy data).
 */
const DONE_AFTER_MS = 1900;
const MAX_STAGGER_INDEX = 8;

function markIn(el: HTMLElement) {
  if (el.dataset.rv) return;
  el.dataset.rv = 'in';
  const i = Number(el.style.getPropertyValue('--rv-i') || 0);
  const d = parseFloat(el.style.getPropertyValue('--rv-d') || '0');
  window.setTimeout(() => {
    if (el.dataset.rv === 'in') el.dataset.rv = 'done';
  }, DONE_AFTER_MS + i * 90 + d);
}

function revealGroup(group: HTMLElement) {
  group.dataset.rv = 'in';
  group.querySelectorAll<HTMLElement>('[data-reveal]').forEach(markIn);
}

export function useRevealSystem(routeKey: string) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains('motion-ready')) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          io.unobserve(el);
          if (el.hasAttribute('data-reveal-group')) revealGroup(el);
          else markIn(el);
        }
      },
      { rootMargin: '0px 0px -7% 0px', threshold: 0 }
    );

    const scan = () => {
      // 1. automatic signature reveals inside page content
      document
        .querySelectorAll<HTMLElement>('[data-page] .image-zoom-container:not([data-reveal]), [data-page] h2:not([data-reveal])')
        .forEach((el) => {
          if (el.closest('[data-motion="manual"], [role="dialog"]')) return;
          if (el.tagName === 'H2' && el.closest('.s-card')) return; // card titles reveal with their card
          el.dataset.reveal = el.tagName === 'H2' ? 'mask' : 'image';
        });

      // 2. groups: index members, observe the group once
      document.querySelectorAll<HTMLElement>('[data-reveal-group]:not([data-rv-bound])').forEach((group) => {
        group.dataset.rvBound = '';
        let i = 0;
        group.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
          el.dataset.rvBound = '';
          if (!el.style.getPropertyValue('--rv-i')) el.style.setProperty('--rv-i', String(Math.min(i, MAX_STAGGER_INDEX)));
          i += 1;
        });
        io.observe(group);
      });

      // 3. standalone elements
      document.querySelectorAll<HTMLElement>('[data-reveal]:not([data-rv-bound])').forEach((el) => {
        el.dataset.rvBound = '';
        io.observe(el);
      });
    };

    scan();
    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        scan();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Never leave content hidden for print
    const showAll = () => document.querySelectorAll<HTMLElement>('[data-reveal]').forEach(markIn);
    window.addEventListener('beforeprint', showAll);

    return () => {
      io.disconnect();
      mo.disconnect();
      window.removeEventListener('beforeprint', showAll);
      // Elements that stay mounted must be re-observed by the next effect run
      document.querySelectorAll<HTMLElement>('[data-rv-bound]:not([data-rv])').forEach((el) => delete el.dataset.rvBound);
    };
  }, [routeKey]);
}
