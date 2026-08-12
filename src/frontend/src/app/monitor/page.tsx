"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';

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
  profiles?: {
    first_name: string;
    last_name: string;
    avatar_url: string;
  }
}

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MissionControlMonitor() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const tenantId = '00000000-0000-0000-0000-000000000000'; // Default or context

  useEffect(() => {
    // 1. Initial Fetch
    const fetchRecentCheckIns = async () => {
      const { data, error } = await supabase
        .from('check_ins')
        .select(`
          *,
          profiles:profile_id (first_name, last_name, avatar_url)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setCheckIns(data as unknown as CheckIn[]);
      }
    };

    fetchRecentCheckIns();

    // 2. Setup Realtime Subscription
    const channel = supabase
      .channel('public:check_ins')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'check_ins', filter: `tenant_id=eq.${tenantId}` },
        async (payload) => {
          const newCheckIn = payload.new as CheckIn;
          // Fetch associated profile data for the new check-in
          const { data: profile } = await supabase
             .from('profiles')
             .select('first_name, last_name, avatar_url')
             .eq('id', newCheckIn.profile_id)
             .single();

          if (profile) {
              newCheckIn.profiles = profile;
          }

          setCheckIns((prev) => [newCheckIn, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'denied_debt':
      case 'denied_expired':
      case 'denied_time': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
     switch(status) {
       case 'denied_debt': return 'Denied (Debt)';
       case 'denied_expired': return 'Denied (Expired)';
       case 'denied_time': return 'Denied (Time)';
       case 'warning': return 'Warning';
       case 'approved': return 'Approved';
       default: return status;
     }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Live Check-In Monitor</h1>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm font-medium text-gray-600">System Active</span>
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0 grid grid-cols-1 divide-y divide-gray-200">
            {checkIns.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Waiting for check-ins...</div>
            ) : (
                checkIns.map((log) => (
                <div key={log.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {log.profiles?.avatar_url ? (
                            <Image src={log.profiles.avatar_url} alt="Avatar" className="h-full w-full object-cover" width={48} height={48} />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-gray-500 font-bold">
                                {log.profiles?.first_name?.[0] || '?'}{log.profiles?.last_name?.[0] || '?'}
                            </div>
                        )}
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-gray-900">
                        {log.profiles?.first_name} {log.profiles?.last_name}
                        </h3>
                        <p className="text-sm text-gray-500">Method: {log.access_method.replace('_', ' ')}</p>
                    </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                    <Badge variant="outline" className={getStatusColor(log.status)}>
                        {getStatusText(log.status)}
                    </Badge>
                    <span className="text-xs text-gray-400">
                        {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                    </div>
                </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
