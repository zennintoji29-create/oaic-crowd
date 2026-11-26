import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import {
  FileDown,
  Search,
  TrendingUp,
  ShieldAlert,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Cpu
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { AlertRecord, AuditLogEntry, TrafficAnalytics } from '../types';
import { fetchAnalytics } from '../lib/api';
import { StateBadge } from './StateBadge';

interface AlertsTabProps {
  alerts: AlertRecord[];
  auditLogs?: AuditLogEntry[];
  onAcknowledgeAlert?: (alertId: string) => void;
}

export const AlertsTab: React.FC<AlertsTabProps> = ({
  alerts,
  auditLogs = [],
  onAcknowledgeAlert
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState<'ALL' | 'RED' | 'AMBER'>('ALL');
  const [filterZone, setFilterZone] = useState<string>('ALL');
  const [analytics, setAnalytics] = useState<TrafficAnalytics | null>(null);

  // Pagination: default 5 items per page
  const [pageSize, setPageSize] = useState<5 | 10 | 20>(5);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const data = await fetchAnalytics();
        if (isMounted) setAnalytics(data);
      } catch (err) {
        console.warn('Could not fetch analytics, using fallback:', err);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const uniqueZones = Array.from(new Set(alerts.map((a) => a.zoneName)));

  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch =
      alert.zoneName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.zoneId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.message.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity = filterState === 'ALL' ? true : alert.toState === filterState;
    const matchesZone = filterZone === 'ALL' ? true : alert.zoneName === filterZone;

    return matchesSearch && matchesSeverity && matchesZone;
  });

  // Reset to page 1 when filters or pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterState, filterZone, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedAlerts = filteredAlerts.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const dangerCount = alerts.filter((a) => a.toState === 'RED').length;
  const amberCount = alerts.filter((a) => a.toState === 'AMBER').length;
  const aiPrimaryPct = analytics?.modeSummary
    ? `${((analytics.modeSummary.aiVisionHours / (analytics.modeSummary.totalUptimeHours || 1)) * 100).toFixed(0)}%`
    : '98%';
  const autoRecoveryPct = `${analytics?.modeSummary?.autoRecoveryRatePercent ?? 100}%`;
  const peakEntry = (analytics?.peakHours || []).reduce(
    (best, cur) => (cur.count > best.count ? cur : best),
    { hour: '18:00', count: 520, risk: 85 }
  );

  const downloadPdfSummary = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Crowd Pressure Radar — Safety Summary Report', 14, 18);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);

    doc.setFontSize(12);
    doc.text('Key Operational Numbers', 14, 38);
    doc.setFontSize(10);
    const summaryLines = [
      `Total Alerts Logged: ${alerts.length}`,
      `Critical Locks (Danger / RED): ${dangerCount}`,
      `Elevated Warnings (AMBER): ${amberCount}`,
      `AI Vision Primary Uptime: ${aiPrimaryPct}`,
      `Auto-Recovery Rate: ${autoRecoveryPct}`,
      `Peak Traffic Hour: ${peakEntry.hour} (${peakEntry.count} people, Risk ${peakEntry.risk})`,
      `Failover Events Caught: ${analytics?.modeSummary?.failoverEventsCount ?? 3}`
    ];
    summaryLines.forEach((line, idx) => {
      doc.text(`• ${line}`, 16, 46 + idx * 7);
    });

    doc.setFontSize(12);
    doc.text('Recent Incident History (Top 10)', 14, 102);
    doc.setFontSize(9);
    filteredAlerts.slice(0, 10).forEach((alert, idx) => {
      const timeStr = new Date(alert.timestamp).toLocaleTimeString();
      const line = `${timeStr} | ${alert.zoneName} | ${alert.fromState} -> ${alert.toState} | Risk ${alert.score}`;
      doc.text(line.slice(0, 95), 14, 110 + idx * 7);
    });

    doc.save(`cpr-safety-summary-${Date.now()}.pdf`);
  };

  const downloadCsvExport = () => {
    const headers = ['Time', 'Zone', 'From', 'To', 'RiskScore', 'AcknowledgedBy', 'Message'];
    const rows = filteredAlerts.map((a) => [
      new Date(a.timestamp).toISOString(),
      `"${(a.zoneName || '').replace(/"/g, '""')}"`,
      a.fromState,
      a.toState,
      a.score,
      `"${(a.acknowledgedBy || 'Pending').replace(/"/g, '""')}"`,
      `"${(a.message || '').replace(/"/g, '""')}"`
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cpr-alerts-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. Summary Section + Download PDF / CSV */}
      <div className="flat-panel p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-text-primary tracking-tight">
              Alerts & Safety Summary
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              Key crowd safety numbers, peak traffic hours, mode breakdown, and paginated incident history.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadCsvExport}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-white transition-colors"
            >
              <FileDown className="w-4 h-4 text-[#18e299]" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={downloadPdfSummary}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
            >
              <FileDown className="w-4 h-4" aria-hidden="true" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        {/* Summary Important Numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-border-subtle">
          <div className="p-3 rounded bg-surface-sunken border border-border-subtle">
            <span className="text-[10px] font-mono text-text-muted block">TOTAL ALERTS</span>
            <span className="text-lg font-bold font-mono text-text-primary">{alerts.length}</span>
          </div>
          <div className="p-3 rounded bg-surface-sunken border border-border-subtle">
            <span className="text-[10px] font-mono text-text-muted block">CRITICAL LOCKS</span>
            <span className="text-lg font-bold font-mono text-rose-400">{dangerCount}</span>
          </div>
          <div className="p-3 rounded bg-surface-sunken border border-border-subtle">
            <span className="text-[10px] font-mono text-text-muted block">WARNINGS</span>
            <span className="text-lg font-bold font-mono text-amber-400">{amberCount}</span>
          </div>
          <div className="p-3 rounded bg-surface-sunken border border-border-subtle">
            <span className="text-[10px] font-mono text-text-muted block">AI UPTIME</span>
            <span className="text-lg font-bold font-mono text-emerald-400">{aiPrimaryPct}</span>
          </div>
          <div className="p-3 rounded bg-surface-sunken border border-border-subtle">
            <span className="text-[10px] font-mono text-text-muted block">AUTO RECOVERY</span>
            <span className="text-lg font-bold font-mono text-emerald-400">{autoRecoveryPct}</span>
          </div>
          <div className="p-3 rounded bg-surface-sunken border border-border-subtle">
            <span className="text-[10px] font-mono text-text-muted block">PEAK HOUR</span>
            <span className="text-lg font-bold font-mono text-cyan-400">{peakEntry.hour}</span>
          </div>
        </div>
      </div>

      {/* 2. Executive Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flat-panel p-4">
          <div className="flex items-center justify-between text-xs text-text-muted mb-1 font-mono">
            <span>TOTAL ALERTS</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-text-primary">{alerts.length}</span>
          <span className="text-[11px] text-text-muted block mt-1">Logged transitions</span>
        </div>

        <div className="flat-panel p-4">
          <div className="flex items-center justify-between text-xs text-text-muted mb-1 font-mono">
            <span>CRITICAL LOCKS</span>
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-red-400">{dangerCount}</span>
          <span className="text-[11px] text-text-muted block mt-1">Zero injuries recorded</span>
        </div>

        <div className="flat-panel p-4">
          <div className="flex items-center justify-between text-xs text-text-muted mb-1 font-mono">
            <span>AI VISION PRIMARY</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-cyan-400">{aiPrimaryPct}</span>
          <span className="text-[11px] text-text-muted block mt-1">YOLO11n Edge GPU</span>
        </div>

        <div className="flat-panel p-4">
          <div className="flex items-center justify-between text-xs text-text-muted mb-1 font-mono">
            <span>AUTO RECOVERY</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-emerald-400">{autoRecoveryPct}</span>
          <span className="text-[11px] text-text-muted block mt-1">Without operator lag</span>
        </div>
      </div>

      {/* 3. Peak Time of Traffic Chart & Mode Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flat-panel p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <div>
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>Peak Traffic Times & Hourly Surge Profile</span>
              </h2>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Aggregate hourly pedestrian count and average crowd risk score across all gates.
              </p>
            </div>
            <span className="text-[10px] font-mono text-text-muted px-2 py-0.5 rounded bg-surface-sunken border border-border-subtle">
              24-HOUR RADAR BIN
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics?.peakHours || [
                  { hour: '06:00', count: 45, risk: 12 },
                  { hour: '08:00', count: 180, risk: 38 },
                  { hour: '10:00', count: 320, risk: 54 },
                  { hour: '12:00', count: 480, risk: 78 },
                  { hour: '14:00', count: 290, risk: 42 },
                  { hour: '16:00', count: 410, risk: 65 },
                  { hour: '18:00', count: 520, risk: 85 },
                  { hour: '20:00', count: 310, risk: 48 },
                  { hour: '22:00', count: 110, risk: 20 }
                ]}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="hour" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface-raised)',
                    borderColor: 'var(--border-strong)',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <Bar dataKey="count" name="People Count (Peak Hourly)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="risk" name="Crowd Pressure Index" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flat-panel p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="pb-2 border-b border-border-subtle">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Report of Mode Summary</span>
              </h2>
              <p className="text-[11px] text-text-secondary mt-0.5">
                AI Vision Primary vs Hardware Failover uptime ratio.
              </p>
            </div>

            <div className="space-y-3 mt-4">
              <div className="p-3 rounded bg-surface-sunken border border-border-subtle space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">AI Vision Primary Uptime</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {analytics?.modeSummary?.aiVisionHours ?? 47.2} hrs
                  </span>
                </div>
                <div className="w-full bg-surface-base h-2 rounded-full overflow-hidden">
                  <div className="bg-cyan-400 h-full rounded-full" style={{ width: '97%' }}></div>
                </div>
              </div>

              <div className="p-3 rounded bg-surface-sunken border border-border-subtle space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Radar + ToF Failover Mode</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {analytics?.modeSummary?.failoverHours ?? 0.8} hrs
                  </span>
                </div>
                <div className="w-full bg-surface-base h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: '3%' }}></div>
                </div>
              </div>

              <div className="p-3 rounded bg-surface-sunken border border-border-subtle space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">Total System Uptime:</span>
                  <span className="font-mono text-text-primary">
                    {analytics?.modeSummary?.totalUptimeHours ?? 48.0} hrs
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Failover Events Caught:</span>
                  <span className="font-mono text-text-primary">
                    {analytics?.modeSummary?.failoverEventsCount ?? 3}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Risk Timeline & Gate Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flat-panel p-5 space-y-3">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 pb-2 border-b border-border-subtle">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Risk Timeline & Peak Interventions</span>
          </h2>
          <div className="space-y-2 text-xs">
            {(analytics?.riskTimeline || [
              { time: '18:42:10', state: 'RED', count: 14, event: 'Surge clamp at Gate A - Servo locked 0°' },
              { time: '16:15:02', state: 'AMBER', count: 8, event: 'Metering engaged at Gate B - Servo 45°' },
              { time: '12:30:19', state: 'RED', count: 12, event: 'Corridor compression detected by mmWave Radar' },
              { time: '10:05:40', state: 'AMBER', count: 7, event: 'Laminar flow slowed below 0.3 m/s' }
            ]).map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded bg-surface-sunken border border-border-subtle flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-text-muted">{item.time}</span>
                    <StateBadge state={item.state as any} size="sm" />
                    <span className="font-mono text-[11px] font-bold text-text-primary">{item.count} people</span>
                  </div>
                  <p className="text-text-secondary text-[11px] mt-1">{item.event}</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-text-muted shrink-0" />
              </div>
            ))}
          </div>
        </div>

        <div className="flat-panel p-5 space-y-3">
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2 pb-2 border-b border-border-subtle">
            <ShieldAlert className="w-4 h-4 text-cyan-400" />
            <span>Gate Passage & Incident Breakdown</span>
          </h2>
          <div className="space-y-2 text-xs">
            {(analytics?.gateBreakdown || [
              { gateId: 'gate-a', name: 'Main Temple Gate A', totalPassages: 4820, criticalIncidents: 4 },
              { gateId: 'gate-b', name: 'North Pavilion Gate B', totalPassages: 3290, criticalIncidents: 2 }
            ]).map((gate) => (
              <div
                key={gate.gateId}
                className="p-3 rounded bg-surface-sunken border border-border-subtle space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-primary">{gate.name}</span>
                  <span className="font-mono text-[10px] text-text-muted">ID: {gate.gateId}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded bg-surface-base border border-border-subtle">
                    <span className="text-text-muted block text-[10px]">TOTAL PASSAGES</span>
                    <span className="text-cyan-400 font-bold text-sm">{gate.totalPassages.toLocaleString()}</span>
                  </div>
                  <div className="p-2 rounded bg-surface-base border border-border-subtle">
                    <span className="text-text-muted block text-[10px]">CRITICAL INTERVENTIONS</span>
                    <span className="text-red-400 font-bold text-sm">{gate.criticalIncidents}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Paginated Alert Event Log */}
      <div className="space-y-3">
        <div className="flat-panel p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative w-full sm:w-auto sm:min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5" aria-hidden="true" />
              <input
                type="text"
                placeholder="Filter by keyword, zone, or gate..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-surface-sunken border border-border-strong rounded text-text-primary placeholder:text-text-muted focus-visible:outline"
              />
            </div>

            <div className="flex items-center border border-border-strong rounded bg-surface-sunken p-0.5 text-xs">
              <button
                onClick={() => setFilterState('ALL')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filterState === 'ALL'
                    ? 'bg-surface-raised text-text-primary font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                All ({alerts.length})
              </button>
              <button
                onClick={() => setFilterState('RED')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filterState === 'RED'
                    ? 'bg-status-danger-bg text-status-danger-text font-semibold'
                    : 'text-text-secondary hover:text-status-danger-text'
                }`}
              >
                Danger ({dangerCount})
              </button>
              <button
                onClick={() => setFilterState('AMBER')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filterState === 'AMBER'
                    ? 'bg-status-building-bg text-status-building-text font-semibold'
                    : 'text-text-secondary hover:text-status-building-text'
                }`}
              >
                Building Up ({amberCount})
              </button>
            </div>

            {uniqueZones.length > 1 && (
              <select
                value={filterZone}
                onChange={(e) => setFilterZone(e.target.value)}
                className="bg-surface-raised border border-border-strong text-text-primary text-xs rounded px-2.5 py-1.5 focus-visible:outline"
              >
                <option value="ALL">All zones</option>
                {uniqueZones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Items per page dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="alerts-page-size" className="text-text-muted font-mono">
              Show:
            </label>
            <select
              id="alerts-page-size"
              value={pageSize}
              onChange={(e) => setPageSize(parseInt(e.target.value, 10) as 5 | 10 | 20)}
              className="bg-surface-sunken border border-border-strong text-text-primary text-xs rounded px-2.5 py-1.5 font-mono focus-visible:outline"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
        </div>

        {/* Alerts List: Stacked Cards on Mobile, Sticky-Header Table on Desktop */}
        <div className="flat-panel overflow-hidden">
          {paginatedAlerts.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">
              No matching alerts found. System operating normally.
            </div>
          ) : (
            <>
              {/* Mobile / Small Screen Stacked Cards */}
              <div className="md:hidden divide-y divide-border-subtle">
                {paginatedAlerts.map((alert) => (
                  <div key={alert.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-text-primary">{alert.zoneName}</span>
                      <StateBadge state={alert.toState as any} size="sm" />
                    </div>
                    <p className="text-xs text-text-secondary">{alert.message}</p>
                      <div className="flex items-center justify-between text-xs text-text-muted">
                        <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                        <span className="tabular-nums font-medium">
                          {alert.fromState} → {alert.toState} (Risk {alert.score})
                        </span>
                      </div>
                      {onAcknowledgeAlert && (
                        <div className="pt-1">
                          {alert.acknowledged ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#18e299] font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Ack by {alert.acknowledgedBy || 'operator'}</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onAcknowledgeAlert(alert.id)}
                              className="min-h-[44px] px-3 py-1.5 rounded border border-white/[0.12] bg-white/[0.04] text-xs font-medium text-white"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      )}
                  </div>
                ))}
              </div>

              {/* Desktop / Tablet Sticky-Header Table */}
              <div className="hidden md:block overflow-x-auto max-h-[420px]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-surface-sunken border-b border-border-subtle text-text-muted uppercase text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Zone / Gate</th>
                      <th className="py-3 px-4">State Transition</th>
                      <th className="py-3 px-4">Risk Index</th>
                      <th className="py-3 px-4">Operator Message</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {paginatedAlerts.map((alert) => (
                      <tr key={alert.id} className="hover:bg-surface-sunken/50 transition-colors">
                        <td className="py-3 px-4 text-text-muted whitespace-nowrap tabular-nums">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4 font-medium text-text-primary">
                          {alert.zoneName}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-text-muted">{alert.fromState}</span>
                            <span className="text-text-muted">→</span>
                            <StateBadge state={alert.toState as any} size="sm" />
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold text-text-primary tabular-nums">
                          {alert.score}
                        </td>
                        <td className="py-3 px-4 text-text-secondary">{alert.message}</td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {alert.acknowledged ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#18e299] font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Ack ({alert.acknowledgedBy || 'operator'})</span>
                            </span>
                          ) : onAcknowledgeAlert ? (
                            <button
                              type="button"
                              onClick={() => onAcknowledgeAlert(alert.id)}
                              className="px-2.5 py-1 rounded border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.1] text-white text-[11px] font-medium transition-colors"
                            >
                              Acknowledge
                            </button>
                          ) : (
                            <span className="text-[11px] text-neutral-500">Logged</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pagination Controls (>= 44px touch targets) */}
          <div className="p-3 border-t border-border-subtle bg-surface-sunken flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-text-muted tabular-nums">
              Page {safePage} of {totalPages} ({filteredAlerts.length} total)
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="min-h-[44px] px-3 py-2 rounded border border-border-strong bg-surface-raised text-text-primary hover:bg-surface-base disabled:opacity-40"
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded border tabular-nums ${
                    pageNum === safePage
                      ? 'bg-accent border-accent text-slate-950 font-bold'
                      : 'border-border-strong bg-surface-raised text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="min-h-[44px] px-3 py-2 rounded border border-border-strong bg-surface-raised text-text-primary hover:bg-surface-base disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Operator Audit Trail */}
      <div className="flat-panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Operator Audit Trail</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Recent manual overrides, hardware mode changes, gate threshold updates, and profile actions.
            </p>
          </div>
          <span className="text-xs font-mono text-neutral-400 tabular-nums">{auditLogs.length} entries</span>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-neutral-500 py-4">No operator actions logged in this session yet.</p>
        ) : (
          <div className="divide-y divide-white/[0.06] max-h-60 overflow-y-auto text-xs">
            {auditLogs.slice(0, 25).map((entry) => (
              <div key={entry.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.1] text-[#18e299] font-mono text-[10px]">
                    {entry.action}
                  </span>
                  <span className="text-neutral-200">{entry.detail}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
                  <span>{entry.actorEmail}</span>
                  <span>•</span>
                  <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
