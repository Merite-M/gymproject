"use client";

import React, { useEffect, use } from "react";
import { useMemberStore } from "@/store/memberStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  CalendarDays,
  AlertTriangle,
  Users,
  Activity,
  FileText,
} from "lucide-react";

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
      <div className="p-8 text-center text-zinc-500">
        Loading member data...
      </div>
    );
  if (error)
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  if (!profile)
    return (
      <div className="p-8 text-center text-zinc-500">Member not found.</div>
    );

  const initials =
    `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase();

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6 bg-zinc-50 min-h-screen font-sans text-zinc-900">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Column: Profile Card */}
        <div className="w-full md:w-1/3 space-y-6">
          <Card className="shadow-sm border-zinc-200">
            <CardHeader className="text-center pb-2">
              <Avatar className="w-24 h-24 mx-auto mb-4 border-2 border-zinc-100">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="text-2xl bg-zinc-100 text-zinc-600">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="text-2xl font-bold text-zinc-800">
                {profile.first_name} {profile.last_name}
              </CardTitle>
              <div className="flex justify-center gap-2 mt-2">
                <Badge
                  variant={
                    profile.status === "active" ? "default" : "secondary"
                  }
                  className="capitalize"
                >
                  {profile.status}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {profile.role}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2 text-sm text-zinc-600">
                <div className="flex justify-between border-b pb-2">
                  <span className="font-semibold text-zinc-700">Email</span>
                  <span>{profile.email || "N/A"}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="font-semibold text-zinc-700">Phone</span>
                  <span>{profile.phone || "N/A"}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="font-semibold text-zinc-700">DOB</span>
                  <span>{profile.date_of_birth || "N/A"}</span>
                </div>
              </div>

              <div className="pt-4">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-zinc-800">
                  <FileText className="w-4 h-4" /> Waiver Status
                </h4>
                {profile.waiver_signed ? (
                  <div className="bg-emerald-50 text-emerald-700 p-3 rounded-md text-sm border border-emerald-100">
                    <p className="font-medium">Signed</p>
                    <p className="text-xs mt-1">
                      On{" "}
                      {new Date(profile.waiver_signed_at).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-100 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Unsigned</p>
                      <p className="text-xs mt-1">
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
        <div className="w-full md:w-2/3">
          <Tabs defaultValue="memberships" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4 bg-zinc-100">
              <TabsTrigger value="memberships">Memberships</TabsTrigger>
              <TabsTrigger value="holds">Holds</TabsTrigger>
              <TabsTrigger value="family">Family</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="memberships" className="space-y-4">
              <Card className="shadow-sm border-zinc-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-zinc-500" /> Active
                    Memberships
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {memberships.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No memberships found.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Start</TableHead>
                          <TableHead>End</TableHead>
                          <TableHead>Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {memberships.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium capitalize">
                              {m.membership_type}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  m.status === "active" ? "default" : "outline"
                                }
                                className="capitalize"
                              >
                                {m.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-zinc-600">
                              {new Date(m.start_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-sm text-zinc-600">
                              {m.end_date
                                ? new Date(m.end_date).toLocaleDateString()
                                : "Ongoing"}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
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
              <Card className="shadow-sm border-zinc-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />{" "}
                    Membership Holds
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {holds.length === 0 ? (
                    <p className="text-sm text-zinc-500">No holds found.</p>
                  ) : (
                    <div className="space-y-4">
                      {holds.map((h) => (
                        <div
                          key={h.id}
                          className="border border-amber-100 bg-amber-50 p-4 rounded-md"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-amber-900">
                              Dates
                            </span>
                            <span className="text-sm text-amber-700 font-mono">
                              {new Date(h.start_date).toLocaleDateString()} -{" "}
                              {new Date(h.end_date).toLocaleDateString()}
                            </span>
                          </div>
                          {h.reason && (
                            <p className="text-sm text-amber-800">
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
              <Card className="shadow-sm border-zinc-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-zinc-500" /> Linked Accounts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {familyLinks.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No linked family accounts.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Relation</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
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
                            <TableRow key={link.id}>
                              <TableCell className="capitalize text-zinc-600">
                                {isMaster
                                  ? link.relationship_type
                                  : "Master Account"}
                              </TableCell>
                              <TableCell className="font-medium">
                                {relative.first_name} {relative.last_name}
                              </TableCell>
                              <TableCell className="text-sm text-zinc-500">
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
              <Card className="shadow-sm border-zinc-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5 text-zinc-500" /> Recent
                    Check-ins
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {checkIns.length === 0 ? (
                    <p className="text-sm text-zinc-500">No recent activity.</p>
                  ) : (
                    <div className="space-y-3">
                      {checkIns.map((ci) => (
                        <div
                          key={ci.id}
                          className="flex justify-between items-center p-3 border rounded-md bg-white"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-2 h-2 rounded-full ${ci.status === "approved" ? "bg-emerald-500" : "bg-red-500"}`}
                            ></div>
                            <span className="text-sm font-medium capitalize">
                              {ci.status}
                            </span>
                            <span className="text-xs text-zinc-500 capitalize bg-zinc-100 px-2 py-0.5 rounded">
                              {ci.access_method.replace("_", " ")}
                            </span>
                          </div>
                          <span className="text-sm text-zinc-500 font-mono">
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
