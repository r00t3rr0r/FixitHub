import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { autoTrackPageView, trackEvent } from '../api/tracking';

/**
 * PageTracker - Automatic page view tracking component
 * Tracks every route change and sends a page_view event to the backend
 */
export function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    // Track page view on every route change
    autoTrackPageView();
  }, [location.pathname, location.search]);

  useEffect(() => {
    const heartbeatInterval = window.setInterval(() => {
      trackEvent('heartbeat');
    }, 30000);

    return () => window.clearInterval(heartbeatInterval);
  }, []);

  useEffect(() => {
    let lastClickTrackedAt = 0;

    const handleClick = (event: MouseEvent) => {
      const now = Date.now();
      if (now - lastClickTrackedAt < 2000) {
        return;
      }

      lastClickTrackedAt = now;

      const target = event.target as HTMLElement | null;
      trackEvent('click', {
        custom_data: {
          x: event.clientX,
          y: event.clientY,
          tag: target?.tagName || null,
          id: target?.id || null,
          className: target?.className || null,
        },
      });
    };

    document.addEventListener('click', handleClick, { passive: true });
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
