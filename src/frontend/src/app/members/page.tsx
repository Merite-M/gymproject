"use client";
import Image from "next/image";

import { useState } from "react";
import { User, Search, Filter, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MemberProfilePanel } from "@/components/member-profile-panel";
import { TabbedConsole } from "@/components/tabbed-console";
import { MembershipFreeze } from "@/components/membership-freeze";

export default function MembersPage() {
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Mock member data for demonstration
  const mockMembers = [
    {
      id: "1",
      name: "Alice Johnson",
      email: "alice@example.com",
      membership_type: "Premium",
      status: "active",
      photo: null,
      outstanding_balance: 0,
      waiver_valid: true,
      access_token: "GP-12345",
      member_since: "Jan 2024",
      renewal_date: "Dec 2024",
      phone: "+250 788 123 456",
    },
    {
      id: "2", 
      name: "Bob Smith",
      email: "bob@example.com",
      membership_type: "Standard",
      status: "active",
      photo: null,
      outstanding_balance: 15000,
      waiver_valid: false,
      access_token: "GP-67890",
      member_since: "Mar 2024",
      renewal_date: "Feb 2025",
      phone: "+250 788 234 567",
    },
    {
      id: "3",
      name: "Charlie Brown",
      email: "charlie@example.com",
      membership_type: "Premium",
      status: "frozen",
      photo: null,
      outstanding_balance: 0,
      waiver_valid: true,
      access_token: "GP-11111",
      member_since: "Feb 2024",
      renewal_date: "Jan 2025",
      phone: "+250 788 345 678",
    },
  ];

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-headline-md font-bold text-foreground">Member CRM</h1>
            <p className="text-sm text-muted-foreground">Member management and relationship console</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search members..."
                className="pl-10 pr-4 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-foreground placeholder:text-muted-foreground w-64"
              />
            </div>
            <button className="px-4 py-2 bg-muted border border-border text-foreground rounded-lg hover:bg-muted/80 flex items-center gap-2 min-h-[44px]">
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 flex items-center gap-2 min-h-[44px]">
              <Plus className="w-4 h-4" />
              Add Member
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - 30/70 Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Member Directory (30%) */}
        <div className="w-[30%] border-r border-border flex flex-col bg-card">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-headline-md font-semibold text-muted-foreground uppercase tracking-wider">
              Member Directory
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {mockMembers.map((member) => (
              <div
                key={member.id}
                onClick={() => setSelectedMember(member)}
                className={cn(
                  "flex items-center gap-3 p-4 border-b border-border cursor-pointer transition-colors",
                  selectedMember?.id === member.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {member.photo ? (
                    <Image width={40} height={40}
                      src={member.photo}
                      alt={member.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{member.name}</h3>
                  <p className="text-xs opacity-70 truncate">{member.email}</p>
                </div>
                <div
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    member.status === "active"
                      ? "bg-status-cleared"
                      : member.status === "frozen"
                      ? "bg-status-action"
                      : "bg-status-blocked"
                  )}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Tabbed Console (70%) */}
        <div className="w-[70%] flex flex-col">
          {selectedMember ? (
            <>
              {/* Split View: Profile Panel (30%) + Tabbed Console (70%) */}
              <div className="flex-1 flex overflow-hidden">
                {/* Profile Panel */}
                <div className="w-[30%] border-r border-border p-4 overflow-y-auto">
                  <MemberProfilePanel member={selectedMember} />
                </div>

                {/* Tabbed Console */}
                <div className="w-[70%]">
                  <TabbedConsole member={selectedMember} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a member</p>
                <p className="text-sm mt-2">Choose a member from the directory to view their profile</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}