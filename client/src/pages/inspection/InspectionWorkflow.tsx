import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import { getOrderById } from '@/api/orders';
import { getAdminOrderById } from '@/api/adminOrders';
import { generateInspectionReport } from '@/api/deviceInspection';
import { getOrderServices } from '@/api/orderServices';
import { DeviceInspectionForm } from '@/components/inspection/DeviceInspectionForm';
import { InspectionResultsDisplay } from '@/components/inspection/InspectionResultsDisplay';
import { CommunicationPanel } from '@/components/inspection/CommunicationPanel';
import { ArrowLeft, Download, AlertCircle, ExternalLink, MessageCircle } from 'lucide-react';
import './InspectionWorkflow.css';

export function InspectionWorkflow() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [order, setOrder] = useState<any>(null);
  const [inspectionId, setInspectionId] = useState<string>('');
  // Gebuchte Leistungen MIT Preis: GET /api/orders/:id liefert nur die Namen - wie im Auftragsdetail
  // kommen die Positionen aus /api/order-services (gleiche Quelle, gleiche Beträge).
  const [repairServices, setRepairServices] = useState<any[] | null>(null);
  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    getOrderServices(orderId)
      .then((response: any) => { if (!cancelled) setRepairServices(Array.isArray(response?.services) ? response.services : []); })
      .catch(() => { if (!cancelled) setRepairServices(null); });
    return () => { cancelled = true; };
  }, [orderId]);
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
        // The communication panel needs the INSPECTION id (it used to receive the order id). It is
        // reported by DeviceInspectionForm once the inspection is loaded - or created, on a first
        // visit, where a GET here would still find none.
      } catch (error: any) {
        console.error('Error fetching order:', error);
        toast({
          variant: 'destructive',
          title: 'Fehler',
          description: error?.message || 'Der Auftrag konnte nicht geladen werden.',
        });
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
      const reportUrl = typeof result.reportUrl === 'string' ? result.reportUrl : '';

      // Download the report
      if (reportUrl) {
        const link = document.createElement('a');
        link.href = reportUrl;
        link.download = `inspection-report-${orderId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({ title: 'Erfolg', description: 'Der Prüfbericht wurde erstellt und heruntergeladen.' });
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error?.message || 'Der Prüfbericht konnte nicht erstellt werden.',
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleInspectionComplete = () => {
    toast({ title: 'Erfolg', description: 'Die Inspektion wurde abgeschlossen.' });
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="inspection-workflow-loading">
        <div className="inspection-workflow-loading-text">Inspektion wird geladen …</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="inspection-workflow-loading">
        <div className="inspection-workflow-error-text">Auftrag nicht gefunden</div>
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
              aria-label="Zurück zur vorherigen Seite"
              title="Zurück"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <div>
              <h1 className="inspection-workflow-title">Geräteinspektion</h1>
              <p className="inspection-workflow-subtitle">Auftrag {order.orderNumber}</p>
            </div>
          </div>
          <div className="inspection-header-actions">
            <Button asChild variant="outline" className="inspection-report-button">
              <Link to={`/orders/${orderId}`}>
                <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
                Zum Auftrag
              </Link>
            </Button>
            <Button asChild variant="outline" className="inspection-report-button inspection-jump-to-communication">
              <a href="#kundenkommunikation">
                <MessageCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                Kundenkommunikation
              </a>
            </Button>
            {/* Storniert: kein Bericht aus der Kopfzeile (der Server lehnt ihn für nicht abgeschlossene
                Inspektionen ab); ein abgeschlossener Bericht bleibt unten über die Nur-Lese-Ansicht abrufbar. */}
            {order.status !== 'cancelled' && (
            <Button
              variant="outline"
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="inspection-report-button"
            >
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              {generatingReport ? 'Wird erstellt …' : 'Prüfbericht erstellen'}
            </Button>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <Card className="inspection-summary-card">
          <CardHeader className="inspection-summary-header">
            <CardTitle className="inspection-summary-title">Auftragsinformationen</CardTitle>
          </CardHeader>
          <CardContent className="inspection-summary-grid">
            <div className="inspection-summary-item">
              <p className="inspection-summary-label">Auftragsnummer</p>
              <p className="inspection-summary-value">{order.orderNumber}</p>
            </div>
            <div className="inspection-summary-item">
              <p className="inspection-summary-label">Gerät</p>
              <p className="inspection-summary-value">{order.deviceBrand} {order.deviceModel}</p>
            </div>
            <div className="inspection-summary-item">
              <p className="inspection-summary-label">Gerätetyp</p>
              <p className="inspection-summary-value">{order.deviceType}</p>
            </div>
            <div className="inspection-summary-item">
              <p className="inspection-summary-label">Kunde</p>
              <p className="inspection-summary-value">{order.customerId?.name || 'Nicht angegeben'}</p>
            </div>
            <div className="inspection-summary-item">
              <p className="inspection-summary-label">Gebuchte Reparatur</p>
              <p className="inspection-summary-value">
                {Array.isArray(order.services) && order.services.length > 0
                  ? order.services.map((service: any) => service?.name || service?.serviceName || String(service)).join(', ')
                  : 'Nicht angegeben'}
              </p>
            </div>
            <div className="inspection-summary-item">
              <p className="inspection-summary-label">Auftragssumme</p>
              <p className="inspection-summary-value">
                {typeof order.totalCost === 'number'
                  ? order.totalCost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
                  : 'Nicht angegeben'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Inspection Form and Communication Panel - Two Column Layout */}
        <div className="inspection-content-grid">
          {/* Inspection Form - Left Column (2/3 width) */}
          <div className="inspection-form-column">
            {order.status === 'cancelled' ? (
              // Stornierter Auftrag: keine Erfassung (Server lehnt Schreiben mit 409 ab), aber die
              // bisher erfassten Daten bleiben lesbar - z. B. für die Rückgabe des Geräts.
              <div className="space-y-3">
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <span>
                    Auftrag storniert – Inspektion gesperrt. Die bisher erfassten Daten werden nur zum Lesen angezeigt.
                    Zum Fortsetzen muss ein Admin im Auftrag die Stornierung aufheben.
                  </span>
                </div>
                <InspectionResultsDisplay
                  orderId={orderId!}
                  userRole={user?.role}
                  startBlockedReason="Auftrag storniert – Inspektion gesperrt"
                />
              </div>
            ) : (
            <DeviceInspectionForm
              orderId={orderId!}
              customerId={order.customerId?._id || order.customerId}
              deviceType={order.deviceType}
              deviceBrand={order.deviceBrand}
              deviceModel={order.deviceModel}
              bookedRepairs={Array.isArray(repairServices) && repairServices.length > 0
                ? repairServices.map((service: any) => ({
                    name: service?.serviceId?.name || service?.name || service?.serviceName || service?.title || 'Reparaturservice',
                    price: [service?.finalPrice, service?.totalPrice, service?.price]
                      .map((value) => (value === undefined || value === null || value === '' ? NaN : Number(value)))
                      .find((value) => Number.isFinite(value)),
                    quantity: Number(service?.quantity || 1),
                  }))
                : Array.isArray(order.services)
                ? order.services.map((service: any) => ({
                    name: service?.name || service?.serviceName || String(service),
                    // gleiche Quelle wie im Auftragsdetail (finalPrice/totalPrice/price, auch als Zahl-String)
                    price: [service?.finalPrice, service?.totalPrice, service?.price, service?.serviceId?.price]
                      .map((value) => (value === undefined || value === null || value === '' ? NaN : Number(value)))
                      .find((value) => Number.isFinite(value)),
                    quantity: Number(service?.quantity || 1),
                  }))
                : []}
              orderTotalCost={typeof order.totalCost === 'number' ? order.totalCost : undefined}
              onComplete={handleInspectionComplete}
              onInspectionLoaded={(inspection) => {
                if (inspection?._id) setInspectionId(String(inspection._id));
              }}
            />
            )}
          </div>

          {/* Kundenkommunikation - rechte Spalte, bleibt beim Scrollen sichtbar (sticky).
              Eine Überschrift (Karte), das Panel füllt die Karte: Verlauf scrollt, Antwortfeld bleibt unten. */}
          <div className="inspection-communication-column" id="kundenkommunikation">
            <Card className="inspection-communication-card">
              <CardHeader className="inspection-communication-header">
                <CardTitle className="inspection-communication-title">Kundenkommunikation</CardTitle>
                <CardDescription className="inspection-communication-description">
                  Nachrichten an den Kunden, Rückfragen und interne Notizen zu diesem Auftrag
                </CardDescription>
              </CardHeader>
              <CardContent className="inspection-communication-content">
                <CommunicationPanel
                  orderId={orderId!}
                  inspectionId={inspectionId || undefined}
                  layout="fill"
                  hideTitle
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Important Notes */}
        <Card className="inspection-notes-card">
          <CardHeader className="inspection-notes-header">
            <CardTitle className="inspection-notes-title">Wichtige Hinweise</CardTitle>
          </CardHeader>
          <CardContent className="inspection-notes-content">
            <div className="inspection-note-row">
              <AlertCircle className="inspection-note-icon" />
              <p>Alle Inspektionsschritte müssen ausgefüllt sein, bevor der Reparaturauftrag abgeschlossen wird.</p>
            </div>
            <div className="inspection-note-row">
              <AlertCircle className="inspection-note-icon" />
              <p>Schlägt ein Gerätetest fehl, wird automatisch eine Benachrichtigung für den Kunden erstellt.</p>
            </div>
            <div className="inspection-note-row">
              <AlertCircle className="inspection-note-icon" />
              <p>Nach dem Abschluss kann ein PDF-Prüfbericht mit allen Inspektionsdetails erstellt werden.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
