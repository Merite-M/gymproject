/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  History,
  FileText,
  AlertTriangle,
  UserCheck,
  CalendarDays,
  Users,
  Activity,
  Edit,
  Mail,
  Phone,
  MoreVertical,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://omufxcaifzqepvqbgghc.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy_key_for_build";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function MemberProfileClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [profile, setProfile] = useState<any>(null);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [holds, setHolds] = useState<any[]>([]);
  const [familyLinks, setFamilyLinks] = useState<any[]>([]);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hardcoded for structural replication
  const mockOtherMembers = [
    { id: '1', name: 'Marcus Johnson', plan: 'VIP Annual', status: 'Active', bg: 'bg-surface-container-lowest' },
    { id: '2', name: 'Elena Rodriguez', plan: 'Day Pass', status: 'Expired', bg: 'bg-surface-container-lowest' },
    { id: '3', name: 'David Chen', plan: 'Monthly Flex', status: 'Payment Due', bg: 'bg-surface-container-lowest' },
  ];

  useEffect(() => {
    const fetchMemberData = async () => {
      setLoading(true);
      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", resolvedParams.id)
          .single();
        if (profileError) throw profileError;

        const { data: memData } = await supabase
          .from("memberships")
          .select("*")
          .eq("profile_id", resolvedParams.id);

        const { data: holdData } = await supabase
          .from("membership_holds")
          .select("*")
          .eq("profile_id", resolvedParams.id);

        const { data: famData } = await supabase
          .from("family_links")
          .select("*, master:master_account_id(*), dependent:dependent_account_id(*)")
          .or(`master_account_id.eq.${resolvedParams.id},dependent_account_id.eq.${resolvedParams.id}`);

        const { data: checkinData } = await supabase
          .from("check_ins")
          .select("*")
          .eq("profile_id", resolvedParams.id)
          .order("created_at", { ascending: false })
          .limit(5);

        setProfile(profileData as any);
        setMemberships(memData || []);
        setHolds(holdData || []);
        setFamilyLinks(famData || []);
        setCheckIns(checkinData || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMemberData();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas-bg font-body-base text-primary">
        Loading...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas-bg font-body-base text-danger-crimson">
        Error: {error}
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas-bg font-body-base text-text-muted">
        Member not found.
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-canvas-bg text-on-background font-body-base overflow-hidden">

      {/* SideNavBar */}
      <nav className="bg-inverse-surface dark:bg-on-background w-64 h-screen border-r border-border-hairline hidden md:flex flex-col py-4 z-20 shrink-0">
        <div className="px-gutter mb-8 mt-2">
          <h1 className="text-subhead-sm font-bold text-surface-container-lowest">Soho Kigali</h1>
          <p className="text-on-surface-variant text-body-dense">CRM Terminal</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ul className="space-y-1">
            <li>
              <Link className="flex items-center space-x-3 px-3 py-2 text-on-surface-variant hover:text-on-surface mx-2 hover:bg-surface-tint hover:text-white transition-colors rounded-lg group scale-95 duration-150" href="/monitor">
                <span className="material-symbols-outlined group-hover:text-white">dashboard</span>
                <span>Monitor</span>
              </Link>
            </li>
            <li>
              <Link className="flex items-center space-x-3 px-3 py-2 bg-primary-container text-on-primary-container rounded-lg mx-2 scale-95 duration-150 font-medium" href="/members">
                <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>group</span>
                <span>Directory</span>
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
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* TopAppBar */}
        <header className="bg-surface border-b border-border-hairline flex justify-between items-center h-16 px-gutter w-full shrink-0 z-10 sticky top-0">
          <div className="flex items-center">
            <h2 className="text-headline-md font-bold text-primary tracking-tight">Member 360°</h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted text-sm">search</span>
              <input className="pl-9 pr-4 py-1.5 bg-surface-muted border border-border-hairline rounded-md text-body-dense focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all w-64" placeholder="Search ID, Name, Phone..." type="text" />
            </div>
            <button className="bg-primary text-on-primary px-3 py-1.5 rounded-md text-body-dense font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm">
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>New Member</span>
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden relative bg-canvas-bg">

          {/* Directory Sidebar (30%) */}
          <div className="w-[30%] border-r border-border-hairline bg-surface flex flex-col h-full z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
            <div className="p-4 border-b border-border-hairline bg-surface-container-lowest shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-primary">Directory</h3>
                <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted bg-surface-muted px-2 py-0.5 rounded-full">1,248</span>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-1.5 text-[11px] font-bold uppercase tracking-widest text-primary border-b-2 border-primary">Active</button>
                <button className="flex-1 py-1.5 text-[11px] font-bold uppercase tracking-widest text-text-muted hover:text-primary transition-colors border-b-2 border-transparent">Leads</button>
                <button className="flex-1 py-1.5 text-[11px] font-bold uppercase tracking-widest text-text-muted hover:text-primary transition-colors border-b-2 border-transparent">Lapsed</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Selected Member */}
              <div className="flex items-center gap-3 p-3 bg-primary-fixed border border-primary-fixed-dim rounded-lg cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-white border border-border-hairline overflow-hidden flex items-center justify-center font-bold text-primary">
                  {profile.avatar_url ? (
                    <Image src={profile.avatar_url} alt="Avatar" width={40} height={40} className="object-cover" />
                  ) : (
                    (profile.first_name?.[0] || "?") + (profile.last_name?.[0] || "?")
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h4 className="font-bold text-on-primary-fixed truncate">{profile.first_name} {profile.last_name}</h4>
                    <span className="w-2 h-2 rounded-full bg-secondary shrink-0"></span>
                  </div>
                  <p className="text-body-dense text-on-primary-fixed-variant truncate">{profile.membership_status || 'Member'}</p>
                </div>
              </div>

              {/* Other Members (Mocked for layout) */}
              {mockOtherMembers.map((m, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 ${m.bg} border border-border-hairline hover:border-outline-variant rounded-lg cursor-pointer transition-colors`}>
                  <div className="w-10 h-10 rounded-full bg-surface-muted border border-border-hairline flex items-center justify-center font-bold text-text-muted">
                    {m.name.split(' ').map(n=>n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h4 className="font-medium text-primary truncate">{m.name}</h4>
                      {m.status === 'Active' ? <span className="w-2 h-2 rounded-full bg-secondary shrink-0"></span> : <span className="w-2 h-2 rounded-full bg-danger-crimson shrink-0"></span>}
                    </div>
                    <p className="text-body-dense text-text-muted truncate">{m.plan}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Profile Console (70%) */}
          <div className="w-[70%] flex flex-col h-full bg-canvas-bg overflow-y-auto">
            {/* Console Header */}
            <div className="bg-surface border-b border-border-hairline p-8 pb-0 shrink-0">
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-xl bg-surface-container-lowest border border-border-hairline shadow-sm overflow-hidden flex items-center justify-center text-3xl font-bold text-primary">
                      {profile.avatar_url ? (
                        <Image src={profile.avatar_url} alt="Avatar" width={96} height={96} className="object-cover" />
                      ) : (
                        (profile.first_name?.[0] || "?") + (profile.last_name?.[0] || "?")
                      )}
                    </div>
                    <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-surface-container-lowest border border-border-hairline text-text-muted hover:text-primary shadow-sm flex items-center justify-center transition-colors">
                      <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                    </button>
                  </div>
                  <div className="pt-2">
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-[28px] font-headline-md font-bold text-primary tracking-tight leading-none">{profile.first_name} {profile.last_name}</h2>
                      <span className="px-2 py-0.5 bg-success-soft text-secondary text-[11px] font-bold uppercase tracking-widest rounded-full border border-secondary-fixed-dim/30">Active</span>
                    </div>
                    <p className="text-subhead-sm text-text-muted mb-4 font-mono-id">ID: {profile.id.split('-')[0].toUpperCase()} • Joined {new Date(profile.created_at).getFullYear()}</p>
                    <div className="flex gap-4">
                      <button className="flex items-center gap-2 text-body-dense text-text-muted hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[16px]">mail</span> {profile.email}
                      </button>
                      <button className="flex items-center gap-2 text-body-dense text-text-muted hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[16px]">phone</span> {profile.phone || 'Add Phone'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-surface-container-lowest border border-border-hairline text-primary rounded-lg text-body-dense font-semibold hover:bg-surface-muted transition-colors shadow-sm">Send Message</button>
                  <button className="px-4 py-2 bg-primary text-on-primary rounded-lg text-body-dense font-semibold hover:bg-primary/90 transition-colors shadow-sm">Check In</button>
                  <button className="w-10 h-10 flex items-center justify-center bg-surface-container-lowest border border-border-hairline text-text-muted rounded-lg hover:bg-surface-muted transition-colors shadow-sm">
                    <span className="material-symbols-outlined text-[20px]">more_horiz</span>
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="memberships" className="w-full">
                <TabsList className="flex gap-8 mb-[-1px] w-full justify-start h-auto bg-transparent border-0 p-0 rounded-none">
                  <TabsTrigger value="memberships" className="py-3 px-0 border-b-2 rounded-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=inactive]:border-transparent data-[state=inactive]:text-text-muted text-body-base font-medium transition-colors bg-transparent data-[state=active]:shadow-none data-[state=active]:bg-transparent">Memberships</TabsTrigger>
                  <TabsTrigger value="billing" className="py-3 px-0 border-b-2 rounded-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=inactive]:border-transparent data-[state=inactive]:text-text-muted text-body-base font-medium transition-colors bg-transparent data-[state=active]:shadow-none data-[state=active]:bg-transparent">Billing</TabsTrigger>
                  <TabsTrigger value="activity" className="py-3 px-0 border-b-2 rounded-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=inactive]:border-transparent data-[state=inactive]:text-text-muted text-body-base font-medium transition-colors bg-transparent data-[state=active]:shadow-none data-[state=active]:bg-transparent">Activity</TabsTrigger>
                  <TabsTrigger value="family" className="py-3 px-0 border-b-2 rounded-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=inactive]:border-transparent data-[state=inactive]:text-text-muted text-body-base font-medium transition-colors bg-transparent data-[state=active]:shadow-none data-[state=active]:bg-transparent">Family & Links</TabsTrigger>
                </TabsList>

                {/* Content below header */}
                <div className="py-8 space-y-6">
                  <TabsContent value="memberships" className="mt-0 outline-none space-y-6">
                    {/* Active Plan Card */}
                    <div className="bg-surface-container-lowest border border-border-hairline rounded-xl shadow-sm overflow-hidden">
                      <div className="p-6 flex justify-between items-center border-b border-border-hairline bg-canvas-bg/50">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1">Current Plan</p>
                          <h3 className="text-headline-md font-bold text-primary">VIP Annual Access</h3>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1">Status</p>
                          <span className="px-2 py-1 bg-success-soft text-secondary text-[12px] font-bold uppercase tracking-widest rounded border border-secondary-fixed-dim/30">Active</span>
                        </div>
                      </div>
                      <div className="p-6 grid grid-cols-3 gap-6">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-2">Billing Cycle</p>
                          <p className="text-body-base font-medium text-primary">Monthly</p>
                          <p className="text-body-dense text-text-muted font-mono-id mt-1">$149.00 / mo</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-2">Next Payment</p>
                          <p className="text-body-base font-medium text-primary font-mono-id">Nov 15, 2024</p>
                          <p className="text-body-dense text-text-muted mt-1">Via Visa ending in 4242</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-2">Commitment</p>
                          <p className="text-body-base font-medium text-primary font-mono-id">Ends Oct 2025</p>
                          <p className="text-body-dense text-text-muted mt-1">10 months remaining</p>
                        </div>
                      </div>
                      <div className="px-6 py-4 bg-surface flex gap-3 border-t border-border-hairline">
                        <button className="px-4 py-2 bg-surface-container-lowest border border-border-hairline text-primary rounded-lg text-body-dense font-semibold hover:bg-surface-muted transition-colors shadow-sm flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">pause_circle</span> Place on Hold</button>
                        <button className="px-4 py-2 bg-surface-container-lowest border border-border-hairline text-primary rounded-lg text-body-dense font-semibold hover:bg-surface-muted transition-colors shadow-sm flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">upgrade</span> Upgrade Plan</button>
                        <div className="flex-1"></div>
                        <button className="px-4 py-2 text-danger-crimson hover:bg-danger-soft/50 rounded-lg text-body-dense font-semibold transition-colors">Cancel Membership</button>
                      </div>
                    </div>

                    {/* Waivers & Agreements */}
                    <div>
                      <h3 className="text-subhead-sm font-bold text-primary mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-text-muted">description</span> Documents & Waivers
                      </h3>
                      <div className="bg-surface-container-lowest border border-border-hairline rounded-xl shadow-sm divide-y divide-border-hairline">
                        <div className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-secondary" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                            <div>
                              <p className="text-body-base font-medium text-primary">General Liability Waiver</p>
                              <p className="text-body-dense text-text-muted font-mono-id">Signed Oct 15, 2023</p>
                            </div>
                          </div>
                          <button className="text-body-dense font-medium text-primary hover:underline">View Document</button>
                        </div>
                        <div className="p-4 flex items-center justify-between bg-warning-soft/20">
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-warning-amber" style={{fontVariationSettings: "'FILL' 1"}}>warning</span>
                            <div>
                              <p className="text-body-base font-medium text-primary">24/7 Access Addendum</p>
                              <p className="text-body-dense text-warning-amber font-medium">Signature Required</p>
                            </div>
                          </div>
                          <button className="px-3 py-1.5 bg-surface-container-lowest border border-border-hairline text-primary rounded-md text-body-dense font-medium hover:bg-surface-muted transition-colors shadow-sm">Send Request</button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="billing" className="mt-0 outline-none">
                    <div className="bg-surface-container-lowest border border-border-hairline rounded-xl p-8 text-center text-text-muted">Billing Integration Active</div>
                  </TabsContent>

                  <TabsContent value="activity" className="mt-0 outline-none">
                    <div className="bg-surface-container-lowest border border-border-hairline rounded-xl shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-border-hairline flex justify-between items-center bg-canvas-bg/50">
                        <h3 className="font-bold text-primary">Recent Check-ins</h3>
                      </div>
                      <div className="divide-y divide-border-hairline">
                        {checkIns.length === 0 ? (
                          <div className="p-6 text-center text-text-muted">No activity found.</div>
                        ) : (
                          checkIns.map((ci) => (
                            <div key={ci.id} className="p-4 flex items-center justify-between hover:bg-surface-muted/30 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-surface-muted flex items-center justify-center text-text-muted">
                                  <span className="material-symbols-outlined text-[20px]">{ci.access_method === 'rfid' ? 'contactless' : 'qr_code'}</span>
                                </div>
                                <div>
                                  <p className="text-body-base font-medium text-primary">Front Desk Entry</p>
                                  <p className="text-body-dense text-text-muted font-mono-id uppercase tracking-wider">{ci.access_method}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-body-base font-medium text-primary font-mono-id">{new Date(ci.created_at).toLocaleDateString()}</p>
                                <p className="text-body-dense text-text-muted font-mono-id">{new Date(ci.created_at).toLocaleTimeString()}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="family" className="mt-0 outline-none">
                     <div className="bg-surface-container-lowest border border-border-hairline rounded-xl shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-border-hairline flex justify-between items-center bg-canvas-bg/50">
                        <h3 className="font-bold text-primary">Linked Accounts</h3>
                        <button className="text-body-dense font-medium text-primary flex items-center gap-1 hover:underline"><span className="material-symbols-outlined text-[16px]">add</span> Link Member</button>
                      </div>
                      {familyLinks.length === 0 ? (
                         <div className="p-6 text-center text-text-muted">No linked family accounts.</div>
                      ) : (
                        <div className="divide-y divide-border-hairline p-4">
                            {familyLinks.map((link) => {
                              const isMaster = link.master_account_id === resolvedParams.id;
                              const relative = isMaster ? link.dependent : link.master;
                              if (!relative) return null;
                              return (
                                <div key={link.id} className="flex justify-between items-center py-3">
                                  <div className="flex gap-3 items-center">
                                      <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-bold text-text-muted">
                                          {relative.first_name[0]}{relative.last_name[0]}
                                      </div>
                                      <div>
                                          <p className="text-body-base font-bold text-primary">{relative.first_name} {relative.last_name}</p>
                                          <p className="text-body-dense text-text-muted capitalize">{isMaster ? link.relationship_type : "Master Account"}</p>
                                      </div>
                                  </div>
                                  <button className="p-2 text-text-muted hover:bg-surface-muted rounded-md transition-colors"><span className="material-symbols-outlined">more_horiz</span></button>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                </div>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
