import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pause, Play, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { IncidentReportingModal } from './IncidentReportingModal';

interface RepairMainInterfaceProps {
  orderId: string;
  workflow: any;
  onWorkflowUpdated: (workflow: any) => void;
}

export function RepairMainInterface({ orderId, workflow, onWorkflowUpdated }: RepairMainInterfaceProps) {
  const { toast } = useToast();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [order, setOrder] = useState<any>(null);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (res.ok) {
          const data = await res.json();
          setOrder(data.order);
        }
      } catch (err) {
        console.error('Error loading order:', err);
      }
    };

    loadOrder();
  }, [orderId]);

  useEffect(() => {
    const calculateElapsedTime = () => {
      if (!workflow?.timerData?.startedAt) return 0;

      const startedAt = new Date(workflow.timerData.startedAt).getTime();
      const now = Date.now();
      const totalPausedMs = workflow.timerData.totalPausedMs || 0;

      let currentPausedMs = 0;
      if (workflow.status === 'paused' && workflow.timerData.pausedAt) {
        const pausedAt = new Date(workflow.timerData.pausedAt).getTime();
        currentPausedMs = now - pausedAt;
      }

      const elapsed = now - startedAt - totalPausedMs - currentPausedMs;
      return Math.max(0, elapsed);
    };

    const interval = setInterval(() => {
      setElapsedTime(calculateElapsedTime());
    }, 500);

    setElapsedTime(calculateElapsedTime());

    return () => clearInterval(interval);
  }, [workflow]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePauseResume = async () => {
    try {
      setLoading(true);

      if (workflow.status === 'in-progress') {
        const response = await fetch(`/api/repair-workflows/${orderId}/pause`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pauseReason: 'Techniker-gesteuerte Pause' }),
        });

        if (!response.ok) throw new Error('Failed to pause repair');

        const data = await response.json();
        onWorkflowUpdated(data.workflow);
        toast({ title: 'Success', description: 'Reparatur pausiert' });
      } else if (workflow.status === 'paused') {
        const response = await fetch(`/api/repair-workflows/${orderId}/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) throw new Error('Failed to resume repair');

        const data = await response.json();
        onWorkflowUpdated(data.workflow);
        toast({ title: 'Success', description: 'Reparatur fortgesetzt' });
      }
    } catch (err: any) {
      console.error('Error pausing/resuming repair:', err);
      toast({ title: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!window.confirm('Sind Sie sicher, dass Sie die Reparatur abschließen möchten?')) {
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`/api/repair-workflows/${orderId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to complete repair');

      const data = await response.json();
      onWorkflowUpdated(data.workflow);
      toast({ title: 'Success', description: 'Reparatur abgeschlossen' });
    } catch (err: any) {
      console.error('Error completing repair:', err);
      toast({ title: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = () => {
    if (workflow.status === 'paused') return 'repair-status-badge paused';
    if (workflow.status === 'incident') return 'repair-status-badge incident';
    return 'repair-status-badge in-progress';
  };

  const getStatusText = () => {
    if (workflow.status === 'paused') return '⏸ Pausiert';
    if (workflow.status === 'incident') return '⚠️ Zwischenfall';
    if (workflow.status === 'completed') return '✓ Abgeschlossen';
    return '▶ In Bearbeitung';
  };

  return (
    <>
      <div className="repair-main-interface">
        <Card className="repair-header-card">
          <div className="repair-timer-display">
            <div className="repair-timer-time">{formatTime(elapsedTime)}</div>
            <div className={`repair-timer-status ${workflow.status === 'paused' ? 'repair-timer-paused' : ''}`}>
              {workflow.status === 'paused' ? '⏸ PAUSIERT' : 'TIMER LÄUFT'}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ marginBottom: '8px' }}>
              <span className={getStatusBadgeClass()}>{getStatusText()}</span>
            </div>
            <div style={{ fontSize: '13px', color: '#636e85', marginTop: '8px' }}>
              <div>
                {order?.deviceBrand} {order?.deviceModel}
              </div>
              <div>Auftrag: {order?.orderNumber}</div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reparatur-Aktionen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="repair-actions-panel">
              <Button
                onClick={handlePauseResume}
                disabled={loading || workflow.status === 'completed'}
                variant={workflow.status === 'paused' ? 'default' : 'outline'}
              >
                {workflow.status === 'paused' ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Fortfahren
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pausieren
                  </>
                )}
              </Button>

              <Button
                onClick={handleComplete}
                disabled={loading || workflow.status === 'completed'}
                variant="outline"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Abschließen
              </Button>

              <Button
                onClick={() => setShowIncidentModal(true)}
                disabled={loading || workflow.status === 'completed'}
                variant="outline"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Zwischenfall
              </Button>
            </div>
          </CardContent>
        </Card>

        {workflow.incidents && workflow.incidents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Gemeldete Zwischenfälle</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {workflow.incidents.map((incident: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px',
                      border: '1px solid #ffebee',
                      borderRadius: '8px',
                      backgroundColor: '#fff5f5',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#d32f2f', marginBottom: '4px' }}>
                      {incident.type.replace(/_/g, ' ').toUpperCase()}
                    </div>
                    <div style={{ fontSize: '14px', color: '#2d3748', marginBottom: '4px' }}>
                      {incident.reason}
                    </div>
                    <div style={{ fontSize: '12px', color: '#636e85' }}>
                      Gemeldet: {new Date(incident.timestamp).toLocaleString('de-DE')}
                    </div>
                    {incident.emailSentAt && (
                      <div style={{ fontSize: '12px', color: '#4caf50', marginTop: '4px' }}>
                        ✓ Kunde informiert
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {showIncidentModal && (
        <IncidentReportingModal
          orderId={orderId}
          onClose={() => setShowIncidentModal(false)}
          onIncidentReported={(updatedWorkflow) => {
            onWorkflowUpdated(updatedWorkflow);
            setShowIncidentModal(false);
            toast({ title: 'Success', description: 'Zwischenfall gemeldet und Kunde informiert' });
          }}
        />
      )}
    </>
  );
}
