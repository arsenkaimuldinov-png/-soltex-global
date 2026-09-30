import React from 'react';

type RevealVariant = 'up' | 'fade' | 'mask' | 'image' | 'line' | 'step';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  /** Motion primitive from the Soltex motion system (default: grouped content rise). */
  variant?: RevealVariant;
  /** Reveal children marked with data-reveal together, staggered, instead of one block. */
  group?: boolean;
  /** Position in a sequence (e.g. grid column) — adds one stagger step per index. Inherited by nested reveals. */
  index?: number;
}

/**
 * Declarative wrapper for the Soltex motion system (src/styles/motion.css,
 * src/motion/useRevealSystem.ts). Renders a plain <div data-reveal>; the single global
 * IntersectionObserver reveals it. Without JS or with reduced motion it is simply visible.
 */
export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  className = '',
  delayMs = 0,
  variant = 'up',
  group = false,
  index,
}) => (
  <div
    data-reveal={group ? undefined : variant}
    data-reveal-group={group ? '' : undefined}
    style={
      delayMs || index
        ? ({ ...(delayMs ? { '--rv-d': `${delayMs}ms` } : {}), ...(index ? { '--rv-i': index } : {}) } as React.CSSProperties)
        : undefined
    }
    className={className || undefined}
  >
    {children}
  </div>
);

export const Reveal = ScrollReveal;
