"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useTenantId } from "@/contexts/AuthContext";
import { Search, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://omufxcaifzqepvqbgghc.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy_key_for_build";
const supabase = createClient(supabaseUrl, supabaseKey);

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
}

export default function MembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenantId = useTenantId();
  const pathname = usePathname();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Active" | "Inactive">("All");

  useEffect(() => {
    if (!tenantId) return;

    async function fetchProfiles() {
      try {
        let query = supabase
          .from("profiles")
          .select("id, first_name, last_name, status")
          .eq("tenant_id", tenantId)
          .order("first_name", { ascending: true });
        const { data, error } = await query;
        if (!error && data) {
          setProfiles(data);
        }
      } catch (error) {
        console.error("Error fetching profiles:", error);
      }
    }

    fetchProfiles();
  }, [tenantId]);

  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch = `${p.first_name || ""} ${p.last_name || ""}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === "All"
        ? true
        : filter === "Active"
          ? p.status === "active"
          : p.status === "inactive";
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex h-screen bg-background text-foreground font-body-base overflow-hidden">
      {/* Master List (Left Pane) */}
      <div className="w-1/3 min-w-[320px] max-w-[380px] bg-surface border-r border-border flex flex-col h-full z-10">
        <div className="p-5 border-b border-border flex-shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-heading font-bold text-foreground">Member Directory</h1>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              {filteredProfiles.length} Members
            </Badge>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
            <input
              type="text"
              placeholder="Search by name..."
              className="block w-full pl-9 pr-3 py-2 border border-border rounded-lg leading-5 bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex space-x-2">
            {["All", "Active", "Inactive"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground font-bold"
                    : "bg-surface-container text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {filteredProfiles.map((profile) => {
            const isActive = pathname.includes(`/members/${profile.id}`);
            return (
              <Link
                key={profile.id}
                href={`/members/${profile.id}`}
                className={`block transition-colors ${
                  isActive
                    ? "bg-primary/10 border-l-4 border-primary"
                    : "hover:bg-surface-container/50 border-l-4 border-transparent"
                }`}
              >
                <div className="px-5 py-3.5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center flex-shrink-0 font-bold text-xs font-mono">
                    {profile.first_name?.[0] || ""}
                    {profile.last_name?.[0] || ""}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate">
                      {profile.first_name} {profile.last_name}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`size-1.5 rounded-full ${
                          profile.status === "active" ? "bg-status-cleared" : "bg-status-blocked"
                        }`}
                      />
                      <span className="capitalize">{profile.status || "active"}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
          {filteredProfiles.length === 0 && (
            <div className="px-6 py-12 text-center text-muted-foreground text-xs">
              No members found matching filter.
            </div>
          )}
        </div>
      </div>

      {/* Detail View (Right Pane) */}
      <div className="flex-1 overflow-y-auto bg-background">{children}</div>
    </div>
  );
}
