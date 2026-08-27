'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTenantId } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Check, CheckCheck, Calendar, CreditCard, Sparkles, RefreshCw, X } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface InAppNotification {
  id: string;
  tenant_id: string;
  profile_id: string;
  channel: string;
  direction: string;
  status: 'sent' | 'delivered' | 'read' | 'pending';
  content: string;
  created_at: string;
  metadata?: {
    subject?: string;
    type?: 'class_reminder' | 'billing_alert' | 'general' | 'promotion';
    [key: string]: any;
  };
}

interface InAppNotificationFeedProps {
  profileId: string;
}

export function InAppNotificationFeed({ profileId }: InAppNotificationFeedProps) {
  const tenantId = useTenantId();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!tenantId || !profileId) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ notifications: InAppNotification[]; unread_count: number }>(
        `${API_BASE_URL}/api/communications/in-app?tenant_id=${encodeURIComponent(tenantId)}&profile_id=${encodeURIComponent(profileId)}`
      );
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      console.error('[InAppNotificationFeed] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, profileId]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (ids?: string[]) => {
    if (!tenantId || !profileId) return;
    try {
      await apiFetch(`${API_BASE_URL}/api/communications/in-app/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          profile_id: profileId,
          notification_ids: ids || []
        })
      });

      setNotifications(prev =>
        prev.map(n => (!ids || ids.length === 0 || ids.includes(n.id) ? { ...n, status: 'read' } : n))
      );
      setUnreadCount(prev => (ids ? Math.max(0, prev - ids.length) : 0));
    } catch (err) {
      console.error('[InAppNotificationFeed] Mark read error:', err);
    }
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'class_reminder':
        return <Calendar className="size-4 text-primary shrink-0" />;
      case 'billing_alert':
        return <CreditCard className="size-4 text-status-warning shrink-0" />;
      case 'promotion':
        return <Sparkles className="size-4 text-purple-500 shrink-0" />;
      default:
        return <Bell className="size-4 text-primary shrink-0" />;
    }
  };

  return (
    <div className="relative">
      {/* TRIGGER BUTTON WITH BADGE */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative hover:bg-surface-container rounded-full"
        aria-label="Member In-App Notifications"
      >
        <Bell className="size-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 size-5 bg-status-blocked text-white text-[10px] font-bold font-mono rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {/* DROPDOWN / DRAWER PANEL */}
      {isOpen && (
        <Card className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border-border shadow-2xl z-50 overflow-hidden rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <CardHeader className="p-4 border-b border-border bg-surface-container/30 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold font-heading">In-App Notifications</CardTitle>
              {unreadCount > 0 && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-mono">
                  {unreadCount} Unread
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMarkAsRead()}
                  className="h-7 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground"
                >
                  <CheckCheck className="size-3" />
                  <span>Mark all read</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="size-7 rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0 max-h-96 overflow-y-auto divide-y divide-border">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <RefreshCw className="size-4 animate-spin text-primary" />
                <span>Syncing member feed...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <Bell className="size-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
                <p>No notifications in your feed right now.</p>
              </div>
            ) : (
              notifications.map(item => (
                <div
                  key={item.id}
                  onClick={() => item.status !== 'read' && handleMarkAsRead([item.id])}
                  className={`p-3.5 transition-colors cursor-pointer flex gap-3 hover:bg-surface-container/40 ${
                    item.status !== 'read' ? 'bg-primary/5' : 'bg-transparent'
                  }`}
                >
                  <div className="mt-0.5">{getIcon(item.metadata?.type)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground line-clamp-1">
                        {item.metadata?.subject || 'Notification Alert'}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {item.content}
                    </p>
                  </div>
                  {item.status !== 'read' && (
                    <div className="size-2 rounded-full bg-primary self-center shrink-0" />
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
