import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { autoTrackPageView, trackEvent } from '../api/tracking';
import { useAdcellConfig } from '@/hooks/useAdcellConfig';

/**
 * PageTracker - Automatic page view tracking component
 * Tracks every route change and sends a page_view event to the backend
 */
// Extend window type for ADCELL tracking
declare global {
  interface Window {
    Adcell?: { Tracking?: { track: () => void } }
  }
}

export function PageTracker() {
  const location = useLocation();
  const adcell = useAdcellConfig();

  useEffect(() => {
    // Track page view on every route change
    autoTrackPageView();
  }, [location.pathname, location.search]);

  useEffect(() => {
    // ADCELL 1st Party Tracking – re-fire on every SPA route change so that
    // the bid/adcref params appended by ADCELL ad links are captured.
  if (window.Adcell?.Tracking?.track && adcell.enabled && adcell.firstPartyEnabled) {
      window.Adcell.Tracking.track();
    }
  }, [location.pathname, location.search, adcell]);

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
