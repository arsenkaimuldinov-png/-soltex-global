import React from 'react';

interface SoltexLogoProps {
  variant?: 'dark' | 'light';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const SoltexLogo: React.FC<SoltexLogoProps> = ({
  variant = 'dark',
  className = '',
  size = 'md'
}) => {
  const isLight = variant === 'light';

  const heightClasses = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-11 lg:h-[50px]',
    lg: 'h-12 sm:h-14 lg:h-[56px]'
  };

  const imageSrc = isLight
    ? '/images/soltex-global-logo-transparent.png'
    : '/images/soltex-global-logo.png';

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <img
        src={imageSrc}
        alt="Soltex Global"
        className={`${heightClasses[size]} w-auto object-contain block`}
        style={{ aspectRatio: '1280 / 440' }}
        loading="eager"
      />
    </div>
  );
};
