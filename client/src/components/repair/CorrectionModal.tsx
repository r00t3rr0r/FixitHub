import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';

interface CorrectionModalProps {
  orderId: string;
  onClose: () => void;
  onApprove: (workflow: any) => void;
}

export function CorrectionModal({ orderId, onClose, onApprove }: CorrectionModalProps) {
  const { toast } = useToast();
  const [internalNotes, setInternalNotes] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(false);
  const [orderChanges, setOrderChanges] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/repair-workflows/${orderId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          internalNotes,
          orderChanges,
          notifyCustomer,
        }),
      });

      if (!response.ok) throw new Error('Failed to approve repair');

      const data = await response.json();
      toast({
        title: 'Success',
        description: 'Reparatur-Workflow gestartet',
      });
      onApprove(data.workflow);
    } catch (err: any) {
      console.error('Error saving corrections:', err);
      toast({
        title: 'Error',
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Änderungen & Bestätigung</DialogTitle>
          <DialogDescription>
            Fügen Sie interne Notizen hinzu und bestätigen Sie die Reparatur.
          </DialogDescription>
        </DialogHeader>

        <div className="correction-modal-content">
          <div className="correction-form-field">
            <label className="correction-form-label">Interne Notiz</label>
            <textarea
              className="correction-form-textarea"
              placeholder="z.B. Spezielle Handlungsschritte, Kundennotizen..."
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="correction-toggle-group">
            <input
              type="checkbox"
              id="notify-customer"
              checked={notifyCustomer}
              onChange={(e) => setNotifyCustomer(e.target.checked)}
              disabled={loading}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="notify-customer" className="correction-toggle-label" style={{ cursor: 'pointer' }}>
              Kunde informieren
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Wird gespeichert...' : 'Speichern & Fortfahren'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
