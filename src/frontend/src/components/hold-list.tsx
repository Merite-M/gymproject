'use client';

import React from 'react';
import { Calendar, Clock, DollarSign, AlertCircle, CheckCircle, XCircle, PauseCircle } from 'lucide-react';

interface Hold {
  id: string;
  hold_reason: 'medical' | 'travel' | 'financial' | 'other';
  start_date: string;
  end_date: string | null;
  status: 'pending' | 'approved' | 'denied' | 'active' | 'ended' | 'cancelled';
  proration_amount: number;
  notes: string | null;
  created_at: string;
  approved_by: string | null;
  approval_notes: string | null;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

interface HoldListProps {
  holds: Hold[];
  onApprove?: (holdId: string) => void;
  onDeny?: (holdId: string) => void;
  onEndEarly?: (holdId: string) => void;
  onCancel?: (holdId: string) => void;
  currentUserRole?: 'admin' | 'staff' | 'member';
}

type HoldStatus = 'pending' | 'approved' | 'denied' | 'active' | 'ended' | 'cancelled';

export default function HoldList({
  holds,
  onApprove,
  onDeny,
  onEndEarly,
  onCancel,
  currentUserRole = 'member'
}: HoldListProps) {
  const getStatusConfig = (status: HoldStatus) => {
    switch (status) {
      case 'pending':
        return {
          icon: Clock,
          color: 'text-warning-amber',
          bg: 'bg-warning-soft/10',
          border: 'border-warning-amber/20',
          label: 'Pending Approval'
        };
      case 'approved':
        return {
          icon: CheckCircle,
          color: 'text-secondary',
          bg: 'bg-success-soft/10',
          border: 'border-secondary/20',
          label: 'Approved'
        };
      case 'active':
        return {
          icon: PauseCircle,
          color: 'text-primary',
          bg: 'bg-primary/10',
          border: 'border-primary/20',
          label: 'Active'
        };
      case 'ended':
        return {
          icon: CheckCircle,
          color: 'text-text-muted',
          bg: 'bg-surface-muted',
          border: 'border-border-hairline',
          label: 'Ended'
        };
      case 'cancelled':
        return {
          icon: XCircle,
          color: 'text-text-muted',
          bg: 'bg-surface-muted',
          border: 'border-border-hairline',
          label: 'Cancelled'
        };
      case 'denied':
        return {
          icon: XCircle,
          color: 'text-danger-crimson',
          bg: 'bg-danger-soft/10',
          border: 'border-danger-crimson/20',
          label: 'Denied'
        };
      default:
        return {
          icon: AlertCircle,
          color: 'text-text-muted',
          bg: 'bg-surface-muted',
          border: 'border-border-hairline',
          label: status
        };
    }
  };

  const getReasonLabel = (reason: string) => {
    const labels = {
      medical: 'Medical/Injury',
      travel: 'Travel',
      financial: 'Financial',
      other: 'Other'
    };
    return labels[reason as keyof typeof labels] || reason;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const sortedHolds = [...holds].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const activeHolds = sortedHolds.filter(h => h.status === 'active');
  const pendingHolds = sortedHolds.filter(h => h.status === 'pending');
  const historicalHolds = sortedHolds.filter(h => 
    !['active', 'pending'].includes(h.status)
  );

  if (holds.length === 0) {
    return (
      <div className="text-center py-8">
        <PauseCircle className="w-12 h-12 text-text-muted mx-auto mb-3" />
        <p className="text-text-muted">No hold requests found</p>
        <p className="text-body-dense text-text-muted">
          Members can request holds for travel, injury, or other reasons
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Holds */}
      {activeHolds.length > 0 && (
        <div>
          <h3 className="text-subhead-sm font-bold text-primary mb-3 flex items-center gap-2">
            <PauseCircle className="w-4 h-4 text-primary" />
            Active Holds ({activeHolds.length})
          </h3>
          <div className="space-y-3">
            {activeHolds.map(hold => {
              const config = getStatusConfig(hold.status);
              const StatusIcon = config.icon;
              
              return (
                <div
                  key={hold.id}
                  className={`bg-surface-container-low border ${config.border} rounded-lg p-4`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.bg}`}>
                        <StatusIcon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div>
                        <h4 className="font-medium text-primary">{getReasonLabel(hold.hold_reason)}</h4>
                        <p className="text-body-dense text-text-muted">
                          {formatDate(hold.start_date)} - {hold.end_date ? formatDate(hold.end_date) : 'Indefinite'}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  
                  {hold.notes && (
                    <p className="text-sm text-text-muted mb-3 italic">"{hold.notes}"</p>
                  )}
                  
                  <div className="flex items-center justify-between pt-3 border-t border-border-hairline">
                    <div className="flex items-center gap-4 text-sm text-text-muted">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        <span>Proration: ${hold.proration_amount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Requested: {formatDate(hold.created_at)}</span>
                      </div>
                    </div>
                    
                    {(currentUserRole === 'admin' || currentUserRole === 'staff') && (
                      <button
                        onClick={() => onEndEarly?.(hold.id)}
                        className="text-body-dense text-primary hover:underline"
                      >
                        End Early
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Holds */}
      {pendingHolds.length > 0 && (
        <div>
          <h3 className="text-subhead-sm font-bold text-primary mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning-amber" />
            Pending Approval ({pendingHolds.length})
          </h3>
          <div className="space-y-3">
            {pendingHolds.map(hold => {
              const config = getStatusConfig(hold.status);
              const StatusIcon = config.icon;
              
              return (
                <div
                  key={hold.id}
                  className={`bg-surface-container-low border ${config.border} rounded-lg p-4`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.bg}`}>
                        <StatusIcon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div>
                        <h4 className="font-medium text-primary">{getReasonLabel(hold.hold_reason)}</h4>
                        <p className="text-body-dense text-text-muted">
                          {formatDate(hold.start_date)} - {hold.end_date ? formatDate(hold.end_date) : 'Indefinite'}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  
                  {hold.notes && (
                    <p className="text-sm text-text-muted mb-3 italic">"{hold.notes}"</p>
                  )}
                  
                  <div className="flex items-center justify-between pt-3 border-t border-border-hairline">
                    <div className="flex items-center gap-4 text-sm text-text-muted">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        <span>Proration: ${hold.proration_amount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Requested: {formatDate(hold.created_at)}</span>
                      </div>
                    </div>
                    
                    {currentUserRole === 'admin' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => onApprove?.(hold.id)}
                          className="px-3 py-1.5 bg-secondary text-on-secondary rounded-md text-body-dense font-medium hover:bg-secondary/90 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => onDeny?.(hold.id)}
                          className="px-3 py-1.5 bg-danger-crimson text-white rounded-md text-body-dense font-medium hover:bg-danger-crimson/90 transition-colors"
                        >
                          Deny
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onCancel?.(hold.id)}
                        className="text-body-dense text-danger-crimson hover:underline"
                      >
                        Cancel Request
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Historical Holds */}
      {historicalHolds.length > 0 && (
        <div>
          <h3 className="text-subhead-sm font-bold text-primary mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-text-muted" />
            Hold History ({historicalHolds.length})
          </h3>
          <div className="space-y-2">
            {historicalHolds.map(hold => {
              const config = getStatusConfig(hold.status);
              const StatusIcon = config.icon;
              
              return (
                <div
                  key={hold.id}
                  className={`bg-surface-muted border ${config.border} rounded-lg p-3 flex items-center justify-between`}
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`w-4 h-4 ${config.color}`} />
                    <div>
                      <p className="text-sm font-medium text-primary">{getReasonLabel(hold.hold_reason)}</p>
                      <p className="text-xs text-text-muted">
                        {formatDate(hold.start_date)} - {hold.end_date ? formatDate(hold.end_date) : 'Indefinite'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                    <p className="text-xs text-text-muted mt-1">${hold.proration_amount.toFixed(2)} credit</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}