import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, Package, Zap, CheckCircle2, Info, Apple } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { CorrectionModal } from './CorrectionModal';

interface DataOverviewScreenProps {
  orderId: string;
  workflow: any;
  onWorkflowUpdated: (workflow: any) => void;
}

export function DataOverviewScreen({ orderId, workflow, onWorkflowUpdated }: DataOverviewScreenProps) {
  const { toast } = useToast();
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [inspection, setInspection] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);

        const orderRes = await fetch(`/api/orders/${orderId}`);
        if (orderRes.ok) {
          const orderData = await orderRes.json();
          setOrder(orderData.order);
        }

        const inspectionRes = await fetch(`/api/device-inspections/${orderId}`);
        if (inspectionRes.ok) {
          const inspectionData = await inspectionRes.json();
          setInspection(inspectionData.inspection);
        }
      } catch (err: any) {
        console.error('Error loading data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [orderId]);

  const handleApprove = async () => {
    try {
      const response = await fetch(`/api/repair-workflows/${orderId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          internalNotes: '',
          orderChanges: null,
          notifyCustomer: false,
        }),
      });

      if (!response.ok) throw new Error('Failed to approve repair');

      const data = await response.json();
      onWorkflowUpdated(data.workflow);
      toast({ title: 'Success', description: 'Reparatur-Workflow gestartet' });
    } catch (err: any) {
      console.error('Error approving repair:', err);
      toast({ title: 'Error', description: err.message });
    }
  };

  if (loadingData) {
    return <div className="data-overview-screen">Loading...</div>;
  }

  return (
    <>
      <div className="data-overview-screen">
        {order && (
          <Card className="overview-card">
            <CardHeader>
              <CardTitle className="overview-card-header">
                <Smartphone className="overview-card-icon" />
                Geräteinformationen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overview-grid">
                <div className="overview-item">
                  <div className="overview-item-label">Gerät</div>
                  <div className="overview-item-value">
                    {order.deviceBrand} {order.deviceModel}
                  </div>
                </div>
                <div className="overview-item">
                  <div className="overview-item-label">Typ</div>
                  <div className="overview-item-value">{order.deviceType}</div>
                </div>
                <div className="overview-item">
                  <div className="overview-item-label">Auftragsnummer</div>
                  <div className="overview-item-value">{order.orderNumber}</div>
                </div>
                <div className="overview-item">
                  <div className="overview-item-label">Kundenname</div>
                  <div className="overview-item-value">
                    {order.customerId?.name || 'N/A'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {inspection?.modelVerification && (
          <Card className="overview-card">
            <CardHeader>
              <CardTitle className="overview-card-header">
                <Info className="overview-card-icon" />
                Modellverifizierung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overview-grid">
                <div className="overview-item">
                  <div className="overview-item-label">IMEI</div>
                  <div className="overview-item-value">
                    {inspection.modelVerification.imei || 'N/A'}
                  </div>
                </div>
                <div className="overview-item">
                  <div className="overview-item-label">Modell</div>
                  <div className="overview-item-value">
                    {inspection.modelVerification.modelNumber || 'N/A'}
                  </div>
                </div>
                <div className="overview-item">
                  <div className="overview-item-label">IMEI Gültig</div>
                  <div className="overview-item-value">
                    {inspection.modelVerification.imeiValid ? 'Ja' : 'Nein'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {inspection?.identification && (
          <Card className="overview-card">
            <CardHeader>
              <CardTitle className="overview-card-header">
                <Package className="overview-card-icon" />
                Identifikation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overview-grid">
                <div className="overview-item">
                  <div className="overview-item-label">Speicherplatz</div>
                  <div className="overview-item-value">
                    {inspection.identification.storage || 'N/A'}
                  </div>
                </div>
                <div className="overview-item">
                  <div className="overview-item-label">RAM</div>
                  <div className="overview-item-value">
                    {inspection.identification.ram || 'N/A'}
                  </div>
                </div>
                <div className="overview-item">
                  <div className="overview-item-label">Betriebssystem</div>
                  <div className="overview-item-value">
                    {inspection.identification.osVersion || 'N/A'}
                  </div>
                </div>
                <div className="overview-item">
                  <div className="overview-item-label">Aktivierungssperre</div>
                  <div className="overview-item-value">
                    {inspection.identification.activationLocked ? 'Aktiv' : 'Inaktiv'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {inspection?.accessories && inspection.accessories.length > 0 && (
          <Card className="overview-card">
            <CardHeader>
              <CardTitle className="overview-card-header">
                <Package className="overview-card-icon" />
                Zubehör
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overview-grid">
                {inspection.accessories.map((acc: any, idx: number) => (
                  <div key={idx} className="overview-item">
                    <div className="overview-item-label">
                      {acc.name || `Zubehör ${idx + 1}`}
                    </div>
                    <div className="overview-item-value">
                      {acc.condition || 'Vorhanden'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {inspection?.externalInspection && (
          <Card className="overview-card">
            <CardHeader>
              <CardTitle className="overview-card-header">
                <Package className="overview-card-icon" />
                Äußere Inspektion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overview-grid">
                <div className="overview-item">
                  <div className="overview-item-label">Display</div>
                  <div className="overview-item-value">
                    {inspection.externalInspection.display?.status}
                  </div>
                </div>
                <div className="overview-item">
                  <div className="overview-item-label">Rahmen</div>
                  <div className="overview-item-value">
                    {inspection.externalInspection.frame?.status}
                  </div>
                </div>
                <div className="overview-item">
                  <div className="overview-item-label">Rückseite</div>
                  <div className="overview-item-value">
                    {inspection.externalInspection.backCover?.status}
                  </div>
                </div>
                <div className="overview-item">
                  <div className="overview-item-label">Tasten</div>
                  <div className="overview-item-value">
                    {inspection.externalInspection.buttons?.status}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {inspection?.deviceTest && (
          <Card className="overview-card">
            <CardHeader>
              <CardTitle className="overview-card-header">
                <Zap className="overview-card-icon" />
                Gerätetests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overview-grid">
                <div className="overview-item">
                  <div className="overview-item-label">Laden</div>
                  <div className="overview-item-value">
                    {inspection.deviceTest.charging?.status}
                  </div>
                </div>
                <div className="overview-item">
                  <div className="overview-item-label">Stromversorgung</div>
                  <div className="overview-item-value">
                    {inspection.deviceTest.power?.status}
                  </div>
                </div>
                <div className="overview-item">
                  <div className="overview-item-label">WiFi</div>
                  <div className="overview-item-value">
                    {inspection.deviceTest.wifi?.status}
                  </div>
                </div>
                <div className="overview-item">
                  <div className="overview-item-label">Hauptkamera</div>
                  <div className="overview-item-value">
                    {inspection.deviceTest.mainCamera?.status}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {inspection?.appleSpecific && (
          <Card className="overview-card">
            <CardHeader>
              <CardTitle className="overview-card-header">
                <Apple className="overview-card-icon" />
                Apple-spezifische Informationen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overview-grid">
                <div className="overview-item">
                  <div className="overview-item-label">Find My Status</div>
                  <div className="overview-item-value">
                    {inspection.appleSpecific.findMyEnabled ? 'Aktiviert' : 'Deaktiviert'}
                  </div>
                </div>
                <div className="overview-item">
                  <div className="overview-item-label">Touch ID</div>
                  <div className="overview-item-value">
                    {inspection.appleSpecific.touchIdStatus || 'N/A'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {order && (
          <Card className="overview-card">
            <CardHeader>
              <CardTitle className="overview-card-header">
                <CheckCircle2 className="overview-card-icon" />
                Gebuchte Reparaturen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overview-grid">
                {Array.isArray(order.services) && order.services.length > 0 ? (
                  order.services.map((service: any, idx: number) => (
                    <div key={idx} className="overview-item">
                      <div className="overview-item-label">Service {idx + 1}</div>
                      <div className="overview-item-value">
                        {service?.name || service?.serviceName || String(service)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="overview-item">
                    <div className="overview-item-value">Keine Services</div>
                  </div>
                )}
              </div>
              <div className="overview-item" style={{ marginTop: '12px' }}>
                <div className="overview-item-label">Gesamtkosten</div>
                <div className="overview-item-value">
                  {typeof order.totalCost === 'number' ? `${order.totalCost.toFixed(2)} EUR` : 'N/A'}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="overview-card">
          <CardHeader>
            <CardTitle className="overview-card-header">Nächste Schritte</CardTitle>
          </CardHeader>
          <CardContent>
            <p style={{ margin: '0 0 16px 0', color: '#636e85', fontSize: '14px' }}>
              Überprüfen Sie alle erfassten Daten. Sie können Änderungen vornehmen oder die Reparatur starten.
            </p>
            <div className="overview-actions">
              <Button
                variant="outline"
                onClick={() => setShowCorrectionModal(true)}
              >
                Korrigieren
              </Button>
              <Button
                onClick={handleApprove}
              >
                Bestätigung & Start
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {showCorrectionModal && (
        <CorrectionModal
          orderId={orderId}
          onClose={() => setShowCorrectionModal(false)}
          onApprove={(workflow) => {
            onWorkflowUpdated(workflow);
            setShowCorrectionModal(false);
          }}
        />
      )}
    </>
  );
}
