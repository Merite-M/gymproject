"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useTenantId } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  Users
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
import HoldManagement from "@/components/hold-management";
import HoldList from "@/components/hold-list";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
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
          .select("*, dependent:dependent_account_id(*), master:master_account_id(*)")
          .or(`master_account_id.eq.${resolvedParams.id},dependent_account_id.eq.${resolvedParams.id}`)
          .eq("tenant_id", tenantId);
        if (famError) console.error("Family fetch error:", famError);

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
        setEditFormData(profileData);
        setMemberships(memData || []);
        setHolds(holdData || []);
        setFamilyLinks(famData || []);
        setCheckIns(checkData || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMemberData();
  }, [resolvedParams.id, tenantId]);

  // Hold Handlers (from original)
  const handleHoldSubmit = async (holdRequest: any) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/membership-holds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...holdRequest, tenant_id: tenantId }),
      });
      const data = await response.json();
      if (response.ok) {
        const { data: holdData } = await supabase.from("membership_holds").select("*").eq("profile_id", resolvedParams.id).eq("tenant_id", tenantId);
        setHolds(holdData || []);
        setShowHoldModal(false);
      } else {
        throw new Error(data.error || 'Failed to submit hold request');
      }
    } catch (err: any) {
      console.error('Hold submission error:', err);
      alert(err.message);
    }
  };

  const handleHoldAction = async (holdId: string, action: 'approve' | 'deny' | 'end' | 'cancel') => {
    try {
      const updateData: any = {
        tenant_id: tenantId,
        status: action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : action === 'end' ? 'ended' : 'cancelled',
      };
      if (action === 'approve' || action === 'deny') {
        updateData.approved_by = currentUser?.id;
      }
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/membership-holds/${holdId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      const data = await response.json();
      if (response.ok) {
        const { data: holdData } = await supabase.from("membership_holds").select("*").eq("profile_id", resolvedParams.id).eq("tenant_id", tenantId);
        setHolds(holdData || []);
      } else {
        throw new Error(data.error || 'Failed to update hold');
      }
    } catch (err: any) {
      console.error('Hold action error:', err);
      alert(err.message || 'Failed to update hold');
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update({
                first_name: editFormData.first_name,
                last_name: editFormData.last_name,
                email: editFormData.email,
                phone: editFormData.phone,
                date_of_birth: editFormData.date_of_birth || null,
                emergency_contact_name: editFormData.emergency_contact_name,
                emergency_contact_phone: editFormData.emergency_contact_phone,
            })
            .eq('id', profile.id)
            .eq('tenant_id', tenantId);

        if (error) throw error;

        setProfile({ ...profile, ...editFormData });
        setShowEditModal(false);
    } catch (err: any) {
        console.error("Failed to update profile", err);
        alert("Error updating profile: " + err.message);
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center p-8"><p className="text-gray-500">Loading profile...</p></div>;
  }

  if (error || !profile) {
    return <div className="flex h-full items-center justify-center p-8"><p className="text-red-500">{error || "Member not found"}</p></div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden relative">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-2xl font-bold border-2 border-indigo-200 shadow-sm">
                {profile.first_name?.[0]}{profile.last_name?.[0]}
            </div>
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    {profile.first_name} {profile.last_name}
                    {profile.status === 'active' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">Active</span>
                    ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200 capitalize">{profile.status}</span>
                    )}
                </h1>
                <p className="text-sm text-gray-500 mt-1">Member since {new Date(profile.created_at || "2023-01-01").toLocaleDateString()}</p>
            </div>
        </div>
        <div className="flex gap-3">
            <button
              onClick={() => setShowHoldModal(true)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
                <PauseCircle className="w-4 h-4 text-gray-500" />
                Hold Membership
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 flex items-center gap-2"
            >
                <Edit className="w-4 h-4" />
                Edit Profile
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">

            {/* Left Column: Profile Info */}
            <div className="w-full lg:w-1/3 flex flex-col gap-6">
                <Card className="border-gray-200 shadow-sm">
                    <CardHeader className="pb-3 border-b border-gray-100">
                        <CardTitle className="text-base font-semibold text-gray-900">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div className="flex items-start gap-3">
                            <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</p>
                                <p className="text-sm text-gray-900 mt-0.5">{profile.email || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</p>
                                <p className="text-sm text-gray-900 mt-0.5">{profile.phone || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <CalendarDays className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Date of Birth</p>
                                <p className="text-sm text-gray-900 mt-0.5">{profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Address</p>
                                <p className="text-sm text-gray-900 mt-0.5">{profile.address || 'N/A'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-gray-200 shadow-sm">
                    <CardHeader className="pb-3 border-b border-gray-100">
                        <CardTitle className="text-base font-semibold text-gray-900">Emergency Contact</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div className="flex items-start gap-3">
                            <HeartPulse className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{profile.emergency_contact_name || 'N/A'}</p>
                                <p className="text-sm text-gray-900 mt-0.5">{profile.emergency_contact_phone || 'N/A'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Right Column: Tabs */}
            <div className="w-full lg:w-2/3">
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="w-full bg-transparent border-b border-gray-200 h-auto p-0 justify-start gap-8 rounded-none">
                        <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none rounded-none bg-transparent px-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700">Overview</TabsTrigger>
                        <TabsTrigger value="holds" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none rounded-none bg-transparent px-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700">Holds</TabsTrigger>
                        <TabsTrigger value="family" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none rounded-none bg-transparent px-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700">Family</TabsTrigger>
                        <TabsTrigger value="billing" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none rounded-none bg-transparent px-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700">Billing</TabsTrigger>
                        <TabsTrigger value="activity" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none rounded-none bg-transparent px-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700">Activity</TabsTrigger>
                    </TabsList>

                    <div className="pt-6">
                        <TabsContent value="overview" className="mt-0 space-y-6 outline-none">
                            <Card className="border-gray-200 shadow-sm overflow-hidden">
                                <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-5 border-b border-gray-100 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-widest mb-1">Current Membership</h3>
                                        {memberships.length > 0 ? (
                                            <div className="flex items-end gap-3">
                                                <h2 className="text-2xl font-bold text-gray-900">{memberships[0].membership_type}</h2>
                                                <span className="text-sm text-gray-500 mb-1">{memberships[0].billing_interval !== 'one_time' ? 'Auto-renews' : 'Non-renewing'}</span>
                                            </div>
                                        ) : (
                                            <h2 className="text-xl font-bold text-gray-500">No Active Plan</h2>
                                        )}
                                    </div>
                                    <CreditCard className="w-10 h-10 text-gray-300" />
                                </div>
                                {memberships.length > 0 && (
                                    <div className="px-6 py-4 bg-white grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Start Date</p>
                                            <p className="text-sm font-semibold text-gray-900 mt-1">{new Date(memberships[0].start_date).toLocaleDateString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">End Date</p>
                                            <p className="text-sm font-semibold text-gray-900 mt-1">{memberships[0].end_date ? new Date(memberships[0].end_date).toLocaleDateString() : 'Indefinite'}</p>
                                        </div>
                                    </div>
                                )}
                            </Card>

                            <Card className="border-gray-200 shadow-sm">
                                <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
                                    <CardTitle className="text-base font-semibold text-gray-900">Recent Check-ins</CardTitle>
                                    <Link href="#" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">View All</Link>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader className="bg-gray-50">
                                            <TableRow>
                                                <TableHead className="font-medium text-gray-500">Date & Time</TableHead>
                                                <TableHead className="font-medium text-gray-500">Location</TableHead>
                                                <TableHead className="font-medium text-gray-500 text-right">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {checkIns.length > 0 ? checkIns.map((ci: any, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="text-sm text-gray-900 font-medium">
                                                        {new Date(ci.created_at).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-gray-500">Main Facility</TableCell>
                                                    <TableCell className="text-sm text-gray-500 text-right">{ci.status}</TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center text-sm text-gray-500 py-6">No recent check-ins.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="holds" className="mt-0 outline-none">
                            <Card className="border-gray-200 shadow-sm p-0 overflow-hidden">
                                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                        <PauseCircle className="w-5 h-5 text-gray-500" />
                                        Membership Holds
                                    </h3>
                                </div>
                                <div className="p-6">
                                    <HoldList
                                        holds={holds}
                                        onApprove={(id) => handleHoldAction(id, 'approve')}
                                        onDeny={(id) => handleHoldAction(id, 'deny')}
                                        onEndEarly={(id) => handleHoldAction(id, 'end')}
                                        onCancel={(id) => handleHoldAction(id, 'cancel')}
                                        currentUserRole={currentUser?.role || 'member'}
                                    />
                                </div>
                            </Card>
                        </TabsContent>

                        <TabsContent value="family" className="mt-0 outline-none">
                            <Card className="border-gray-200 shadow-sm overflow-hidden">
                                <CardHeader className="pb-3 border-b border-gray-100">
                                    <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                        <Users className="w-5 h-5 text-gray-500"/> Family & Linked Accounts
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader className="bg-gray-50">
                                            <TableRow>
                                                <TableHead>Member</TableHead>
                                                <TableHead>Relationship</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {familyLinks.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-6 text-gray-500">No linked accounts.</TableCell>
                                                </TableRow>
                                            )}
                                            {familyLinks.map((link) => {
                                                const isMaster = link.master_account_id === profile.id;
                                                const related = isMaster ? link.dependent : link.master;
                                                return (
                                                    <TableRow key={link.id}>
                                                        <TableCell>
                                                            <Link href={`/members/${related.id}`} className="font-medium text-indigo-600 hover:underline">
                                                                {related.first_name} {related.last_name}
                                                            </Link>
                                                        </TableCell>
                                                        <TableCell className="capitalize">{link.relationship_type}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={isMaster ? 'default' : 'secondary'}>{isMaster ? 'Dependent' : 'Master Account'}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <button className="text-gray-400 hover:text-gray-600"><MoreVertical className="w-4 h-4" /></button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="billing">
                            <Card className="border-gray-200 shadow-sm p-8 text-center">
                                <History className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                                <h3 className="text-sm font-medium text-gray-900">Billing History</h3>
                                <p className="text-sm text-gray-500 mt-1">Past invoices and payments will appear here.</p>
                            </Card>
                        </TabsContent>

                        <TabsContent value="activity">
                            <Card className="border-gray-200 shadow-sm p-8 text-center">
                                <Activity className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                                <h3 className="text-sm font-medium text-gray-900">Activity Logs</h3>
                                <p className="text-sm text-gray-500 mt-1">Detailed activity logs will appear here.</p>
                            </Card>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-900 text-lg">Edit Profile</h3>
                    <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
                </div>
                <form onSubmit={handleProfileUpdate} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                            <input required type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" value={editFormData.first_name || ''} onChange={e => setEditFormData({...editFormData, first_name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                            <input required type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" value={editFormData.last_name || ''} onChange={e => setEditFormData({...editFormData, last_name: e.target.value})} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input type="email" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" value={editFormData.email || ''} onChange={e => setEditFormData({...editFormData, email: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                            <input required type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" value={editFormData.phone || ''} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                        <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" value={editFormData.date_of_birth ? editFormData.date_of_birth.substring(0, 10) : ''} onChange={e => setEditFormData({...editFormData, date_of_birth: e.target.value})} />
                    </div>
                    <div className="pt-4 border-t border-gray-100">
                        <h4 className="font-medium text-gray-900 mb-3 text-sm">Emergency Contact</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" value={editFormData.emergency_contact_name || ''} onChange={e => setEditFormData({...editFormData, emergency_contact_name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm sm:text-sm" value={editFormData.emergency_contact_phone || ''} onChange={e => setEditFormData({...editFormData, emergency_contact_phone: e.target.value})} />
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Hold Management Modal */}
      {showHoldModal && currentUser && tenantId && memberships.length > 0 && (
        <HoldManagement
          tenantId={tenantId}
          membershipId={memberships[0].id}
          profileId={resolvedParams.id}
          currentUserId={currentUser.id}
          membershipPrice={memberships[0].price}
          billingInterval={memberships[0].billing_interval}
          onCancel={() => setShowHoldModal(false)}
          onSubmit={handleHoldSubmit}
        />
      )}
    </div>
  );
}
