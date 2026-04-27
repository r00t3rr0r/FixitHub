import { useEffect } from 'react';
import { autoTrackPageView, trackEvent } from '../api/tracking';

export function useTracking() {
  useEffect(() => {
    autoTrackPageView();
  }, []);

  return { trackEvent };
}
