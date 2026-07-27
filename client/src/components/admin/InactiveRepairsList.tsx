import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { AlertCircle, Clock } from 'lucide-react';

interface InactiveRepair {
  _id: string;
  orderId: {
    _id: string;
    orderNumber: string;
  };
  technicianId: {
    _id: string;
    name: string;
    email: string;
  };
  lastStatusChangeAt: string;
  status: string;
}

export function InactiveRepairsList() {
  const { toast } = useToast();
  const [inactiveRepairs, setInactiveRepairs] = useState<InactiveRepair[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInactiveRepairs();
  }, []);

  const loadInactiveRepairs = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/repair-workflows/admin/inactive?thresholdHours=3');
      if (!response.ok) throw new Error('Failed to load inactive repairs');

      const data = await response.json();
      setInactiveRepairs(data.workflows || []);
    } catch (err: any) {
      console.error('Error loading inactive repairs:', err);
      toast({ title: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m ago`;
    }
    return `${diffMinutes}m ago`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent style={{ padding: '24px', textAlign: 'center' }}>
          Loading...
        </CardContent>
      </Card>
    );
  }

  if (inactiveRepairs.length === 0) {
    return (
      <Card>
        <CardContent style={{ padding: '24px', textAlign: 'center', color: '#636e85' }}>
          ✓ Keine inaktiven Reparaturen (&gt;3h ohne Statusänderung)
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Inaktive Reparaturen ({inactiveRepairs.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #d8dce6' }}>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>
                  Auftrag
                </th>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>
                  Techniker
                </th>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>
                  Status
                </th>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>
                  Letzte Aktivität
                </th>
                <th style={{ textAlign: 'center', padding: '12px', fontWeight: 700 }}>
                  Aktion
                </th>
              </tr>
            </thead>
            <tbody>
              {inactiveRepairs.map((repair) => (
                <tr
                  key={repair._id}
                  style={{
                    borderBottom: '1px solid #d8dce6',
                    backgroundColor: '#fff5f5',
                  }}
                >
                  <td style={{ padding: '12px', fontWeight: 500 }}>
                    {repair.orderId?.orderNumber || 'N/A'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {repair.technicianId?.name || 'N/A'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor:
                          repair.status === 'paused' ? '#fff3e0' : '#e3f2fd',
                        color: repair.status === 'paused' ? '#f57c00' : '#1976d2',
                      }}
                    >
                      {repair.status === 'paused' ? 'Pausiert' : 'Läuft'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock className="h-4 w-4" style={{ color: '#ff9800' }} />
                    {formatRelativeTime(repair.lastStatusChangeAt)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        toast({
                          title: 'Info',
                          description: `Erinnerung für Auftrag ${repair.orderId?.orderNumber} an ${repair.technicianId?.name}`,
                        });
                      }}
                    >
                      Erinnerung
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
