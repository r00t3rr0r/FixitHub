import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/api/api';
import { getRepairWorkflow } from '@/api/repairWorkflow';
import { DataOverviewScreen } from '@/components/repair/DataOverviewScreen';
import { RepairMainInterface } from '@/components/repair/RepairMainInterface';
import './RepairWorkflow.css';

export function RepairWorkflowPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();

  const [orderId, setOrderId] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Eigener Schluessel fuer das Aufloesen der Auftragsnummer: "Erneut versuchen" nach einem
  // Aufloesungsfehler muss die Aufloesung wiederholen (der Workflow-Ladevorgang braucht orderId).
  const [resolveKey, setResolveKey] = useState(0);

  // Auftragsnummer -> Auftrag (Personal-Liste mit Suche; exakte Nummer). Frueher wurde
  // GET /api/orders?orderNumber= genutzt - das liefert nur die EIGENEN Kundenauftraege.
  useEffect(() => {
    let cancelled = false;
    const resolveOrderId = async () => {
      if (!orderNumber) {
        setError('Keine Auftragsnummer angegeben.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const response = await api.get('/api/admin/orders', { params: { search: orderNumber, limit: 10 } });
        const orders: any[] = Array.isArray(response?.data?.orders) ? response.data.orders : [];
        const match = orders.find((item) => String(item?.orderNumber || '').toLowerCase() === orderNumber.toLowerCase());
        if (!match?._id) {
          throw new Error(`Auftrag ${orderNumber} wurde nicht gefunden.`);
        }
        if (!cancelled) setOrderId(String(match._id));
      } catch (err: any) {
        console.error('Error resolving order:', err);
        if (!cancelled) {
          setError(err?.response?.data?.error || err.message || 'Der Auftrag konnte nicht geladen werden.');
          setLoading(false);
        }
      }
    };
    resolveOrderId();
    return () => { cancelled = true; };
  }, [orderNumber, resolveKey]);

  // Then load the workflow (reines Lesen - aendert nie den Arbeitszustand)
  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    const loadWorkflow = async () => {
      try {
        setLoading(true);
        const data = await getRepairWorkflow(orderId);
        if (cancelled) return;
        setWorkflow(data?.workflow || null);
        setError(null);
      } catch (err: any) {
        console.error('Error loading workflow:', err);
        if (!cancelled) setError(err.message || 'Der Reparatur-Workflow konnte nicht geladen werden.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadWorkflow();
    return () => { cancelled = true; };
  }, [orderId, reloadKey]);

  const handleWorkflowUpdated = (updatedWorkflow: any) => {
    setWorkflow(updatedWorkflow);
  };

  if (loading) {
    return (
      <div className="repair-workflow-loading">
        <div className="repair-workflow-loading-text">Reparatur-Workflow wird geladen …</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="repair-workflow-error">
        <div className="repair-workflow-error-text">{error}</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            onClick={() => {
              setError(null);
              setLoading(true);
              if (orderId) setReloadKey((key) => key + 1);
              else setResolveKey((key) => key + 1);
            }}
            variant="outline"
          >
            Erneut versuchen
          </Button>
          <Button onClick={() => navigate(-1)} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
        </div>
      </div>
    );
  }

  // Ohne aufgeloesten Auftrag gibt es (ausser Laden/Fehler) keinen Zustand - nie "kein Workflow" behaupten.
  if (!orderId) {
    return (
      <div className="repair-workflow-loading">
        <div className="repair-workflow-loading-text">Reparatur-Workflow wird geladen …</div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="repair-workflow-error">
        <div className="repair-workflow-error-text">
          Für diesen Auftrag wurde noch kein Reparatur-Workflow angelegt. Bitte im Auftrag unter „Reparatur-Workflow“ starten.
        </div>
        <Button onClick={() => navigate(`/orders/${orderId}`)} variant="outline">
          Zum Auftrag
        </Button>
      </div>
    );
  }

  return (
    <div className="repair-workflow-page">
      <div className="repair-workflow-container">
        <div className="repair-workflow-header">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="repair-back-button"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="repair-workflow-title">Reparatur-Workflow</h1>
            <p className="repair-workflow-subtitle">Auftrag: {orderNumber}</p>
          </div>
        </div>

        {workflow.status === 'pending-confirmation' && (
          <DataOverviewScreen
            orderId={orderId}
            workflow={workflow}
            onWorkflowUpdated={handleWorkflowUpdated}
          />
        )}

        {['in-progress', 'paused', 'completed', 'incident'].includes(workflow.status) && (
          <RepairMainInterface
            orderId={orderId}
            workflow={workflow}
            onWorkflowUpdated={handleWorkflowUpdated}
          />
        )}
      </div>
    </div>
  );
}
