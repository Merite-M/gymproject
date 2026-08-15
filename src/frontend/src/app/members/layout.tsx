"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useTenantId } from "@/contexts/AuthContext";
import { Search } from "lucide-react";

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
          .eq("tenant_id", tenantId);
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
    const matchesSearch = (p.first_name + " " + p.last_name)
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
    <div className="flex h-screen bg-canvas-bg font-body-base overflow-hidden">
      {/* Master List (Left Pane) */}
      <div className="w-1/3 min-w-[320px] max-w-[400px] bg-white border-r border-gray-200 flex flex-col h-full z-10">
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Directory</h1>

          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search members..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex space-x-2">
            {["All", "Active", "Inactive"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === f
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ul className="divide-y divide-gray-100">
            {filteredProfiles.map((profile) => {
              const isActive = pathname.includes(`/members/${profile.id}`);
              return (
                <li key={profile.id}>
                  <Link
                    href={`/members/${profile.id}`}
                    className={`block hover:bg-gray-50 transition-colors ${isActive ? "bg-indigo-50/50 border-l-4 border-indigo-600" : "border-l-4 border-transparent"}`}
                  >
                    <div className="px-6 py-4 flex items-center">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-700 font-medium text-sm">
                          {profile.first_name[0]}
                          {profile.last_name[0]}
                        </span>
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {profile.first_name} {profile.last_name}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center mt-1">
                          <span
                            className={`inline-block w-2 h-2 rounded-full mr-2 ${profile.status === "active" ? "bg-green-500" : "bg-red-500"}`}
                          ></span>
                          {profile.status === "active" ? "Active" : "Inactive"}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
            {filteredProfiles.length === 0 && (
              <li className="px-6 py-8 text-center text-gray-500 text-sm">
                No members found.
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Detail View (Right Pane) */}
      <div className="flex-1 overflow-y-auto bg-gray-50">{children}</div>
    </div>
  );
}
