"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

let supabase: any = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

interface KpiSnapshot {
    gross_revenue: number;
    gateway_fees: number;
    net_revenue: number;
    total_check_ins: number;
    peak_hour: number | null;
    peak_hour_count: number;
    avg_occupancy_pct: number;
    active_members: number;
    mrr: number;
    arpu: number;
    churn_rate_pct: number;
    digest_sent_at: string | null;
}

interface TrendPoint {
    snapshot_date: string;
    gross_revenue: number;
    net_revenue: number;
    gateway_fees: number;
    mrr: number;
    arpu: number;
    churn_rate_pct: number;
    total_check_ins: number;
    active_members: number;
    peak_hour: number | null;
    peak_hour_count: number;
    avg_occupancy_pct: number;
}

interface KpiDashboardData {
    today: KpiSnapshot;
    trend: TrendPoint[];
    revenueByMethod: Record<string, number>;
}

/** Format number as currency with comma separators */
function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(value);
}

/** Format percentage with 1 decimal */
function formatPct(value: number): string {
    return `${value.toFixed(1)}%`;
}

/** Format hour number to time label */
function formatHour(hour: number | null): string {
    if (hour === null || hour === undefined) return 'N/A';
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${h}:00 ${suffix}`;
}

export default function FinancialReportsPage() {
    const [activeTab, setActiveTab] = useState<'kpi' | 'z-reports'>('kpi');

    // ─── KPI Dashboard State ───
    const [kpiData, setKpiData] = useState<KpiDashboardData | null>(null);
    const [kpiLoading, setKpiLoading] = useState(false);
    const [kpiError, setKpiError] = useState<string | null>(null);

    // ─── Z-Report State ───
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /** Fetch KPI dashboard data */
    const fetchKpiDashboard = useCallback(async () => {
        setKpiLoading(true);
        setKpiError(null);

        try {
            if (!supabase) {
                setKpiError("Supabase not configured");
                setKpiLoading(false);
                return;
            }

            const { data: tenant } = await supabase.from('tenants').select('*').limit(1).single();
            if (!tenant) {
                setKpiError("No tenant found");
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setKpiError("Not authenticated. Please log in first.");
                return;
            }

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/reports/kpi-dashboard?tenant_id=${tenant.id}`,
                { headers: { 'Authorization': `Bearer ${session.access_token}` } }
            );

            if (res.ok) {
                setKpiData(await res.json());
            } else {
                const errData = await res.json();
                setKpiError(errData.error || "Failed to fetch KPI data");
            }
        } catch (err: any) {
            console.error("Failed to fetch KPI:", err);
            setKpiError(err.message || "An unexpected error occurred");
        } finally {
            setKpiLoading(false);
        }
    }, []);

    /** Fetch Z-Report data */
    const fetchReport = useCallback(async () => {
        setLoading(true);
        setError(null);
        setReportData(null);

        try {
            if (!supabase) {
                setError("Supabase not configured");
                setLoading(false);
                return;
            }

            const { data: tenant } = await supabase.from('tenants').select('*').limit(1).single();
            if (!tenant) {
                setError("No tenant found");
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setError("Not authenticated. Please log in first.");
                return;
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/reports/z-report?tenant_id=${tenant.id}&start_date=${startDate}T00:00:00.000Z&end_date=${endDate}T23:59:59.999Z`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (res.ok) {
                setReportData(await res.json());
            } else {
                const errData = await res.json();
                setError(errData.error || "Failed to fetch report data");
            }
        } catch (err: any) {
            console.error("Failed to fetch report:", err);
            setError(err.message || "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        if (activeTab === 'kpi') {
            fetchKpiDashboard();
        } else {
            fetchReport();
        }
    }, [activeTab, fetchKpiDashboard, fetchReport]);

    /** Get max value from trend for sparkline scaling */
    const getMaxTrendValue = (key: keyof TrendPoint): number => {
        if (!kpiData?.trend || kpiData.trend.length === 0) return 1;
        return Math.max(...kpiData.trend.map(t => Number(t[key]) || 0), 1);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-2 tracking-tight">Financial Reports</h1>
                    <p className="text-text-muted">Executive KPI Dashboard & Z-Reports</p>
                </div>

                {/* Tab Navigation */}
                <div className="flex bg-surface border border-border-hairline rounded-xl overflow-hidden">
                    <button
                        onClick={() => setActiveTab('kpi')}
                        className={`px-6 py-2.5 text-sm font-bold transition-colors ${
                            activeTab === 'kpi'
                                ? 'bg-brand-primary text-white'
                                : 'text-text-muted hover:text-primary hover:bg-canvas-bg'
                        }`}
                    >
                        KPI Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('z-reports')}
                        className={`px-6 py-2.5 text-sm font-bold transition-colors ${
                            activeTab === 'z-reports'
                                ? 'bg-brand-primary text-white'
                                : 'text-text-muted hover:text-primary hover:bg-canvas-bg'
                        }`}
                    >
                        Z-Reports
                    </button>
                </div>
            </div>

            {/* ═══════════════ KPI DASHBOARD TAB ═══════════════ */}
            {activeTab === 'kpi' && (
                <div className="space-y-8">
                    {kpiError && (
                        <div className="p-4 bg-semantic-error/10 border border-semantic-error/20 rounded-xl text-semantic-error">
                            <p className="font-bold">Error loading dashboard</p>
                            <p className="text-sm opacity-90">{kpiError}</p>
                        </div>
                    )}

                    {kpiLoading && <div className="text-center py-12 text-text-muted">Loading KPI data...</div>}

                    {!kpiLoading && kpiData && (
                        <>
                            {/* ─── KPI Cards ─── */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="bg-surface p-6 rounded-2xl border border-border-hairline shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-brand-primary/5 rounded-bl-full" />
                                    <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">Monthly Recurring Revenue</h3>
                                    <p className="text-3xl font-mono-id font-bold text-brand-primary">
                                        {formatCurrency(kpiData.today.mrr)}
                                    </p>
                                    <p className="text-xs text-text-muted mt-1">RWF / month</p>
                                </div>

                                <div className="bg-surface p-6 rounded-2xl border border-border-hairline shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-brand-secondary/5 rounded-bl-full" />
                                    <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">Avg Revenue Per User</h3>
                                    <p className="text-3xl font-mono-id font-bold text-primary">
                                        {formatCurrency(kpiData.today.arpu)}
                                    </p>
                                    <p className="text-xs text-text-muted mt-1">RWF / member</p>
                                </div>

                                <div className="bg-surface p-6 rounded-2xl border border-border-hairline shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-semantic-error/5 rounded-bl-full" />
                                    <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">Monthly Churn Rate</h3>
                                    <p className={`text-3xl font-mono-id font-bold ${kpiData.today.churn_rate_pct > 5 ? 'text-semantic-error' : 'text-semantic-success'}`}>
                                        {formatPct(kpiData.today.churn_rate_pct)}
                                    </p>
                                    <p className="text-xs text-text-muted mt-1">{kpiData.today.active_members} active members</p>
                                </div>

                                <div className="bg-surface p-6 rounded-2xl border border-border-hairline shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-semantic-success/5 rounded-bl-full" />
                                    <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">Daily Check-Ins</h3>
                                    <p className="text-3xl font-mono-id font-bold text-primary">
                                        {kpiData.today.total_check_ins}
                                    </p>
                                    <p className="text-xs text-text-muted mt-1">
                                        Peak: {formatHour(kpiData.today.peak_hour)} ({kpiData.today.peak_hour_count})
                                    </p>
                                </div>
                            </div>

                            {/* ─── Financial Clearing + Utilization ─── */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Financial Clearing Summary */}
                                <div className="bg-surface rounded-2xl border border-border-hairline shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-border-hairline bg-canvas-bg/50">
                                        <h3 className="font-bold text-primary">Today&apos;s Financial Clearing</h3>
                                    </div>
                                    <div className="p-6 space-y-5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-text-muted">Gross Revenue</span>
                                            <span className="font-mono-id font-bold text-primary text-lg">
                                                {formatCurrency(kpiData.today.gross_revenue)} RWF
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-text-muted">Gateway Fees</span>
                                            <span className="font-mono-id font-bold text-semantic-error">
                                                −{formatCurrency(kpiData.today.gateway_fees)} RWF
                                            </span>
                                        </div>

                                        {/* Fee breakdown */}
                                        {Object.entries(kpiData.revenueByMethod).length > 0 && (
                                            <div className="pl-4 border-l-2 border-border-hairline space-y-2">
                                                {Object.entries(kpiData.revenueByMethod).map(([method, amount]) => (
                                                    <div key={method} className="flex justify-between items-center text-sm">
                                                        <span className="text-text-muted capitalize">{method.replace(/_/g, ' ')}</span>
                                                        <span className="font-mono-id text-primary">{formatCurrency(amount as number)} RWF</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="border-t border-border-hairline pt-4 flex justify-between items-center">
                                            <span className="font-bold text-primary">Net Bank Payout</span>
                                            <span className="font-mono-id font-bold text-semantic-success text-xl">
                                                {formatCurrency(kpiData.today.net_revenue)} RWF
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Utilization Chart */}
                                <div className="bg-surface rounded-2xl border border-border-hairline shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-border-hairline bg-canvas-bg/50">
                                        <h3 className="font-bold text-primary">Facility Utilization</h3>
                                    </div>
                                    <div className="p-6 space-y-5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-text-muted">Average Occupancy</span>
                                            <span className="font-mono-id font-bold text-primary text-lg">
                                                {formatPct(kpiData.today.avg_occupancy_pct)}
                                            </span>
                                        </div>

                                        {/* Occupancy bar */}
                                        <div className="w-full bg-canvas-bg rounded-full h-4 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    kpiData.today.avg_occupancy_pct > 80
                                                        ? 'bg-semantic-error'
                                                        : kpiData.today.avg_occupancy_pct > 50
                                                        ? 'bg-brand-secondary'
                                                        : 'bg-brand-primary'
                                                }`}
                                                style={{ width: `${Math.min(100, kpiData.today.avg_occupancy_pct)}%` }}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-canvas-bg p-4 rounded-xl text-center">
                                                <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">Peak Hour</p>
                                                <p className="font-mono-id font-bold text-primary text-lg">
                                                    {formatHour(kpiData.today.peak_hour)}
                                                </p>
                                            </div>
                                            <div className="bg-canvas-bg p-4 rounded-xl text-center">
                                                <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">Peak Count</p>
                                                <p className="font-mono-id font-bold text-primary text-lg">
                                                    {kpiData.today.peak_hour_count}
                                                </p>
                                            </div>
                                        </div>

                                        {kpiData.today.digest_sent_at && (
                                            <p className="text-xs text-text-muted text-center mt-2">
                                                📧 Owner digest sent at {new Date(kpiData.today.digest_sent_at).toLocaleTimeString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ─── 30-Day Revenue Trend Sparkline ─── */}
                            {kpiData.trend.length > 0 && (
                                <div className="bg-surface rounded-2xl border border-border-hairline shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-border-hairline bg-canvas-bg/50">
                                        <h3 className="font-bold text-primary">30-Day Revenue Trend</h3>
                                    </div>
                                    <div className="p-6">
                                        <div className="flex items-end gap-[3px] h-24">
                                            {kpiData.trend.map((point, i) => {
                                                const maxRev = getMaxTrendValue('net_revenue');
                                                const height = (Number(point.net_revenue) / maxRev) * 100;
                                                return (
                                                    <div
                                                        key={point.snapshot_date}
                                                        className="flex-1 bg-brand-primary/70 hover:bg-brand-primary rounded-t transition-colors cursor-pointer relative group"
                                                        style={{ height: `${Math.max(2, height)}%` }}
                                                        title={`${point.snapshot_date}: ${formatCurrency(Number(point.net_revenue))} RWF`}
                                                    >
                                                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                            {point.snapshot_date.slice(5)}: {formatCurrency(Number(point.net_revenue))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex justify-between mt-2 text-[10px] text-text-muted">
                                            <span>{kpiData.trend[0]?.snapshot_date.slice(5)}</span>
                                            <span>{kpiData.trend[kpiData.trend.length - 1]?.snapshot_date.slice(5)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ─── MRR Trend ─── */}
                            {kpiData.trend.length > 0 && (
                                <div className="bg-surface rounded-2xl border border-border-hairline shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-border-hairline bg-canvas-bg/50">
                                        <h3 className="font-bold text-primary">MRR & Check-In Trend</h3>
                                    </div>
                                    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* MRR mini chart */}
                                        <div>
                                            <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3">MRR</p>
                                            <div className="flex items-end gap-[2px] h-16">
                                                {kpiData.trend.map((point) => {
                                                    const maxMrr = getMaxTrendValue('mrr');
                                                    const height = (Number(point.mrr) / maxMrr) * 100;
                                                    return (
                                                        <div
                                                            key={`mrr-${point.snapshot_date}`}
                                                            className="flex-1 bg-brand-secondary/60 hover:bg-brand-secondary rounded-t transition-colors"
                                                            style={{ height: `${Math.max(2, height)}%` }}
                                                            title={`${point.snapshot_date}: ${formatCurrency(Number(point.mrr))} RWF`}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Check-ins mini chart */}
                                        <div>
                                            <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3">Daily Check-Ins</p>
                                            <div className="flex items-end gap-[2px] h-16">
                                                {kpiData.trend.map((point) => {
                                                    const maxCI = getMaxTrendValue('total_check_ins');
                                                    const height = (Number(point.total_check_ins) / maxCI) * 100;
                                                    return (
                                                        <div
                                                            key={`ci-${point.snapshot_date}`}
                                                            className="flex-1 bg-semantic-success/50 hover:bg-semantic-success rounded-t transition-colors"
                                                            style={{ height: `${Math.max(2, height)}%` }}
                                                            title={`${point.snapshot_date}: ${point.total_check_ins} check-ins`}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ═══════════════ Z-REPORTS TAB ═══════════════ */}
            {activeTab === 'z-reports' && (
                <div className="space-y-8">
                    {/* Date Range Picker */}
                    <div className="flex items-end gap-4 bg-surface p-4 rounded-xl border border-border-hairline shadow-sm w-fit">
                        <div>
                            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full p-2 bg-canvas-bg border border-border-hairline rounded-lg text-primary focus:outline-none focus:border-brand-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">End Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full p-2 bg-canvas-bg border border-border-hairline rounded-lg text-primary focus:outline-none focus:border-brand-primary"
                            />
                        </div>
                        <button
                            onClick={fetchReport}
                            disabled={loading}
                            className="px-6 py-2 bg-brand-primary text-white font-bold rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-colors h-[42px]"
                        >
                            {loading ? 'Generating...' : 'Generate Report'}
                        </button>
                    </div>

                    {error && (
                        <div className="p-4 bg-semantic-error/10 border border-semantic-error/20 rounded-xl text-semantic-error">
                            <p className="font-bold">Error loading report</p>
                            <p className="text-sm opacity-90">{error}</p>
                        </div>
                    )}

                    {loading && <div className="text-center py-12 text-text-muted">Loading report data...</div>}

                    {!loading && reportData && (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-surface p-6 rounded-2xl border border-border-hairline shadow-sm">
                                    <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-2">Total Expected Cash</h3>
                                    <p className="text-3xl font-mono-id font-bold text-primary">
                                        ${reportData.summary.expected_cash.toFixed(2)}
                                    </p>
                                </div>
                                <div className="bg-surface p-6 rounded-2xl border border-border-hairline shadow-sm">
                                    <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-2">Total Actual Cash</h3>
                                    <p className="text-3xl font-mono-id font-bold text-brand-primary">
                                        ${reportData.summary.actual_cash.toFixed(2)}
                                    </p>
                                </div>
                                <div className="bg-surface p-6 rounded-2xl border border-border-hairline shadow-sm">
                                    <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-2">Cash Discrepancies</h3>
                                    <p className={`text-3xl font-mono-id font-bold ${reportData.summary.discrepancies > 0 ? 'text-semantic-error' : 'text-semantic-success'}`}>
                                        ${reportData.summary.discrepancies.toFixed(2)}
                                    </p>
                                </div>
                                <div className="bg-surface p-6 rounded-2xl border border-border-hairline shadow-sm">
                                    <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-2">Total Shifts</h3>
                                    <p className="text-3xl font-bold text-primary">
                                        {reportData.shifts.length}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Revenue Breakdown */}
                                <div className="bg-surface rounded-2xl border border-border-hairline shadow-sm overflow-hidden lg:col-span-1">
                                    <div className="p-6 border-b border-border-hairline bg-canvas-bg/50">
                                        <h3 className="font-bold text-primary">Settled Revenue by Method</h3>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        {Object.entries(reportData.totals.completed).map(([method, amount]: [string, any]) => (
                                            <div key={method} className="flex justify-between items-center pb-4 border-b border-border-hairline/50 last:border-0 last:pb-0">
                                                <span className="text-text-muted capitalize">{method.replace('_', ' ')}</span>
                                                <span className="font-mono-id font-bold text-primary">${(amount as number).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-6 border-y border-border-hairline bg-canvas-bg/50 mt-4">
                                        <h3 className="font-bold text-primary">Pending Revenue (Tabs/MoMo)</h3>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        {Object.entries(reportData.totals.pending).filter(([_, amount]: [string, any]) => amount > 0).length > 0 ? (
                                            Object.entries(reportData.totals.pending)
                                                .filter(([_, amount]: [string, any]) => amount > 0)
                                                .map(([method, amount]: [string, any]) => (
                                                    <div key={`pending-${method}`} className="flex justify-between items-center pb-4 border-b border-border-hairline/50 last:border-0 last:pb-0">
                                                        <span className="text-text-muted capitalize">{method.replace('_', ' ')}</span>
                                                        <span className="font-mono-id font-bold text-brand-secondary">${(amount as number).toFixed(2)}</span>
                                                    </div>
                                                ))
                                        ) : (
                                            <p className="text-text-muted text-sm italic">No pending revenue.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Shift List */}
                                <div className="bg-surface rounded-2xl border border-border-hairline shadow-sm overflow-hidden lg:col-span-2">
                                    <div className="p-6 border-b border-border-hairline bg-canvas-bg/50">
                                        <h3 className="font-bold text-primary">Shift Ledgers</h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-canvas-bg border-b border-border-hairline">
                                                    <th className="p-4 text-[11px] font-bold text-text-muted uppercase tracking-widest">Date</th>
                                                    <th className="p-4 text-[11px] font-bold text-text-muted uppercase tracking-widest">Staff</th>
                                                    <th className="p-4 text-[11px] font-bold text-text-muted uppercase tracking-widest">Status</th>
                                                    <th className="p-4 text-[11px] font-bold text-text-muted uppercase tracking-widest text-right">Expected</th>
                                                    <th className="p-4 text-[11px] font-bold text-text-muted uppercase tracking-widest text-right">Actual</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border-hairline">
                                                {reportData.shifts.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="p-8 text-center text-text-muted">
                                                            No shifts found for this date range.
                                                        </td>
                                                    </tr>
                                                )}
                                                {reportData.shifts.map((shift: any) => (
                                                    <tr key={shift.id} className="hover:bg-canvas-bg/50 transition-colors">
                                                        <td className="p-4 text-primary font-mono-id text-sm">
                                                            {new Date(shift.shift_start).toLocaleDateString()}
                                                            <div className="text-text-muted text-xs">
                                                                {new Date(shift.shift_start).toLocaleTimeString()}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-primary text-sm">
                                                            {shift.staff_id ? shift.staff_id.substring(0,8) + '...' : 'Unknown'}
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                                                                shift.status === 'closed' ? 'bg-semantic-success/20 text-semantic-success' :
                                                                shift.status === 'discrepancy' ? 'bg-semantic-error/20 text-semantic-error' :
                                                                'bg-brand-secondary/20 text-brand-secondary'
                                                            }`}>
                                                                {shift.status.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 font-mono-id text-primary text-right font-bold">
                                                            ${parseFloat(shift.expected_cash || 0).toFixed(2)}
                                                        </td>
                                                        <td className={`p-4 font-mono-id text-right font-bold ${
                                                            shift.status === 'discrepancy' ? 'text-semantic-error' : 'text-primary'
                                                        }`}>
                                                            ${parseFloat(shift.actual_cash || 0).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
