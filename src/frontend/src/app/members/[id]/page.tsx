"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
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
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          .eq("profile_id", resolvedParams.id)
          .order("created_at", { ascending: false });

        const { data: checkData } = await supabase
          .from("check_ins")
          .select("*")
          .eq("profile_id", resolvedParams.id)
          .order("check_in_time", { ascending: false })
          .limit(10);

        setProfile(profileData);
        setMemberships(memData || []);
        setCheckIns(checkData || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMemberData();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-gray-500">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-red-500">{error || "Member not found"}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-2xl font-bold border-2 border-indigo-200 shadow-sm">
            {profile.first_name[0]}
            {profile.last_name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              {profile.first_name} {profile.last_name}
              {profile.status === "active" ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                  Active
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                  Inactive
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Member since{" "}
              {new Date(
                profile.created_at || "2023-01-01",
              ).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <PauseCircle className="w-4 h-4 text-gray-500" />
            Hold Membership
          </button>
          <button className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 flex items-center gap-2">
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
                <CardTitle className="text-base font-semibold text-gray-900">
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </p>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {profile.email || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </p>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {profile.phone || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CalendarDays className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date of Birth
                    </p>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {profile.date_of_birth
                        ? new Date(profile.date_of_birth).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Address
                    </p>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {profile.address || "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-gray-100">
                <CardTitle className="text-base font-semibold text-gray-900">
                  Emergency Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-start gap-3">
                  <HeartPulse className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {profile.emergency_contact_name || "N/A"}
                    </p>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {profile.emergency_contact_phone || "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Tabs */}
          <div className="w-full lg:w-2/3">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="w-full bg-transparent border-b border-gray-200 h-auto p-0 justify-start gap-8 rounded-none">
                <TabsTrigger
                  value="overview"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none rounded-none bg-transparent px-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none rounded-none bg-transparent px-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Activity Logs
                </TabsTrigger>
                <TabsTrigger
                  value="billing"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none rounded-none bg-transparent px-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Billing History
                </TabsTrigger>
                <TabsTrigger
                  value="documents"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none rounded-none bg-transparent px-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Documents
                </TabsTrigger>
              </TabsList>

              <div className="pt-6">
                <TabsContent
                  value="overview"
                  className="mt-0 space-y-6 outline-none"
                >
                  <Card className="border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-5 border-b border-gray-100 flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-widest mb-1">
                          Current Membership
                        </h3>
                        {memberships.length > 0 ? (
                          <div className="flex items-end gap-3">
                            <h2 className="text-2xl font-bold text-gray-900">
                              {memberships[0].plan_name}
                            </h2>
                            <span className="text-sm text-gray-500 mb-1">
                              {memberships[0].auto_renew
                                ? "Auto-renews"
                                : "Non-renewing"}
                            </span>
                          </div>
                        ) : (
                          <h2 className="text-xl font-bold text-gray-500">
                            No Active Plan
                          </h2>
                        )}
                      </div>
                      <CreditCard className="w-10 h-10 text-gray-300" />
                    </div>
                    {memberships.length > 0 && (
                      <div className="px-6 py-4 bg-white grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 font-medium">
                            Start Date
                          </p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {new Date(
                              memberships[0].start_date,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">
                            End Date
                          </p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {new Date(
                              memberships[0].end_date,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </Card>

                  <Card className="border-gray-200 shadow-sm">
                    <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
                      <CardTitle className="text-base font-semibold text-gray-900">
                        Recent Check-ins
                      </CardTitle>
                      <Link
                        href="#"
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        View All
                      </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader className="bg-gray-50">
                          <TableRow>
                            <TableHead className="font-medium text-gray-500">
                              Date & Time
                            </TableHead>
                            <TableHead className="font-medium text-gray-500">
                              Location
                            </TableHead>
                            <TableHead className="font-medium text-gray-500 text-right">
                              Method
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {checkIns.length > 0 ? (
                            checkIns.map((ci: any, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-sm text-gray-900 font-medium">
                                  {new Date(ci.check_in_time).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-sm text-gray-500">
                                  Main Facility
                                </TableCell>
                                <TableCell className="text-sm text-gray-500 text-right">
                                  NFC Card
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={3}
                                className="text-center text-sm text-gray-500 py-6"
                              >
                                No recent check-ins.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="activity">
                  <Card className="border-gray-200 shadow-sm p-8 text-center">
                    <Activity className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-sm font-medium text-gray-900">
                      Activity Logs
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Detailed activity logs will appear here.
                    </p>
                  </Card>
                </TabsContent>
                <TabsContent value="billing">
                  <Card className="border-gray-200 shadow-sm p-8 text-center">
                    <History className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-sm font-medium text-gray-900">
                      Billing History
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Past invoices and payments will appear here.
                    </p>
                  </Card>
                </TabsContent>
                <TabsContent value="documents">
                  <Card className="border-gray-200 shadow-sm p-8 text-center">
                    <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-sm font-medium text-gray-900">
                      Documents
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Signed waivers and contracts will appear here.
                    </p>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
