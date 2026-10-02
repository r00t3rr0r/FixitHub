import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pause, Play, CheckCircle, AlertTriangle, Wrench, Euro, Clock } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { IncidentReportingModal } from './IncidentReportingModal';
import { formatEUR } from '@/lib/utils'
import api from '@/api/api';
import { completeRepair, pauseRepair, resumeRepair, describeCustomerNotification, type RepairTransitionResult } from '@/api/repairWorkflow';

interface RepairMainInterfaceProps {
  orderId: string;
  workflow: any;
  onWorkflowUpdated: (workflow: any) => void;
}

const INCIDENT_LABELS: Record<string, string> = {
  defective_part: 'Defektes Ersatzteil',
  spare_part_needed: 'Ersatzteil benötigt',
  customer_info: 'Rückfrage an Kunden',
  other_repair: 'Weitere Reparatur nötig',
  technician_handover: 'Techniker-Übergabe',
  needs_time: 'Mehr Zeit erforderlich',
};

export function RepairMainInterface({ orderId, workflow, onWorkflowUpdated }: RepairMainInterfaceProps) {
  const { toast } = useToast();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [order, setOrder] = useState<any>(null);
  const [inspection, setInspection] = useState<any>(null);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Personal-Lesepfade ueber den gemeinsamen API-Client; ein fehlender Teil blockiert den anderen nicht.
        const [orderRes, inspectionRes] = await Promise.allSettled([
          api.get(`/api/admin/orders/${orderId}`),
          api.get(`/api/device-inspections/${orderId}`),
        ]);

        if (orderRes.status === 'fulfilled') {
          setOrder(orderRes.value?.data?.order || null);
        }

        if (inspectionRes.status === 'fulfilled') {
          setInspection(inspectionRes.value?.data?.inspection || null);
        }
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };

    loadData();
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

  // Ergebnis melden: gespeichert + Auftragsstatus, Warnungen getrennt (z. B. Auftragsstatus nicht aktualisiert).
  const reportResult = (result: RepairTransitionResult, successText: string) => {
    onWorkflowUpdated(result.workflow);
    const statusText = result.orderStatusChanged && result.orderStatus === 'ready-for-pickup'
      ? ' Auftragsstatus: Reparatur abgeschlossen.'
      : '';
    toast({ title: 'Gespeichert', description: `${successText}${statusText}` });
    (result.warnings || []).forEach((warning) => toast({ title: 'Hinweis', description: warning, variant: 'destructive' }));
    const described = describeCustomerNotification(result.customerNotification);
    if (described && described.tone !== 'success') toast({ title: described.title, description: described.description });
  };

  // Ueber den gemeinsamen API-Client (CSRF-Header, deutsche Servermeldungen) statt rohem fetch (NOTIF-6).
  const handlePauseResume = async () => {
    try {
      setLoading(true);
      if (workflow.status === 'in-progress') {
        const result = await pauseRepair(orderId, 'Techniker-gesteuerte Pause');
        reportResult(result, 'Reparatur pausiert.');
      } else if (workflow.status === 'paused' || workflow.status === 'incident') {
        const result = await resumeRepair(orderId);
        reportResult(result, 'Reparatur fortgesetzt.');
      }
    } catch (err: any) {
      console.error('Error pausing/resuming repair:', err);
      toast({ title: 'Nicht gespeichert', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!window.confirm('Reparatur abschließen? Der Auftrag wechselt auf „Reparatur abgeschlossen“. Der Kunde wird hier nicht benachrichtigt (das ist im Auftrag unter „Reparatur-Workflow“ möglich).')) {
      return;
    }

    try {
      setLoading(true);
      const result = await completeRepair(orderId, { notifyCustomer: false });
      reportResult(result, 'Reparatur abgeschlossen.');
    } catch (err: any) {
      console.error('Error completing repair:', err);
      toast({ title: 'Nicht gespeichert', description: err.message, variant: 'destructive' });
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
            <div className={`repair-timer-status ${workflow.status !== 'in-progress' ? 'repair-timer-paused' : ''}`}>
              {workflow.status === 'completed' ? 'ABGESCHLOSSEN' : workflow.status === 'in-progress' ? 'TIMER LÄUFT' : '⏸ ANGEHALTEN'}
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
                variant={workflow.status === 'paused' || workflow.status === 'incident' ? 'default' : 'outline'}
              >
                {workflow.status === 'paused' || workflow.status === 'incident' ? (
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

        {order && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Gebuchte Reparaturen
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Array.isArray(order.services) && order.services.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {order.services.map((service: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        border: '1px solid #d8dce6',
                        borderRadius: '8px',
                        backgroundColor: '#f5f6f8'
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#1a2a5e', marginBottom: '4px' }}>
                        {service?.name || service?.serviceName || `Service ${idx + 1}`}
                      </div>
                      <div style={{ fontSize: '13px', color: '#636e85' }}>
                        {service?.description && (
                          <div style={{ marginBottom: '4px' }}>{service.description}</div>
                        )}
                        {service?.price && (
                          <div style={{ fontWeight: 500 }}>Kosten: {formatEUR(service.price)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#636e85', fontSize: '14px' }}>
                  Keine Services gebucht
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {order && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Euro className="h-5 w-5" />
                Kosten-Übersicht
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '12px', backgroundColor: '#f5f6f8', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#636e85', marginBottom: '4px' }}>
                    Gesamtkosten
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#1a2a5e' }}>
                    {typeof order.totalCost === 'number' ? formatEUR(order.totalCost) : 'N/A'}
                  </div>
                </div>
                {order.discount && (
                  <div style={{ padding: '12px', backgroundColor: '#e8f5e9', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#2e7d32', marginBottom: '4px' }}>
                      Rabatt
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#2e7d32' }}>
                      -{formatEUR(order.discount)}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {inspection && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Inspektionsergebnisse
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {inspection?.externalInspection && (
                  <div style={{ padding: '12px', border: '1px solid #d8dce6', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 700, color: '#1a2a5e', marginBottom: '8px' }}>
                      Äußere Inspektion
                    </div>
                    <div style={{ fontSize: '13px', color: '#636e85', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>Display: {inspection.externalInspection.display?.status || 'N/A'}</div>
                      <div>Rahmen: {inspection.externalInspection.frame?.status || 'N/A'}</div>
                      <div>Rückseite: {inspection.externalInspection.backCover?.status || 'N/A'}</div>
                      <div>Tasten: {inspection.externalInspection.buttons?.status || 'N/A'}</div>
                    </div>
                  </div>
                )}

                {inspection?.deviceTest && (
                  <div style={{ padding: '12px', border: '1px solid #d8dce6', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 700, color: '#1a2a5e', marginBottom: '8px' }}>
                      Gerätetests
                    </div>
                    <div style={{ fontSize: '13px', color: '#636e85', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>Laden: {inspection.deviceTest.charging?.status || 'N/A'}</div>
                      <div>Stromversorgung: {inspection.deviceTest.power?.status || 'N/A'}</div>
                      <div>WiFi: {inspection.deviceTest.wifi?.status || 'N/A'}</div>
                      <div>Hauptkamera: {inspection.deviceTest.mainCamera?.status || 'N/A'}</div>
                    </div>
                  </div>
                )}

                {inspection?.identification && (
                  <div style={{ padding: '12px', border: '1px solid #d8dce6', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 700, color: '#1a2a5e', marginBottom: '8px' }}>
                      Geräteinformationen
                    </div>
                    <div style={{ fontSize: '13px', color: '#636e85', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>Speicher: {inspection.identification.storage || 'N/A'}</div>
                      <div>RAM: {inspection.identification.ram || 'N/A'}</div>
                      <div>OS: {inspection.identification.osVersion || 'N/A'}</div>
                      <div>Aktivierungssperre: {inspection.identification.activationLocked ? 'Ja' : 'Nein'}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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
                      {INCIDENT_LABELS[incident.type] || 'Zwischenfall'}
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
          order={order}
          onClose={() => setShowIncidentModal(false)}
          onIncidentReported={(result) => {
            setShowIncidentModal(false);
            reportResult(result, 'Zwischenfall gemeldet.');
            const described = describeCustomerNotification(result.customerNotification);
            if (described?.tone === 'success') toast({ title: described.title, description: described.description });
          }}
        />
      )}
    </>
  );
}
