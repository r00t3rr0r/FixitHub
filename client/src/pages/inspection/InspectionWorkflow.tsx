import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import { getOrderById } from '@/api/orders';
import { getAdminOrderById } from '@/api/adminOrders';
import { generateInspectionReport } from '@/api/deviceInspection';
import { DeviceInspectionForm } from '@/components/inspection/DeviceInspectionForm';
import { CommunicationPanel } from '@/components/inspection/CommunicationPanel';
import { ArrowLeft, Download, AlertCircle } from 'lucide-react';
import './InspectionWorkflow.css';

export function InspectionWorkflow() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return;

      try {
        setLoading(true);
        let orderData;

        if (user?.role === 'admin' || user?.role === 'staff') {
          const result = await getAdminOrderById(orderId);
          orderData = result.order;
        } else {
          const result = await getOrderById(orderId);
          orderData = result.order;
        }

        setOrder(orderData);
      } catch (error: any) {
        console.error('Error fetching order:', error);
        toast({ title: 'Error', description: error.message });
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, user?.role]);

  const handleGenerateReport = async () => {
    if (!orderId) return;

    try {
      setGeneratingReport(true);
      const result = await generateInspectionReport(orderId);

      // Download the report
      if (result.reportUrl) {
        const link = document.createElement('a');
        link.href = result.reportUrl;
        link.download = `inspection-report-${orderId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({ title: 'Success', description: 'Report generated and downloaded' });
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({ title: 'Error', description: error.message });
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleInspectionComplete = () => {
    toast({ title: 'Success', description: 'Inspection completed successfully!' });
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="inspection-workflow-loading">
        <div className="inspection-workflow-loading-text">Loading inspection workflow...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="inspection-workflow-loading">
        <div className="inspection-workflow-error-text">Order not found</div>
      </div>
    );
  }

  return (
    <div className="inspection-workflow-page">
      <div className="inspection-workflow-container">
        {/* Header */}
        <div className="inspection-workflow-header">
          <div className="inspection-workflow-header-left">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="inspection-back-button"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="inspection-workflow-title">Device Inspection</h1>
              <p className="inspection-workflow-subtitle">Order {order.orderNumber}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleGenerateReport}
            disabled={generatingReport}
            className="inspection-report-button"
          >
            <Download className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>

        {/* Order Summary */}
        <Card className="inspection-summary-card">
          <CardHeader className="inspection-summary-header">
            <CardTitle className="inspection-summary-title">Order Information</CardTitle>
          </CardHeader>
          <CardContent className="inspection-summary-grid">
            <div className="inspection-summary-item">
              <p className="inspection-summary-label">Order Number</p>
              <p className="inspection-summary-value">{order.orderNumber}</p>
            </div>
            <div className="inspection-summary-item">
              <p className="inspection-summary-label">Device</p>
              <p className="inspection-summary-value">{order.deviceBrand} {order.deviceModel}</p>
            </div>
            <div className="inspection-summary-item">
              <p className="inspection-summary-label">Type</p>
              <p className="inspection-summary-value">{order.deviceType}</p>
            </div>
            <div className="inspection-summary-item">
              <p className="inspection-summary-label">Customer</p>
              <p className="inspection-summary-value">{order.customerId?.name || 'N/A'}</p>
            </div>
            <div className="inspection-summary-item">
              <p className="inspection-summary-label">Booked Repair</p>
              <p className="inspection-summary-value">
                {Array.isArray(order.services) && order.services.length > 0
                  ? order.services.map((service: any) => service?.name || service?.serviceName || String(service)).join(', ')
                  : 'N/A'}
              </p>
            </div>
            <div className="inspection-summary-item">
              <p className="inspection-summary-label">Order Total</p>
              <p className="inspection-summary-value">
                {typeof order.totalCost === 'number' ? `${order.totalCost.toFixed(2)} EUR` : 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Inspection Form and Communication Panel - Two Column Layout */}
        <div className="inspection-content-grid">
          {/* Inspection Form - Left Column (2/3 width) */}
          <div className="inspection-form-column">
            <DeviceInspectionForm
              orderId={orderId!}
              customerId={order.customerId?._id || order.customerId}
              deviceType={order.deviceType}
              bookedRepairs={Array.isArray(order.services)
                ? order.services.map((service: any) => ({
                    name: service?.name || service?.serviceName || String(service),
                    price: typeof service?.price === 'number' ? service.price : undefined,
                    quantity: Number(service?.quantity || 1),
                  }))
                : []}
              orderTotalCost={typeof order.totalCost === 'number' ? order.totalCost : undefined}
              onComplete={handleInspectionComplete}
            />
          </div>

          {/* Communication Panel - Right Column (1/3 width) */}
          <div className="inspection-communication-column">
            <Card className="inspection-communication-card">
              <CardHeader className="inspection-communication-header">
                <CardTitle className="inspection-communication-title">Customer Communication</CardTitle>
                <CardDescription className="inspection-communication-description">Feedback & Updates</CardDescription>
              </CardHeader>
              <CardContent className="inspection-communication-content">
                <CommunicationPanel
                  orderId={orderId!}
                  inspectionId={order._id}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Important Notes */}
        <Card className="inspection-notes-card">
          <CardHeader className="inspection-notes-header">
            <CardTitle className="inspection-notes-title">Important Notes</CardTitle>
          </CardHeader>
          <CardContent className="inspection-notes-content">
            <div className="inspection-note-row">
              <AlertCircle className="inspection-note-icon" />
              <p>All inspection fields must be completed before finalizing the repair order.</p>
            </div>
            <div className="inspection-note-row">
              <AlertCircle className="inspection-note-icon" />
              <p>If any tests fail, a customer notification will be automatically created.</p>
            </div>
            <div className="inspection-note-row">
              <AlertCircle className="inspection-note-icon" />
              <p>A PDF report will be generated upon completion with all inspection details.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
