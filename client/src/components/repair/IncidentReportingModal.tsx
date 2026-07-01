import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';

interface IncidentReportingModalProps {
  orderId: string;
  onClose: () => void;
  onIncidentReported: (workflow: any) => void;
}

const INCIDENT_TYPES = [
  { value: 'defective_part', label: 'Defektes E-Teil', description: 'Ein elektronisches Bauteil ist defekt' },
  { value: 'spare_part_needed', label: 'Ersatzteil benötigt', description: 'Ein Ersatzteil wird benötigt' },
  { value: 'customer_info', label: 'Info von Kunde benötigt', description: 'Weitere Informationen vom Kunden erforderlich' },
  { value: 'other_repair', label: 'Andere Reparatur notwendig', description: 'Eine zusätzliche Reparatur wurde entdeckt' },
  { value: 'technician_handover', label: 'An anderen Techniker übergeben', description: 'Reparatur an anderen Techniker übergeben' },
  { value: 'needs_time', label: 'Reparatur braucht Zeit', description: 'Die Reparatur benötigt mehr Zeit' },
];

export function IncidentReportingModal({ orderId, onClose, onIncidentReported }: IncidentReportingModalProps) {
  const { toast } = useToast();
  const [incidentType, setIncidentType] = useState('defective_part');
  const [reason, setReason] = useState('');
  const [additionalData, setAdditionalData] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({ title: 'Error', description: 'Bitte Grund eingeben' });
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`/api/repair-workflows/${orderId}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentType,
          reason,
          additionalData,
        }),
      });

      if (!response.ok) throw new Error('Failed to report incident');

      const data = await response.json();
      onIncidentReported(data.workflow);
    } catch (err: any) {
      console.error('Error reporting incident:', err);
      toast({ title: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Zwischenfall melden</DialogTitle>
          <DialogDescription>
            Wählen Sie den Zwischenfall-Typ und beschreiben Sie das Problem.
          </DialogDescription>
        </DialogHeader>

        <div className="incident-modal-content">
          <div className="incident-select-group">
            <label className="incident-select-label">Zwischenfall-Typ</label>
            <select
              className="incident-form-input"
              value={incidentType}
              onChange={(e) => {
                setIncidentType(e.target.value);
                setAdditionalData({});
              }}
              disabled={loading}
            >
              {INCIDENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: '12px', color: '#636e85', marginTop: '4px' }}>
              {INCIDENT_TYPES.find((t) => t.value === incidentType)?.description}
            </div>
          </div>

          <div className="incident-form-fields">
            <div className="incident-form-field">
              <label className="incident-form-label">Grund / Beschreibung</label>
              <textarea
                className="incident-form-input"
                style={{ minHeight: '80px', resize: 'vertical' }}
                placeholder="Beschreiben Sie das Problem..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={loading}
              />
            </div>

            {incidentType === 'other_repair' && (
              <>
                <div className="incident-form-field">
                  <label className="incident-form-label">Geschätzte Zeit (Minuten)</label>
                  <input
                    type="number"
                    className="incident-form-input"
                    placeholder="z.B. 30"
                    value={additionalData.timeMinutes || ''}
                    onChange={(e) =>
                      setAdditionalData({ ...additionalData, timeMinutes: e.target.value })
                    }
                    disabled={loading}
                  />
                </div>

                <div className="incident-form-field">
                  <label className="incident-form-label">Zusätzliche Kosten (EUR)</label>
                  <input
                    type="number"
                    className="incident-form-input"
                    placeholder="z.B. 25.50"
                    step="0.01"
                    value={additionalData.priceEur || ''}
                    onChange={(e) =>
                      setAdditionalData({ ...additionalData, priceEur: e.target.value })
                    }
                    disabled={loading}
                  />
                </div>
              </>
            )}

            {incidentType === 'needs_time' && (
              <div className="incident-form-field">
                <label className="incident-form-label">Zusätzliche Zeit (Stunden)</label>
                <input
                  type="number"
                  className="incident-form-input"
                  placeholder="z.B. 2"
                  step="0.5"
                  value={additionalData.timeHours || ''}
                  onChange={(e) =>
                    setAdditionalData({ ...additionalData, timeHours: e.target.value })
                  }
                  disabled={loading}
                />
              </div>
            )}

            {incidentType === 'technician_handover' && (
              <div className="incident-form-field">
                <label className="incident-form-label">Techniker oder Notiz</label>
                <input
                  type="text"
                  className="incident-form-input"
                  placeholder="z.B. Name des Technikers oder Notiz"
                  value={additionalData.technicianName || ''}
                  onChange={(e) =>
                    setAdditionalData({ ...additionalData, technicianName: e.target.value })
                  }
                  disabled={loading}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Wird gemeldet...' : 'Zwischenfall melden'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
