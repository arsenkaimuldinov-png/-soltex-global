import React, { forwardRef } from 'react';
import { flushSync } from 'react-dom';
import { Link as RouterLink, LinkProps, useHref, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from './I18nProvider';
import { withViewTransition } from '../motion/prefs';

/**
 * Drop-in replacement for react-router's <Link>: internal paths are written locale-less
 * ("/projects") and automatically resolve to the current language ("/ru/projects").
 *
 * Plain left-clicks to another page run inside a View Transition (old page eases out, new
 * page rises in, the header stays put). Modified clicks, new tabs and same-page links keep
 * the browser's default behaviour.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(({ to, onClick, replace, state, target: linkTarget, ...rest }, ref) => {
  const { lp } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const target = typeof to === 'string' ? lp(to) : to;
  const href = useHref(target);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;
    if (linkTarget && linkTarget !== '_self') return;
    if (href === location.pathname + location.search + location.hash) return;
    e.preventDefault();
    withViewTransition(() => {
      flushSync(() => navigate(target, { replace, state }));
    });
  };

  return <RouterLink ref={ref} to={target} replace={replace} state={state} target={linkTarget} onClick={handleClick} {...rest} />;
});

Link.displayName = 'LocalizedLink';
