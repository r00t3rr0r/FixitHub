import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataOverviewScreen } from '@/components/repair/DataOverviewScreen';
import { RepairMainInterface } from '@/components/repair/RepairMainInterface';
import './RepairWorkflow.css';

export function RepairWorkflowPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [orderId, setOrderId] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // First, resolve orderNumber to orderId
  useEffect(() => {
    const resolveOrderId = async () => {
      if (!orderNumber) {
        setError('Order number not provided');
        setLoading(false);
        return;
      }

      try {
        // Get order by orderNumber to obtain orderId
        const orderRes = await fetch(`/api/orders?orderNumber=${orderNumber}`);
        if (!orderRes.ok) {
          throw new Error('Order not found');
        }

        const orderData = await orderRes.json();
        const order = Array.isArray(orderData) ? orderData[0] : orderData.order;

        if (!order || !order._id) {
          throw new Error('Invalid order data');
        }

        setOrderId(order._id);
      } catch (err: any) {
        console.error('Error resolving order:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    resolveOrderId();
  }, [orderNumber]);

  // Then load the workflow
  useEffect(() => {
    if (!orderId) return;

    const loadWorkflow = async () => {
      try {
        setLoading(true);

        const initResponse = await fetch(`/api/repair-workflows/${orderId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!initResponse.ok) {
          throw new Error('Failed to load repair workflow');
        }

        const initData = await initResponse.json();
        setWorkflow(initData.workflow);
        setError(null);
      } catch (err: any) {
        console.error('Error loading workflow:', err);
        setError(err.message);
        toast({ title: 'Error', description: err.message });
      } finally {
        setLoading(false);
      }
    };

    loadWorkflow();
  }, [orderId]);

  const handleWorkflowUpdated = (updatedWorkflow: any) => {
    setWorkflow(updatedWorkflow);
  };

  if (loading) {
    return (
      <div className="repair-workflow-loading">
        <div className="repair-workflow-loading-text">Reparatur-Workflow wird geladen...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="repair-workflow-error">
        <div className="repair-workflow-error-text">{error}</div>
        <Button onClick={() => navigate(-1)} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
      </div>
    );
  }

  if (!workflow || !orderId) {
    return (
      <div className="repair-workflow-loading">
        <div className="repair-workflow-error-text">Workflow konnte nicht geladen werden</div>
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
