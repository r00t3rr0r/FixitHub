import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import { getOrderById } from '@/api/orders';
import { getAdminOrderById } from '@/api/adminOrders';
import { generateInspectionReport } from '@/api/deviceInspection';
import { DeviceInspectionForm } from '@/components/inspection/DeviceInspectionForm';
import { ArrowLeft, Download, CheckCircle2, AlertCircle } from 'lucide-react';

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
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading inspection workflow...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-red-500">Order not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Device Inspection</h1>
              <p className="text-gray-600">Order {order.orderNumber}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleGenerateReport}
            disabled={generatingReport}
          >
            <Download className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>

        {/* Order Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Order Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Order Number</p>
              <p className="font-semibold">{order.orderNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Device</p>
              <p className="font-semibold">{order.deviceBrand} {order.deviceModel}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Type</p>
              <p className="font-semibold">{order.deviceType}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Customer</p>
              <p className="font-semibold">{order.customerId?.name || 'N/A'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Inspection Form */}
        <DeviceInspectionForm
          orderId={orderId!}
          customerId={order.customerId?._id || order.customerId}
          deviceType={order.deviceType}
          onComplete={handleInspectionComplete}
        />

        {/* Important Notes */}
        <Card className="mt-6 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-base">Important Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p>All inspection fields must be completed before finalizing the repair order.</p>
            </div>
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p>If any tests fail, a customer notification will be automatically created.</p>
            </div>
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p>A PDF report will be generated upon completion with all inspection details.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
