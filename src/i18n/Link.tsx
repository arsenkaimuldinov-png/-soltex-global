import React, { forwardRef } from 'react';
import { Link as RouterLink, LinkProps } from 'react-router-dom';
import { useI18n } from './I18nProvider';

/**
 * Drop-in replacement for react-router's <Link>: internal paths are written locale-less
 * ("/projects") and automatically resolve to the current language ("/ru/projects").
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(({ to, ...rest }, ref) => {
  const { lp } = useI18n();
  const target = typeof to === 'string' ? lp(to) : to;
  return <RouterLink ref={ref} to={target} {...rest} />;
});

Link.displayName = 'LocalizedLink';
