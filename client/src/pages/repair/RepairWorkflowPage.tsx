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
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWorkflow = async () => {
      if (!orderId) {
        setError('Order ID not provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const initResponse = await fetch(`/api/repair-workflows/${orderId}/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: null,
            inspectionId: null,
          }),
        });

        if (!initResponse.ok) {
          throw new Error('Failed to initialize repair workflow');
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

  if (!workflow) {
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
            <p className="repair-workflow-subtitle">Auftrag: {orderId}</p>
          </div>
        </div>

        {workflow.status === 'pending-confirmation' && (
          <DataOverviewScreen
            orderId={orderId!}
            workflow={workflow}
            onWorkflowUpdated={handleWorkflowUpdated}
          />
        )}

        {['in-progress', 'paused', 'completed', 'incident'].includes(workflow.status) && (
          <RepairMainInterface
            orderId={orderId!}
            workflow={workflow}
            onWorkflowUpdated={handleWorkflowUpdated}
          />
        )}
      </div>
    </div>
  );
}
