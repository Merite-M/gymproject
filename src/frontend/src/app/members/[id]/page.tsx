"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useTenantId } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  History,
  FileText,
  UserCheck,
  CalendarDays,
  Activity,
  Edit,
  Mail,
  Phone,
  MoreVertical,
  PauseCircle,
  MapPin,
  HeartPulse,
  Users,
  FileSignature,
  PenTool,
  Download,
  Loader2,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import HoldManagement from "@/components/hold-management";
import HoldList from "@/components/hold-list";
import { AccessControlPWA } from "@/components/access-control-pwa";
import { ContractSignerModal } from "@/components/contract-signer-modal";
import { TierUpgradeModal } from "@/components/tier-upgrade-modal";
import { getMemberContracts, type SignedContractSummary } from "@/lib/api/contracts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://omufxcaifzqepvqbgghc.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy_key_for_build";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function MemberProfileClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const tenantId = useTenantId();

  // State from original file
  const [profile, setProfile] = useState<any>(null);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [holds, setHolds] = useState<any[]>([]);
  const [familyLinks, setFamilyLinks] = useState<any[]>([]);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [contracts, setContracts] = useState<SignedContractSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Edit Profile Form State
  const [editFormData, setEditFormData] = useState<any>({});

  useEffect(() => {
    const fetchMemberData = async () => {
      if (!tenantId) return;
      setLoading(true);
      try {
        // Fetch Current User
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user) setCurrentUser(session.session.user);

        // Fetch Profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", resolvedParams.id)
          .eq("tenant_id", tenantId)
          .single();
        if (profileError) throw profileError;

        // Fetch Memberships
        const { data: memData, error: memError } = await supabase
          .from("memberships")
          .select("*")
          .eq("profile_id", resolvedParams.id)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });
        if (memError) console.error("Membership fetch error:", memError);

        // Fetch Holds
        const { data: holdData, error: holdError } = await supabase
          .from("membership_holds")
          .select("*")
          .eq("profile_id", resolvedParams.id)
          .eq("tenant_id", tenantId);
        if (holdError) console.error("Holds fetch error:", holdError);

        // Fetch Family Links
        const { data: famData, error: famError } = await supabase
          .from("family_links")
          .select(`
            *,
            master:master_account_id(id, first_name, last_name),
            dependent:dependent_account_id(id, first_name, last_name)
          `)
          .or(`master_account_id.eq.${resolvedParams.id},dependent_account_id.eq.${resolvedParams.id}`);
        if (famError) console.error("Family links fetch error:", famError);
        setFamilyLinks(famData || []);

        // Fetch Contracts
        try {
          const contractList = await getMemberContracts(tenantId, resolvedParams.id);
          setContracts(contractList);
        } catch (cErr) {
          console.error("Contracts fetch error:", cErr);
        }

        // Fetch Check-ins
        const { data: checkData, error: checkError } = await supabase
          .from("check_ins")
          .select("*")
          .eq("profile_id", resolvedParams.id)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(10);
        if (checkError) console.error("Check-ins fetch error:", checkError);

        setProfile(profileData);
        setEditFormData(profileData || {});
        setMemberships(memData || []);
        setHolds(holdData || []);
        setCheckIns(checkData || []);
      } catch (err: any) {
        setError(err.message || "Failed to load member profile");
      } finally {
        setLoading(false);
      }
    };

    fetchMemberData();
  }, [resolvedParams.id, tenantId]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: editFormData.first_name,
          last_name: editFormData.last_name,
          phone: editFormData.phone,
          status: editFormData.status,
          pin_code: editFormData.pin_code,
          medical_clearance: editFormData.medical_clearance,
        })
        .eq("id", resolvedParams.id)
        .eq("tenant_id", tenantId);

      if (error) throw error;
      setProfile(editFormData);
      setShowEditModal(false);
    } catch (err: any) {
      alert("Error updating profile: " + err.message);
    }
  };

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const handleHoldAction = async (holdId: string, action: string) => {
    try {
      let status = action;
      if (action === 'approve') status = 'approved';
      if (action === 'deny') status = 'denied';
      if (action === 'end') status = 'ended';
      if (action === 'cancel') status = 'cancelled';

      const res = await fetch(`${API_URL}/api/membership-holds/${holdId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, status }),
      });
      if (!res.ok) throw new Error(await res.text());

      // Refresh holds
      const { data: holdData } = await supabase
        .from("membership_holds")
        .select("*")
        .eq("profile_id", resolvedParams.id)
        .eq("tenant_id", tenantId);
      setHolds(holdData || []);
    } catch (err: any) {
      alert(`Error performing hold action: ${err.message}`);
    }
  };

  const handleHoldSubmit = async (formData: any) => {
    try {
      const res = await fetch(`${API_URL}/api/membership-holds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          tenant_id: tenantId,
          profile_id: resolvedParams.id,
          membership_id: memberships[0]?.id
        }),
      });
      if (!res.ok) throw new Error(await res.text());

      setShowHoldModal(false);
      // Refresh holds
      const { data: holdData } = await supabase
        .from("membership_holds")
        .select("*")
        .eq("profile_id", resolvedParams.id)
        .eq("tenant_id", tenantId);
      setHolds(holdData || []);
    } catch (err: any) {
      alert(`Error submitting hold: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-muted-foreground flex-col gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-xs">Loading member profile...</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-status-blocked">
        <p>{error || "Member not found"}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background text-foreground overflow-hidden relative font-body-base">
      {/* Top Header */}
      <div className="bg-surface border-b border-border px-8 py-5 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-xl bg-primary/15 text-primary flex items-center justify-center text-xl font-bold font-mono border border-primary/30 shadow-sm">
            {profile.first_name?.[0]}{profile.last_name?.[0]}
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-3">
              {profile.first_name} {profile.last_name}
              <Badge
                variant="outline"
                className={`text-xs ${
                  profile.status === 'active'
                    ? 'bg-status-cleared/10 text-status-cleared border-status-cleared/30'
                    : 'bg-status-blocked/10 text-status-blocked border-status-blocked/30'
                }`}
              >
                {profile.status === 'active' ? 'Active Member' : profile.status}
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              Member ID: {profile.id.substring(0, 8).toUpperCase()} • Joined {new Date(profile.created_at || "2023-01-01").toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTierModal(true)}
            className="text-xs gap-1.5 bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Upgrade / Change Tier</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHoldModal(true)}
            className="text-xs gap-1.5"
          >
            <PauseCircle className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Freeze / Hold</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowContractModal(true)}
            className="text-xs gap-1.5 text-primary border-primary/30 bg-primary/5 hover:bg-primary/10"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Sign Agreement</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setShowEditModal(true)}
            className="text-xs gap-1.5 bg-primary text-primary-foreground"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">

          {/* Left Column: Profile Info */}
          <div className="w-full lg:w-1/3 flex flex-col gap-6">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3 border-b border-border bg-surface-container/30">
                <CardTitle className="text-sm font-heading font-bold text-foreground">Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Email</p>
                    <p className="text-foreground mt-0.5">{profile.email || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Phone</p>
                    <p className="text-foreground mt-0.5">{profile.phone || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CalendarDays className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Date of Birth</p>
                    <p className="text-foreground mt-0.5">{profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Address</p>
                    <p className="text-foreground mt-0.5">{profile.address || 'Kigali, Rwanda'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3 border-b border-border bg-surface-container/30">
                <CardTitle className="text-sm font-heading font-bold text-foreground">Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2 text-xs">
                <div className="flex items-start gap-3">
                  <HeartPulse className="w-4 h-4 text-status-blocked mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">{profile.emergency_contact_name || 'Not Provided'}</p>
                    <p className="text-muted-foreground mt-0.5">{profile.emergency_contact_phone || '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Operational Tabs */}
          <div className="w-full lg:w-2/3">
            <Tabs defaultValue="overview" className="w-full space-y-4">
              <TabsList className="bg-surface-container p-1 rounded-lg border border-border">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="access" className="text-xs">Dynamic Pass & Hardware</TabsTrigger>
                <TabsTrigger value="holds" className="text-xs">Holds & Freezes</TabsTrigger>
                <TabsTrigger value="contracts" className="text-xs">Contracts & Waivers</TabsTrigger>
                <TabsTrigger value="family" className="text-xs">Family Links</TabsTrigger>
                <TabsTrigger value="activity" className="text-xs">Access Logs</TabsTrigger>
              </TabsList>

              {/* ACCESS & HARDWARE PASS TAB */}
              <TabsContent value="access" className="mt-0 outline-none space-y-4">
                <AccessControlPWA
                  tenantId={tenantId || "00000000-0000-0000-0000-000000000000"}
                  profileId={profile?.id || "mock-id"}
                  memberFullName={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()}
                />
              </TabsContent>

              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="mt-0 space-y-6 outline-none">
                <Card className="border-border bg-card overflow-hidden">
                  <div className="bg-surface-container/60 px-6 py-5 border-b border-border flex justify-between items-center">
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Active Membership Plan</h3>
                      {memberships.length > 0 ? (
                        <div className="flex items-end gap-3">
                          <h2 className="text-2xl font-bold text-foreground font-heading">{memberships[0].membership_type}</h2>
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 mb-1">
                            {memberships[0].billing_interval !== 'one_time' ? 'Auto-Renews' : 'Fixed Term'}
                          </Badge>
                        </div>
                      ) : (
                        <h2 className="text-lg font-bold text-muted-foreground">No Active Plan</h2>
                      )}
                    </div>
                    <CreditCard className="w-8 h-8 text-primary/60" />
                  </div>
                  {memberships.length > 0 && (
                    <div className="px-6 py-4 grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-muted-foreground font-medium">Start Date</p>
                        <p className="font-semibold text-foreground mt-0.5">{new Date(memberships[0].start_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground font-medium">End Date</p>
                        <p className="font-semibold text-foreground mt-0.5">{memberships[0].end_date ? new Date(memberships[0].end_date).toLocaleDateString() : 'Indefinite'}</p>
                      </div>
                    </div>
                  )}
                </Card>

                {/* Recent Check-ins */}
                <Card className="border-border bg-card overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border">
                    <CardTitle className="text-sm font-heading font-bold text-foreground">Recent Check-ins</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-surface-container/50">
                        <TableRow>
                          <TableHead className="text-xs">Timestamp</TableHead>
                          <TableHead className="text-xs">Method</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {checkIns.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-6 text-xs text-muted-foreground">No check-in history found.</TableCell>
                          </TableRow>
                        ) : (
                          checkIns.map((ci) => (
                            <TableRow key={ci.id}>
                              <TableCell className="text-xs font-mono text-foreground">
                                {new Date(ci.created_at).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-xs capitalize text-muted-foreground">
                                {ci.access_method || 'Scanner'}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    ci.status === 'cleared'
                                      ? 'bg-status-cleared/10 text-status-cleared border-status-cleared/30'
                                      : 'bg-status-blocked/10 text-status-blocked border-status-blocked/30'
                                  }`}
                                >
                                  {ci.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* HOLDS & FREEZES TAB */}
              <TabsContent value="holds" className="mt-0 outline-none space-y-4">
                <Card className="border-border bg-card p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                      <PauseCircle className="w-4 h-4 text-primary" /> Active & Historical Freezes
                    </h3>
                    <Button size="sm" onClick={() => setShowHoldModal(true)} className="text-xs">
                      Request New Freeze
                    </Button>
                  </div>
                  <HoldList
                    holds={holds}
                    onApprove={(id) => handleHoldAction(id, 'approve')}
                    onDeny={(id) => handleHoldAction(id, 'deny')}
                    onEndEarly={(id) => handleHoldAction(id, 'end')}
                    onCancel={(id) => handleHoldAction(id, 'cancel')}
                    currentUserRole={currentUser?.role || 'staff'}
                  />
                </Card>
              </TabsContent>

              {/* CONTRACTS & WAIVERS TAB */}
              <TabsContent value="contracts" className="mt-0 outline-none space-y-4">
                <Card className="border-border bg-card overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-heading font-bold text-foreground flex items-center gap-2">
                        <FileSignature className="w-4 h-4 text-primary" /> Legally Executed Agreements
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">Cryptographically audited contracts and liability waivers.</CardDescription>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setShowContractModal(true)}
                      className="text-xs gap-1.5 bg-primary text-primary-foreground"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>Sign Agreement</span>
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-surface-container/50">
                        <TableRow>
                          <TableHead className="text-xs">Document Title</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Signed Date</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-right text-xs">Audit IP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contracts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                              No signed agreements found. Click "Sign Agreement" to compile and execute.
                            </TableCell>
                          </TableRow>
                        ) : (
                          contracts.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell className="font-medium text-xs text-foreground">
                                {c.title}
                              </TableCell>
                              <TableCell className="capitalize text-xs text-muted-foreground">
                                {c.contract_templates?.contract_type || 'Membership'}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground">
                                {new Date(c.signed_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] bg-status-cleared/10 text-status-cleared border-status-cleared/30">
                                  Signed Record
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-xs font-mono text-muted-foreground">
                                {c.ip_address || '—'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* FAMILY LINKS TAB */}
              <TabsContent value="family" className="mt-0 outline-none space-y-4">
                <Card className="border-border bg-card overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border">
                    <CardTitle className="text-sm font-heading font-bold text-foreground flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" /> Family & Linked Dependents
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-surface-container/50">
                        <TableRow>
                          <TableHead className="text-xs">Member Name</TableHead>
                          <TableHead className="text-xs">Relationship</TableHead>
                          <TableHead className="text-xs">Role</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {familyLinks.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-6 text-xs text-muted-foreground">No linked family accounts.</TableCell>
                          </TableRow>
                        ) : (
                          familyLinks.map((link) => {
                            const isMaster = link.master_account_id === profile.id;
                            const related = isMaster ? link.dependent : link.master;
                            return (
                              <TableRow key={link.id}>
                                <TableCell className="text-xs font-semibold">
                                  <Link href={`/members/${related.id}`} className="text-primary hover:underline">
                                    {related.first_name} {related.last_name}
                                  </Link>
                                </TableCell>
                                <TableCell className="capitalize text-xs text-muted-foreground">{link.relationship_type}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[10px] bg-surface-container">
                                    {isMaster ? 'Dependent' : 'Master Account'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ACCESS LOGS TAB */}
              <TabsContent value="activity" className="mt-0 outline-none">
                <Card className="border-border bg-card p-6 text-center text-xs text-muted-foreground">
                  <Activity className="w-8 h-8 text-primary/40 mx-auto mb-2" />
                  <p>Comprehensive gate telemetry and access audit logs for this member.</p>
                </Card>
              </TabsContent>

            </Tabs>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in-0 zoom-in-95">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-surface">
              <h3 className="font-heading font-bold text-foreground text-base">Edit Member Profile</h3>
              <button onClick={() => setShowEditModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form onSubmit={handleProfileUpdate} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-muted-foreground mb-1">First Name</label>
                  <input
                    required
                    type="text"
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md focus:ring-1 focus:ring-primary outline-none"
                    value={editFormData.first_name || ''}
                    onChange={e => setEditFormData({ ...editFormData, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-medium text-muted-foreground mb-1">Last Name</label>
                  <input
                    required
                    type="text"
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md focus:ring-1 focus:ring-primary outline-none"
                    value={editFormData.last_name || ''}
                    onChange={e => setEditFormData({ ...editFormData, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-muted-foreground mb-1">Phone</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md focus:ring-1 focus:ring-primary outline-none"
                    value={editFormData.phone || ''}
                    onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-medium text-muted-foreground mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md focus:ring-1 focus:ring-primary outline-none"
                    value={editFormData.email || ''}
                    onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowEditModal(false)}>Cancel</Button>
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground">Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hold Management Modal */}
      {showHoldModal && tenantId && profile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-xl overflow-hidden p-6">
            <HoldManagement
              tenantId={tenantId}
              membershipId={memberships[0]?.id || 'default-membership'}
              profileId={profile.id}
              currentUserId={currentUser?.id || profile.id}
              membershipPrice={parseFloat(memberships[0]?.price || 50000)}
              billingInterval={memberships[0]?.billing_interval || 'monthly'}
              onCancel={() => setShowHoldModal(false)}
              onSubmit={handleHoldSubmit}
            />
          </div>
        </div>
      )}

      {/* Contract Signer Modal */}
      {tenantId && profile && (
        <ContractSignerModal
          isOpen={showContractModal}
          onClose={() => setShowContractModal(false)}
          tenantId={tenantId}
          profileId={profile.id}
          memberFullName={`${profile.first_name || ''} ${profile.last_name || ''}`.trim()}
          onSignedSuccess={async () => {
            try {
              const updated = await getMemberContracts(tenantId, profile.id);
              setContracts(updated);
            } catch (e) {
              console.error(e);
            }
          }}
        />
      )}
      {/* Tier Upgrade & Proration Modal */}
      {tenantId && profile && (
        <TierUpgradeModal
          isOpen={showTierModal}
          onClose={() => setShowTierModal(false)}
          tenantId={tenantId}
          profileId={profile.id}
          memberFullName={`${profile.first_name || ''} ${profile.last_name || ''}`.trim()}
          onTierChangedSuccess={async () => {
            try {
              const { data: memData } = await supabase
                .from("memberships")
                .select("*")
                .eq("profile_id", profile.id)
                .eq("tenant_id", tenantId)
                .order("created_at", { ascending: false });
              setMemberships(memData || []);
            } catch (e) {
              console.error(e);
            }
          }}
        />
      )}
    </div>
  );
}
