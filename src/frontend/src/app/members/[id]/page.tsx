'use client';

import React, { useEffect, use } from 'react';
import { useMemberStore } from '@/store/memberStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarDays, AlertTriangle, Users, Activity, FileText } from 'lucide-react';

export default function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const {
    profile,
    memberships,
    holds,
    familyLinks,
    checkIns,
    loading,
    error,
    fetchMemberData,
  } = useMemberStore();

  useEffect(() => {
    fetchMemberData(resolvedParams.id);
  }, [resolvedParams.id, fetchMemberData]);

  if (loading)
    return (
      <div className="p-8 text-center text-slate-500 font-inter">Loading member data...</div>
    );
  if (error)
    return <div className="p-8 text-center text-red-500 font-inter">Error: {error}</div>;
  if (!profile)
    return <div className="p-8 text-center text-slate-500 font-inter">Member not found.</div>;

  const initials =
    `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase();

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6 bg-[#fcf8fa] min-h-screen font-inter text-[#1b1b1d]">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Column: Profile Card */}
        <div className="w-full md:w-[35%] space-y-6">
          <Card className="shadow-sm border-[#E2E8F0] bg-white rounded">
            <CardHeader className="text-center pb-2">
              <Avatar className="w-24 h-24 mx-auto mb-4 border-2 border-[#E2E8F0] rounded-full">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="text-2xl bg-[#f6f3f5] text-[#45464d]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="text-[24px] font-bold tracking-[-0.01em] text-[#1b1b1d]">
                {profile.first_name} {profile.last_name}
              </CardTitle>
              <div className="flex justify-center gap-2 mt-2">
                <Badge
                  variant={profile.status === "active" ? "default" : "secondary"}
                  className={`capitalize px-3 py-1 text-[11px] font-bold tracking-[0.05em] rounded-full ${profile.status === "active" ? 'bg-[#10B981] text-white hover:bg-[#10B981]' : 'bg-[#e4e2e4] text-[#45464d] hover:bg-[#e4e2e4]'}`}
                >
                  {profile.status}
                </Badge>
                <Badge variant="outline" className="capitalize px-3 py-1 text-[11px] font-bold tracking-[0.05em] rounded-full border-[#76777d] text-[#45464d]">
                  {profile.role}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-3 text-[14px] text-[#45464d]">
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="font-semibold text-[#1b1b1d]">Email</span>
                  <span>{profile.email || "N/A"}</span>
                </div>
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="font-semibold text-[#1b1b1d]">Phone</span>
                  <span>{profile.phone || "N/A"}</span>
                </div>
                <div className="flex justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="font-semibold text-[#1b1b1d]">DOB</span>
                  <span>{profile.date_of_birth || "N/A"}</span>
                </div>
              </div>

              <div className="pt-4">
                <h4 className="font-semibold text-[14px] mb-2 flex items-center gap-2 text-[#1b1b1d]">
                  <FileText className="w-4 h-4" /> Waiver Status
                </h4>
                {profile.waiver_signed ? (
                  <div className="bg-[#D1FAE5] text-[#006c49] p-3 rounded text-[14px] border border-[#6cf8bb]">
                    <p className="font-medium">Signed</p>
                    <p className="text-[12px] font-mono mt-1">
                      On {new Date(profile.waiver_signed_at).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <div className="bg-[#FEE2E2] text-[#ba1a1a] p-3 rounded text-[14px] border border-[#ffdad6] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Unsigned</p>
                      <p className="text-[13px] mt-1">
                        Requires signature for entry
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Details Tabs */}
        <div className="w-full md:w-[65%]">
          <Tabs defaultValue="memberships" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4 bg-[#f0edef] rounded">
              <TabsTrigger value="memberships" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#0f172a] rounded">Memberships</TabsTrigger>
              <TabsTrigger value="holds" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#0f172a] rounded">Holds</TabsTrigger>
              <TabsTrigger value="family" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#0f172a] rounded">Family</TabsTrigger>
              <TabsTrigger value="activity" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#0f172a] rounded">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="memberships" className="space-y-4">
              <Card className="shadow-sm border-[#E2E8F0] bg-white rounded">
                <CardHeader>
                  <CardTitle className="text-[18px] font-semibold flex items-center gap-2 tracking-[-0.01em] text-[#1b1b1d]">
                    <CalendarDays className="w-5 h-5 text-[#45464d]" /> Active
                    Memberships
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {memberships.length === 0 ? (
                    <p className="text-[14px] text-[#45464d]">
                      No memberships found.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-[#E2E8F0]">
                          <TableHead className="text-[#1b1b1d] font-semibold text-[14px]">Type</TableHead>
                          <TableHead className="text-[#1b1b1d] font-semibold text-[14px]">Status</TableHead>
                          <TableHead className="text-[#1b1b1d] font-semibold text-[14px]">Start</TableHead>
                          <TableHead className="text-[#1b1b1d] font-semibold text-[14px]">End</TableHead>
                          <TableHead className="text-[#1b1b1d] font-semibold text-[14px]">Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {memberships.map((m) => (
                          <TableRow key={m.id} className="border-[#E2E8F0]">
                            <TableCell className="font-medium capitalize text-[14px] text-[#1b1b1d]">
                              {m.membership_type}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  m.status === "active" ? "default" : "outline"
                                }
                                className={`capitalize px-2 py-0.5 text-[11px] font-bold tracking-[0.05em] rounded-full ${m.status === "active" ? 'bg-[#10B981] text-white' : 'border-[#76777d] text-[#45464d]'}`}
                              >
                                {m.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[12px] font-mono text-[#45464d]">
                              {new Date(m.start_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-[12px] font-mono text-[#45464d]">
                              {m.end_date
                                ? new Date(m.end_date).toLocaleDateString()
                                : "Ongoing"}
                            </TableCell>
                            <TableCell className="font-mono text-[12px] text-[#1b1b1d]">
                              ${m.price}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="holds" className="space-y-4">
              <Card className="shadow-sm border-[#E2E8F0] bg-white rounded">
                <CardHeader>
                  <CardTitle className="text-[18px] font-semibold flex items-center gap-2 tracking-[-0.01em] text-[#1b1b1d]">
                    <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />{" "}
                    Membership Holds
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {holds.length === 0 ? (
                    <p className="text-[14px] text-[#45464d]">No holds found.</p>
                  ) : (
                    <div className="space-y-4">
                      {holds.map((h) => (
                        <div
                          key={h.id}
                          className="border border-[#FEF3C7] bg-[#FFFBEB] p-4 rounded"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-[#1b1b1d] text-[14px]">
                              Dates
                            </span>
                            <span className="text-[12px] text-[#45464d] font-mono">
                              {new Date(h.start_date).toLocaleDateString()} -{" "}
                              {new Date(h.end_date).toLocaleDateString()}
                            </span>
                          </div>
                          {h.reason && (
                            <p className="text-[13px] text-[#45464d]">
                              Reason: {h.reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="family" className="space-y-4">
              <Card className="shadow-sm border-[#E2E8F0] bg-white rounded">
                <CardHeader>
                  <CardTitle className="text-[18px] font-semibold flex items-center gap-2 tracking-[-0.01em] text-[#1b1b1d]">
                    <Users className="w-5 h-5 text-[#45464d]" /> Linked Accounts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {familyLinks.length === 0 ? (
                    <p className="text-[14px] text-[#45464d]">
                      No linked family accounts.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-[#E2E8F0]">
                          <TableHead className="text-[#1b1b1d] font-semibold text-[14px]">Relation</TableHead>
                          <TableHead className="text-[#1b1b1d] font-semibold text-[14px]">Name</TableHead>
                          <TableHead className="text-[#1b1b1d] font-semibold text-[14px]">Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {familyLinks.map((link) => {
                          const isMaster =
                            link.master_account_id === resolvedParams.id;
                          const relative = isMaster
                            ? link.dependent
                            : link.master;
                          if (!relative) return null;
                          return (
                            <TableRow key={link.id} className="border-[#E2E8F0]">
                              <TableCell className="capitalize text-[14px] text-[#45464d]">
                                {isMaster
                                  ? link.relationship_type
                                  : "Master Account"}
                              </TableCell>
                              <TableCell className="font-medium text-[14px] text-[#1b1b1d]">
                                {relative.first_name} {relative.last_name}
                              </TableCell>
                              <TableCell className="text-[13px] text-[#45464d]">
                                {relative.email}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <Card className="shadow-sm border-[#E2E8F0] bg-white rounded">
                <CardHeader>
                  <CardTitle className="text-[18px] font-semibold flex items-center gap-2 tracking-[-0.01em] text-[#1b1b1d]">
                    <Activity className="w-5 h-5 text-[#45464d]" /> Recent
                    Check-ins
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {checkIns.length === 0 ? (
                    <p className="text-[14px] text-[#45464d]">No recent activity.</p>
                  ) : (
                    <div className="space-y-3">
                      {checkIns.map((ci) => (
                        <div
                          key={ci.id}
                          className="flex justify-between items-center p-3 border border-[#E2E8F0] rounded bg-white"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-2 h-2 rounded-full ${ci.status === "approved" ? "bg-[#10B981]" : "bg-[#EF4444]"}`}
                            ></div>
                            <span className="text-[14px] font-medium capitalize text-[#1b1b1d]">
                              {ci.status}
                            </span>
                            <span className="text-[11px] font-bold tracking-[0.05em] text-[#45464d] capitalize bg-[#f6f3f5] px-2 py-0.5 rounded-full">
                              {ci.access_method.replace("_", " ")}
                            </span>
                          </div>
                          <span className="text-[12px] text-[#45464d] font-mono">
                            {new Date(ci.created_at).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
