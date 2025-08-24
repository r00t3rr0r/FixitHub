import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
  fallbackComponent?: React.ReactNode;
}

export function ImageWithFallback({ 
  src, 
  alt, 
  fallback = 'https://picsum.photos/400/300?random=999', 
  fallbackComponent,
  className,
  ...props 
}: ImageWithFallbackProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(fallback);
    }
  };

  if (hasError && fallbackComponent) {
    return <>{fallbackComponent}</>;
  }

  return (
    <img
      {...props}
      src={imgSrc}
      alt={alt}
      className={cn(className)}
      onError={handleError}
    />
  );
}