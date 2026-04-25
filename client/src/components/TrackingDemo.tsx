import React from 'react';
import { useTracking } from '../hooks/useTracking';

export default function TrackingDemo() {
  const { trackEvent } = useTracking();

  return (
    <div className="p-4 border rounded bg-white">
      <h2 className="font-bold mb-2">Tracking Demo</h2>
      <button
        className="btn btn-primary mr-2"
        onClick={() => trackEvent('click', { custom_data: { button: 'Demo-Button' } })}
      >
        Klick-Tracking
      </button>
      <form
        onSubmit={e => {
          e.preventDefault();
          trackEvent('form_submit', { custom_data: { form: 'Demo-Form' } });
        }}
      >
        <input type="text" placeholder="Test" className="border p-1 mr-2" />
        <button type="submit" className="btn btn-secondary">Formular senden</button>
      </form>
    </div>
  );
}
