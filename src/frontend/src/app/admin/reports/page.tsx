"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

let supabase: any = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export default function FinancialReportsPage() {
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchReport = async () => {
        setLoading(true);
        setError(null);
        setReportData(null); // Clear stale data

        try {
            if(!supabase) {
                setError("Supabase not configured");
                setLoading(false);
                return;
            }

            // In a real multi-tenant app, the tenant_id would come from the user's active session or context.
            // Using .limit(1) as a fallback mock for now based on current app logic.
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
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
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
    };

    useEffect(() => {
        fetchReport();
    }, []);

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-primary mb-2 tracking-tight">Financial Reports</h1>
                    <p className="text-text-muted">Aggregated Z-Reports and Shift Summaries</p>
                </div>

                <div className="flex items-end gap-4 bg-surface p-4 rounded-xl border border-border-hairline shadow-sm">
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
            </div>

            {error && (
                <div className="mb-8 p-4 bg-semantic-error/10 border border-semantic-error/20 rounded-xl text-semantic-error">
                    <p className="font-bold">Error loading report</p>
                    <p className="text-sm opacity-90">{error}</p>
                </div>
            )}

            {loading && <div className="text-center py-12 text-text-muted">Loading report data...</div>}

            {!loading && reportData && (
                <div className="space-y-8">
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
                </div>
            )}
        </div>
    );
}
