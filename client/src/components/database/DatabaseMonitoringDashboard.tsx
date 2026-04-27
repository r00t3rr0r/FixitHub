import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Simple Alert-Komponente für Warnungen
function Alert({ children, variant = "warning", className = "" }) {
  const color = variant === "warning" ? "#facc15" : "#f87171";
  return (
    <div style={{ background: color + "22", borderLeft: `4px solid ${color}`, padding: 12, borderRadius: 6, marginBottom: 8 }} className={className}>
      <span style={{ color, fontWeight: 600, marginRight: 8 }}>{variant === "warning" ? "⚠️" : "❌"}</span>
      {children}
    </div>
  );
}
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/useToast';
import Chart from 'chart.js/auto';
import { getDatabaseMonitoringMetrics } from '@/api/database';

// Dummy initial structure for metrics
const METRIC_LABELS = {
  connectionCount: 'Connection Count',
  queryExecutionTimeP95: 'Query Time P95 (ms)',
  queryExecutionTimeP99: 'Query Time P99 (ms)',
  cacheHitRatio: 'Cache Hit Ratio (%)',
  indexUsage: 'Index Usage (%)',
  dbSize: 'DB Size (MB)',
  tableCount: 'Table Count',
  rowCount: 'Row Count',
};

const ALERT_THRESHOLDS = {
  cacheHitRatio: 99,
};

export function DatabaseMonitoringDashboard({ databases = [], defaultDb }) {
  const [selectedDb, setSelectedDb] = useState(defaultDb || databases[0] || '');
  const [metrics, setMetrics] = useState({});
  const [history, setHistory] = useState([]); // For charting
  const { toast } = useToast();
  const chartRefs = React.useRef({});

  // Fetch metrics from API
  useEffect(() => {
    let isMounted = true;
    async function fetchMetrics() {
      try {
        const res = await getDatabaseMonitoringMetrics(selectedDb);
        const data = res.data;
        if (isMounted) {
          setMetrics(data.metrics || {});
          setHistory((prev) => [...prev.slice(-49), data.metrics]);
        }
      } catch (e) {
        toast({ title: 'Error', description: 'Fehler beim Laden der Metriken', variant: 'destructive' });
      }
    }
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [selectedDb]);

  // Draw charts
  useEffect(() => {
    Object.keys(METRIC_LABELS).forEach((key) => {
      const ctx = chartRefs.current[key];
      if (ctx && history.length > 1) {
        if (ctx.chartInstance) ctx.chartInstance.destroy();
        ctx.chartInstance = new Chart(ctx, {
          type: 'line',
          data: {
            labels: history.map((_, i) => i - history.length + 1),
            datasets: [{
              label: METRIC_LABELS[key],
              data: history.map((h) => h[key]),
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37,99,235,0.1)',
              tension: 0.3,
              pointRadius: 0,
            }],
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { x: { display: false } },
          },
        });
      }
    });
  }, [history]);

  // Alerting
  const alerts = useMemo(() => {
    const arr = [];
    if (metrics.cacheHitRatio !== undefined && metrics.cacheHitRatio < ALERT_THRESHOLDS.cacheHitRatio) {
      arr.push({
        type: 'warning',
        message: `Cache Hit Ratio unter 99%: ${metrics.cacheHitRatio}%`,
      });
    }
    return arr;
  }, [metrics]);

  return (
    <Card className="db-monitoring-dashboard">
      <CardHeader>
        <CardTitle>Datenbank-Monitoring Dashboard</CardTitle>
        <div style={{ marginTop: 8 }}>
          <Select value={selectedDb} onValueChange={setSelectedDb}>
            <SelectTrigger className="w-[220px]">
              <span>{selectedDb}</span>
            </SelectTrigger>
            <SelectContent>
              {databases.map((db) => (
                <SelectItem key={db} value={db}>{db}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.map((alert, i) => (
          <Alert key={i} variant={alert.type} className="mb-2">
            {alert.message}
          </Alert>
        ))}
        <div className="db-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {Object.keys(METRIC_LABELS).map((key) => (
            <div key={key} style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>{METRIC_LABELS[key]}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#2563eb' }}>{metrics[key] ?? '–'}</div>
              <canvas ref={el => { if (el) chartRefs.current[key] = el }} height={60} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
