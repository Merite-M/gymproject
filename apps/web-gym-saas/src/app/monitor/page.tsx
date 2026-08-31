"use client";
import Link from "next/link";

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import { useTenantId } from '@/contexts/AuthContext';

// Setup Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://omufxcaifzqepvqbgghc.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key_for_build';
const supabase = createClient(supabaseUrl, supabaseKey);

interface CheckIn {
  id: string;
  profile_id: string;
  tenant_id: string;
  access_method: string;
  status: string;
  created_at: string;
  checkout_at?: string | null;
  checkout_method?: string | null;
  profiles?: {
    first_name: string;
    last_name: string;
    avatar_url: string;
    membership_status?: string;
  }
}

interface OccupancyData {
  current: number;
  max: number;
  percentage: number;
  policy: string;
  threshold_status: 'normal' | 'warning' | 'critical' | 'full';
  auto_checkout_minutes: number;
}


// Web Audio API for synthetic notification sounds
let sharedAudioContext: AudioContext | null = null;

const playSound = async (status: string) => {
  if (typeof window === "undefined") return;

  try {
    if (!sharedAudioContext) {
      sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = sharedAudioContext;

    // Wait for context to resume if suspended (browser autoplay policy) before scheduling
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(e => {
        console.warn('Could not resume audio context', e);
        return;
      });
      if (ctx.state === 'suspended') return; // User interaction required
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const startTime = ctx.currentTime;

    if (status === "approved") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, startTime); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.50, startTime + 0.1); // C6
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
      osc.start(startTime);
      osc.stop(startTime + 0.5);
    } else {
      // Warning/Denied uses a lower, harsher beep
      osc.type = "square";
      osc.frequency.setValueAtTime(200, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    }
  } catch (e) {
    console.error("Audio playback failed:", e);
  }
};

export default function MissionControlMonitor() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const tenantId = useTenantId();
  const [loading, setLoading] = useState(true);
  const [activeCheckIn, setActiveCheckIn] = useState<CheckIn | null>(null);
  const [visualAlertsEnabled, setVisualAlertsEnabled] = useState(true);
  const [soundCuesEnabled, setSoundCuesEnabled] = useState(true);
  const [occupancy, setOccupancy] = useState<OccupancyData | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const soundCuesEnabledRef = useRef(soundCuesEnabled);
  soundCuesEnabledRef.current = soundCuesEnabled;

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    // Fetch tenant settings unconditionally on mount
    const fetchTenantSettings = async () => {
      try {
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('visual_alerts_enabled, sound_cues_enabled')
          .eq('id', tenantId)
          .single();
        if (tenantError) {
          console.error("Error fetching tenant settings for alerts/sounds (using defaults):", tenantError);
        }
        setVisualAlertsEnabled(tenantData?.visual_alerts_enabled ?? true);
        setSoundCuesEnabled(tenantData?.sound_cues_enabled ?? true);
      } catch (error) {
        console.error("Failed to fetch tenant settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTenantSettings();

    // 1. Initial Fetch
    const fetchRecentCheckIns = async () => {
      if (!tenantId) return;
      
      try {
        const { data, error } = await supabase
          .from('check_ins')
          .select(`
            *,
            profiles:profile_id (first_name, last_name, avatar_url, membership_status)
          `)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error && data) {
          const fetchedData = data as unknown as CheckIn[];
          setCheckIns(prev => {
            // Merge by ID to prevent dropping rows that arrived via realtime while fetch was in flight
            const combined = [...prev];
            fetchedData.forEach(newRow => {
              if (!combined.some(row => row.id === newRow.id)) {
                combined.push(newRow);
              }
            });
            return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20);
          });

          // Only auto-select if no selection has been made manually
          setActiveCheckIn(current => current ? current : (fetchedData[0] || null));
        }
      } catch (error) {
        console.error("Failed to fetch recent check-ins:", error);
      }
    };

    // 2. Setup Realtime Subscription
    const channel = supabase
      .channel('public:check_ins')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'check_ins', filter: `tenant_id=eq.${tenantId}` },
        async (payload) => {
          if (!tenantId) return;
          
          const newCheckIn = payload.new as CheckIn;
          // Fetch associated profile data for the new check-in
          const { data: profile, error } = await supabase
             .from('profiles')
             .select('first_name, last_name, avatar_url, membership_status')
             .eq('id', newCheckIn.profile_id)
             .single();

          if (error) {
              console.error("Error fetching profile for realtime check-in:", error);
          }

          if (profile) {
              newCheckIn.profiles = profile;
          }

          setCheckIns((prev) => [newCheckIn, ...prev].slice(0, 20));
          setActiveCheckIn(newCheckIn); // Auto select newest

          if (soundCuesEnabledRef.current) {
            playSound(newCheckIn.status);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          fetchRecentCheckIns();
        }
      });

    // ─── Occupancy Polling ─────────────────────────────────────────
    const fetchOccupancy = async () => {
      if (!tenantId) return;
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const res = await fetch(`${backendUrl}/api/iot/occupancy?tenant_id=${tenantId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.occupancy) {
            setOccupancy(data.occupancy);
          }
        }
      } catch (err) {
        console.error('Failed to fetch occupancy:', err);
      }
    };
    fetchOccupancy();
    const occupancyInterval = setInterval(fetchOccupancy, 15000); // every 15s
    // ───────────────────────────────────────────────────────────────

    return () => {
      supabase.removeChannel(channel);
      clearInterval(occupancyInterval);
    };
  }, []);

  const getStatusVisuals = (status: string) => {
    // If visual alerts are disabled, return a fully neutral state regardless of status
    if (!visualAlertsEnabled) {
      return { color: 'bg-surface-tint', dot: 'bg-surface-tint', label: status.replace('denied_', '').toUpperCase(), bg: 'bg-surface-muted', outline: 'border-border-hairline' };
    }

    switch (status) {
      case 'approved': return { color: 'bg-secondary', dot: 'bg-secondary', label: 'Approved', bg: 'bg-secondary-container', outline: 'border-secondary' };
      case 'warning': return { color: 'bg-warning-amber', dot: 'bg-warning-amber', label: 'Warning', bg: 'bg-warning-soft', outline: 'border-warning-amber' };
      case 'denied_debt':
      case 'denied_expired':
      case 'denied_time': return { color: 'bg-danger-crimson', dot: 'bg-danger-crimson', label: 'Blocked', bg: 'bg-danger-soft', outline: 'border-danger-crimson' };
      default: return { color: 'bg-surface-tint', dot: 'bg-surface-tint', label: status, bg: 'bg-surface-muted', outline: 'border-border-hairline' };
    }
  };

  if (loading || !tenantId) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas-bg text-on-background font-body-base">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-primary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-canvas-bg overflow-hidden text-on-background font-body-base">

      {/* SideNavBar (Predicted) */}
      <nav className="bg-inverse-surface dark:bg-on-background w-64 flex-shrink-0 h-screen border-r border-border-hairline hidden md:flex flex-col py-4 z-20">
        <div className="px-gutter mb-8 mt-2">
          <h1 className="text-subhead-sm font-bold text-surface-container-lowest">Soho Kigali</h1>
          <p className="text-on-surface-variant text-body-dense">Reception Console</p>
        </div>
        <div className="px-gutter mb-6">
          <button className="w-full bg-primary-container text-on-primary-container rounded-lg py-2 px-3 flex items-center justify-center space-x-2 border border-surface-tint/30 text-label-caps font-bold uppercase tracking-widest">
            <span className="material-symbols-outlined material-symbols-filled text-sm">qr_code_scanner</span>
            <span>Scanner Active</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ul className="space-y-1">
            <li>
              <Link className="flex items-center space-x-3 px-3 py-2 text-on-surface-variant hover:text-on-surface mx-2 hover:bg-surface-tint hover:text-white transition-colors rounded-lg group scale-95 duration-150" href="#">
                <span className="material-symbols-outlined group-hover:text-white">dashboard</span>
                <span>Dashboard</span>
              </Link>
            </li>
            <li>
              <Link className="flex items-center space-x-3 px-3 py-2 bg-primary-container text-on-primary-container rounded-lg mx-2 scale-95 duration-150 font-medium" href="#">
                <span className="material-symbols-outlined material-symbols-filled">list_alt</span>
                <span>Activity Log</span>
              </Link>
            </li>
            <li>
              <Link className="flex items-center space-x-3 px-3 py-2 text-on-surface-variant hover:text-on-surface mx-2 hover:bg-surface-tint hover:text-white transition-colors rounded-lg group scale-95 duration-150" href="/members">
                <span className="material-symbols-outlined group-hover:text-white">group</span>
                <span>Members</span>
              </Link>
            </li>
            <li>
              <Link className="flex items-center space-x-3 px-3 py-2 text-on-surface-variant hover:text-on-surface mx-2 hover:bg-surface-tint hover:text-white transition-colors rounded-lg group scale-95 duration-150" href="/pos">
                <span className="material-symbols-outlined group-hover:text-white">payments</span>
                <span>POS</span>
              </Link>
            </li>
          </ul>
        </div>
        <div className="mt-auto pt-4 border-t border-surface-tint/20">
          <div className="px-gutter mt-4 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-surface-tint/50 flex items-center justify-center text-white font-bold text-sm">
              AM
            </div>
            <div>
              <p className="text-sm font-medium text-surface-container-lowest">Admin Manager</p>
              <p className="text-xs text-on-surface-variant">Front Desk</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full min-w-0">

        {/* TopAppBar */}
        <header className="bg-surface border-b border-border-hairline flex justify-between items-center h-16 px-gutter w-full shrink-0 z-10 sticky top-0">
          <div className="flex items-center">
            <h2 className="text-headline-md font-bold text-primary mr-8 tracking-tight">Check-in Monitor</h2>
            <nav className="hidden lg:flex space-x-6">
              <Link className="text-primary border-b-2 border-primary pb-1 font-medium opacity-80 transition-opacity" href="#">Live Feed</Link>
              <Link className="text-text-muted hover:text-primary transition-all" href="#">Daily Reconciliation</Link>
              <Link className="text-text-muted hover:text-primary transition-all" href="#">Access Control</Link>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted text-sm">search</span>
              <input className="pl-9 pr-4 py-1.5 bg-surface-muted border-border-hairline border rounded-md text-body-dense focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all w-48" placeholder="Search members (⌘K)" type="text" />
            </div>
            <button className="ml-2 bg-surface-container-lowest border border-border-hairline text-primary px-3 py-1.5 rounded-md text-body-dense font-medium hover:bg-surface-muted transition-colors flex items-center gap-2 shadow-sm">
              <span className="material-symbols-outlined text-[18px]">keyboard</span>
              <span>Manual Entry <kbd className="ml-1 px-1.5 py-0.5 bg-surface-muted border border-border-hairline rounded text-[10px] font-mono-id">M</kbd></span>
            </button>
            <div className="flex items-center space-x-2 text-text-muted border-l border-border-hairline pl-4">
              <button className="p-1.5 hover:bg-surface-muted rounded-md transition-all group">
                <span className="material-symbols-outlined group-hover:text-primary">notifications</span>
              </button>
              <button className="p-1.5 hover:bg-surface-muted rounded-md transition-all group">
                <span className="material-symbols-outlined group-hover:text-primary">settings</span>
              </button>
            </div>
          </div>
        </header>

        {/* Tactical Split Canvas */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative bg-canvas-bg">

          {/* Left: Live Activity Log (65%) */}
          <div className="w-full lg:w-[65%] flex flex-col border-r border-border-hairline h-full relative z-10 bg-canvas-bg shadow-[4px_0_24px_rgba(0,0,0,0.02)]">

            {/* Table Header Sticky */}
            <div className="bg-surface border-b border-border-hairline px-4 py-3 flex justify-between items-center z-10 shrink-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-subhead-sm font-semibold text-primary">Activity Log</h3>
                <div className="flex items-center gap-4 ml-4 pl-4 border-l border-border-hairline">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Occupancy</span>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-body-base font-bold ${
                        !occupancy ? 'text-primary' :
                        occupancy.threshold_status === 'full' ? 'text-danger-crimson' :
                        occupancy.threshold_status === 'critical' ? 'text-danger-crimson' :
                        occupancy.threshold_status === 'warning' ? 'text-warning-amber' :
                        'text-primary'
                      }`}>{occupancy?.current ?? '—'}</span>
                      <span className="text-[10px] text-text-muted">/{occupancy?.max ?? '—'}</span>
                    </div>
                  </div>
                  <div className="w-24 bg-border-hairline rounded-full h-1.5 relative overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${
                        !occupancy ? 'bg-secondary' :
                        occupancy.threshold_status === 'full' ? 'bg-danger-crimson animate-pulse' :
                        occupancy.threshold_status === 'critical' ? 'bg-danger-crimson' :
                        occupancy.threshold_status === 'warning' ? 'bg-warning-amber' :
                        'bg-secondary'
                      }`}
                      style={{ width: `${Math.min(occupancy?.percentage ?? 0, 100)}%` }}
                    />
                  </div>
                  {occupancy && occupancy.threshold_status !== 'normal' && (
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${
                      occupancy.threshold_status === 'full' ? 'text-danger-crimson' :
                      occupancy.threshold_status === 'critical' ? 'text-danger-crimson' :
                      'text-warning-amber'
                    }`}>
                      {occupancy.threshold_status === 'full' ? 'FULL' : occupancy.threshold_status === 'critical' ? 'CRITICAL' : 'HIGH'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <button className="px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-text-muted hover:text-primary border border-border-hairline rounded flex items-center space-x-1 bg-surface-container-lowest">
                  <span className="material-symbols-outlined text-[14px]">filter_list</span>
                  <span>Filters</span>
                </button>
              </div>
            </div>

            {/* High-Density Table Area */}
            <div className="flex-1 overflow-auto bg-surface-container-lowest p-2 space-y-1">
              {checkIns.length === 0 ? (
                <div className="p-8 text-center text-text-muted">Waiting for check-ins...</div>
              ) : (
                checkIns.map((log) => {
                  const visuals = getStatusVisuals(log.status);
                  const isActive = activeCheckIn?.id === log.id;

                  return (
                    <div
                      key={log.id}
                      onClick={() => setActiveCheckIn(log)}
                      className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition-all ${isActive ? 'bg-surface-muted border-primary shadow-sm' : 'bg-surface-container-lowest border-transparent hover:bg-surface-muted/50'}`}
                    >
                      <div className="flex items-center space-x-3 w-1/3">
                        <div className="relative">
                          <div className={`w-8 h-8 rounded-full border border-border-hairline overflow-hidden bg-surface-container flex items-center justify-center text-primary font-medium text-sm ${isActive ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                            {log.profiles?.avatar_url ? (
                              <Image src={log.profiles.avatar_url} alt="Avatar" width={32} height={32} className="object-cover" />
                            ) : (
                              (log.profiles?.first_name?.[0] || '?') + (log.profiles?.last_name?.[0] || '?')
                            )}
                          </div>
                          {isActive && <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-primary rounded-full border-2 border-white flex items-center justify-center"><span className="material-symbols-outlined material-symbols-filled text-white text-[8px]">check</span></div>}
                        </div>
                        <div>
                          <div className="font-medium text-primary text-sm">{log.profiles?.first_name} {log.profiles?.last_name}</div>
                          <div className="text-[11px] text-text-muted">{log.profiles?.membership_status || 'Member'}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 w-1/4">
                        <span className="material-symbols-outlined text-[16px] text-text-muted">
                          {log.access_method === 'rfid' ? 'contactless' : log.access_method === 'barcode' ? 'qr_code' : 'keyboard'}
                        </span>
                        <span className="text-[12px] font-mono-id text-on-surface-variant uppercase tracking-wider">{log.access_method}</span>
                      </div>
                      <div className="flex items-center space-x-2 w-1/4">
                        {visualAlertsEnabled && <div className={`w-2 h-2 rounded-full ${visuals.dot}`}></div>}
                        <span className="text-body-dense text-on-surface-variant font-medium">{visuals.label}</span>
                      </div>
                      <div className="text-[12px] font-mono-id text-text-muted w-1/6 text-right">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Active Visitor Flash Card (35%) */}
          {activeCheckIn ? (
            <div className="w-full lg:w-[35%] bg-surface flex flex-col h-full border-l border-surface-container shadow-inner z-0">
              {/* Dynamic Header Tint */}
              <div className={`h-24 ${visualAlertsEnabled ? getStatusVisuals(activeCheckIn.status).bg : 'bg-surface'} border-b ${visualAlertsEnabled ? getStatusVisuals(activeCheckIn.status).outline : 'border-surface-container'} relative shrink-0 transition-colors duration-300`}>
                 <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent"></div>
              </div>

              <div className="px-6 relative -mt-12 flex-1 overflow-y-auto pb-24">
                {/* Profile Anchor */}
                <div className="flex justify-between items-end mb-4">
                  <div className="w-24 h-24 rounded-lg bg-surface-container-lowest border-4 border-surface shadow-sm overflow-hidden flex items-center justify-center text-3xl font-bold text-primary">
                    {activeCheckIn.profiles?.avatar_url ? (
                      <Image src={activeCheckIn.profiles.avatar_url} alt="Avatar" width={96} height={96} className="object-cover" />
                    ) : (
                      (activeCheckIn.profiles?.first_name?.[0] || '?') + (activeCheckIn.profiles?.last_name?.[0] || '?')
                    )}
                  </div>
                  <div className="mb-2 flex gap-2">
                    <button className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-text-muted hover:bg-surface-muted transition-colors"><span className="material-symbols-outlined text-[18px]">more_horiz</span></button>
                    <button className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-text-muted hover:bg-surface-muted transition-colors"><span className="material-symbols-outlined text-[18px]">open_in_new</span></button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-headline-md font-bold text-primary">{activeCheckIn.profiles?.first_name} {activeCheckIn.profiles?.last_name}</h2>
                    {visualAlertsEnabled && activeCheckIn.status === 'approved' && <span className="material-symbols-outlined material-symbols-filled text-secondary text-[20px]">verified</span>}
                  </div>
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-[12px] font-mono-id text-text-muted">ID: {activeCheckIn.profile_id.split('-')[0].toUpperCase()}</span>
                    <span className="text-[12px] text-text-muted border-l border-border-hairline pl-3">{activeCheckIn.profiles?.membership_status || 'Member'}</span>
                  </div>
                </div>

                {/* Alert Flag (Bento Style) */}
                {visualAlertsEnabled && activeCheckIn.status !== 'approved' && (
                  <div className={`p-4 rounded-xl border mb-6 ${getStatusVisuals(activeCheckIn.status).bg} ${getStatusVisuals(activeCheckIn.status).outline}`}>
                    <div className="flex items-start gap-3">
                      <span className={`material-symbols-outlined material-symbols-filled ${getStatusVisuals(activeCheckIn.status).color.replace('bg-', 'text-')}`} >error</span>
                      <div>
                        <h4 className={`text-body-base font-bold ${getStatusVisuals(activeCheckIn.status).color.replace('bg-', 'text-')}`}>{getStatusVisuals(activeCheckIn.status).label}</h4>
                        <p className={`text-body-dense mt-1 opacity-80 ${getStatusVisuals(activeCheckIn.status).color.replace('bg-', 'text-')}`}>This account requires immediate attention at the front desk. Action needed to grant facility access.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Details Grid */}
                <div className="space-y-4 mb-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-canvas-bg border border-border-hairline rounded-lg">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Entry Method</p>
                      <p className="text-body-dense font-medium text-primary flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">qr_code</span> {activeCheckIn.access_method.toUpperCase()}
                      </p>
                    </div>
                    <div className="p-3 bg-canvas-bg border border-border-hairline rounded-lg">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Timestamp</p>
                      <p className="text-[13px] font-mono-id text-primary">{new Date(activeCheckIn.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                </div>

                {/* Waiver Status */}
                <div className="border-t border-border-hairline pt-6">
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-4">Required Documents</h4>
                  <div className="flex items-center justify-between p-3 border border-border-hairline rounded-lg bg-surface-container-lowest">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-success-soft flex items-center justify-center text-secondary"><span className="material-symbols-outlined material-symbols-filled text-[16px]">check_circle</span></div>
                      <div>
                        <p className="text-body-dense font-medium text-primary">Liability Waiver</p>
                        <p className="text-[11px] text-text-muted">Signed Jan 15, 2024</p>
                      </div>
                    </div>
                    <button className="text-[12px] font-medium text-text-muted hover:text-primary transition-colors">View</button>
                  </div>
                </div>
              </div>

              {/* Fixed Action Footer */}
              <div className="absolute bottom-0 right-0 w-full lg:w-[35%] p-4 bg-surface/80 backdrop-blur-md border-t border-border-hairline flex gap-3 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
                {activeCheckIn.status === 'approved' ? (
                  <>
                    <button className="flex-1 bg-surface-container-lowest border border-border-hairline text-primary rounded-lg py-3 font-semibold text-body-dense hover:bg-surface-muted transition-colors shadow-sm">View Full Profile</button>
                    {!activeCheckIn.checkout_at && (
                      <button
                        disabled={checkingOut}
                        onClick={async () => {
                          setCheckingOut(true);
                          try {
                            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
                            const res = await fetch(`${backendUrl}/api/iot/checkout`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                tenant_id: activeCheckIn.tenant_id,
                                profile_id: activeCheckIn.profile_id,
                                checkout_method: 'manual'
                              })
                            });
                            if (res.ok) {
                              const result = await res.json();
                              setActiveCheckIn(prev => prev ? { ...prev, checkout_at: result.checkout_at, checkout_method: 'manual' } : null);
                              if (result.occupancy) {
                                setOccupancy(prev => prev ? { ...prev, current: result.occupancy.current } : prev);
                              }
                            }
                          } catch (err) {
                            console.error('Checkout failed:', err);
                          } finally {
                            setCheckingOut(false);
                          }
                        }}
                        className="flex-1 bg-primary text-on-primary rounded-lg py-3 font-semibold text-body-dense hover:bg-primary/90 transition-colors shadow-md flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">logout</span>
                        {checkingOut ? 'Checking Out…' : 'Check Out'}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button className="flex-1 bg-primary text-on-primary rounded-lg py-3 font-semibold text-body-dense hover:bg-primary/90 transition-colors shadow-md">Override Entry</button>
                    <button className="flex-1 bg-surface-container-lowest border border-border-hairline text-primary rounded-lg py-3 font-semibold text-body-dense hover:bg-surface-muted transition-colors shadow-sm">Resolve Issue</button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full lg:w-[35%] bg-surface flex flex-col items-center justify-center h-full border-l border-surface-container text-text-muted">
               <span className="material-symbols-outlined text-4xl mb-2 opacity-50">badge</span>
               <p>Select a check-in to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
