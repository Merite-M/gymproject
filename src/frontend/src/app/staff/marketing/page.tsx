"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://omufxcaifzqepvqbgghc.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy_key_for_build";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function MarketingAnalytics() {
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const fetchSnapshots = async () => {
    try {
      // 1. Get authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("Not authenticated");
      }

      // 2. Get user's tenant_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        throw new Error("Could not determine tenant");
      }

      const tenant_id = profile.tenant_id;

      // 3. Fetch only high-risk snapshots for this tenant
      const { data, error } = await supabase
        .from("analytics_snapshots")
        .select(`
          *,
          profiles:profile_id (
            id,
            first_name,
            last_name,
            phone
          )
        `)
        .eq('tenant_id', tenant_id)
        .gte('churn_risk_score', 80)
        .order("snapshot_date", { ascending: false });

      if (error) {
        throw error;
      }

      // In case of duplicates per member from previous runs, we can filter for unique profile_ids
      const uniqueProfiles = new Map();
      if (data) {
          for (const item of data) {
              if (!uniqueProfiles.has(item.profile_id)) {
                  uniqueProfiles.set(item.profile_id, item);
              }
          }
      }

      setSnapshots(Array.from(uniqueProfiles.values()));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateDrop = (trailingAvg: number, current: number) => {
    if (trailingAvg === 0) return 0;
    const drop = ((trailingAvg - current) / trailingAvg) * 100;
    return drop > 0 ? drop : 0;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center border-b pb-4">
        <h1 className="text-3xl font-bold tracking-tight">Marketing & Analytics</h1>
        <Button onClick={fetchSnapshots} variant="outline">
          Refresh Data
        </Button>
      </div>

      {error && <div className="text-red-500 font-semibold">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Workflows Matrix */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Visual Automation Matrix</CardTitle>
            <CardDescription>Active predictive retention flows</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
              <div className="flex flex-col space-y-1">
                <span className="font-semibold text-lg">Low Attendance Retention Flow</span>
                <span className="text-sm text-gray-500">Trigger: &gt;60% drop in 4-week visit average</span>
              </div>
              <Badge variant="default" className="bg-green-600">Active</Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
              <div className="flex flex-col space-y-1">
                <span className="font-semibold text-lg">Expiring Memberships</span>
                <span className="text-sm text-gray-500">Trigger: 3 days until expiry</span>
              </div>
              <Badge variant="default" className="bg-green-600">Active</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Predictive Churn Alerts */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              Predictive Churn Alerts
            </CardTitle>
            <CardDescription>Members at high risk based on attendance drop (&gt;60%)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Loading analytics...</div>
            ) : snapshots.length === 0 ? (
              <div className="text-center p-8 text-gray-500 bg-slate-50 rounded-lg">
                No high-risk churn alerts found.
              </div>
            ) : (
              <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="p-4 font-semibold">Member</th>
                      <th className="p-4 font-semibold">4-Wk Avg Visits</th>
                      <th className="p-4 font-semibold">Current Wk</th>
                      <th className="p-4 font-semibold">Drop %</th>
                      <th className="p-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((snapshot) => {
                      const drop = calculateDrop(
                        snapshot.trailing_4wk_avg_visits,
                        snapshot.current_wk_visits
                      );

                      return (
                        <tr key={snapshot.id} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="p-4 font-medium">
                            {snapshot.profiles?.first_name} {snapshot.profiles?.last_name}
                            <div className="text-xs text-gray-500 font-normal">{snapshot.profiles?.phone}</div>
                          </td>
                          <td className="p-4">{snapshot.trailing_4wk_avg_visits.toFixed(1)} / wk</td>
                          <td className="p-4 font-bold text-red-600">{snapshot.current_wk_visits}</td>
                          <td className="p-4">
                            <Badge variant={drop > 60 ? "destructive" : "secondary"}>
                              -{drop.toFixed(0)}%
                            </Badge>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <Button size="sm" variant="outline">View Profile</Button>
                            <Button size="sm">Initiate Outreach</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
