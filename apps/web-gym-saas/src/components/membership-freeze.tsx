"use client";

import { useState } from "react";
import { Snowflake, AlertTriangle, Users, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MembershipFreezeProps {
  member: any;
  onFreezeComplete?: () => void;
}

export function MembershipFreeze({ member, onFreezeComplete }: MembershipFreezeProps) {
  const [isFrozen, setIsFrozen] = useState(member.status === "frozen");
  const [freezeReason, setFreezeReason] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Mock dependents for demonstration
  const affectedDependents = [
    { id: "1", name: "Child 1", relationship: "son", age: 12 },
    { id: "2", name: "Child 2", relationship: "daughter", age: 8 },
  ];

  const handleFreezeToggle = () => {
    if (isFrozen) {
      // Unfreeze
      setProcessing(true);
      setTimeout(() => {
        setIsFrozen(false);
        setProcessing(false);
        onFreezeComplete?.();
      }, 1000);
    } else {
      // Show confirmation for freeze
      setShowConfirm(true);
    }
  };

  const confirmFreeze = () => {
    setProcessing(true);
    setTimeout(() => {
      setIsFrozen(true);
      setShowConfirm(false);
      setProcessing(false);
      onFreezeComplete?.();
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            isFrozen ? "bg-status-action/20" : "bg-status-cleared/20"
          )}>
            {isFrozen ? (
              <Snowflake className="w-5 h-5 text-status-action" />
            ) : (
              <CheckCircle className="w-5 h-5 text-status-cleared" />
            )}
          </div>
          <div>
            <h3 className="font-headline-md font-semibold text-foreground">
              Membership Status
            </h3>
            <p className="text-sm text-muted-foreground">
              {isFrozen ? "Currently frozen" : "Currently active"}
            </p>
          </div>
        </div>
        <button
          onClick={handleFreezeToggle}
          disabled={processing}
          className={cn(
            "px-4 py-2 rounded-lg font-medium min-h-[44px]",
            isFrozen
              ? "bg-status-cleared text-status-cleared-foreground hover:bg-status-cleared/80"
              : "bg-status-action text-status-action-foreground hover:bg-status-action/80",
            "disabled:opacity-50"
          )}
        >
          {processing ? "Processing..." : isFrozen ? "Unfreeze" : "Freeze"}
        </button>
      </div>

      {/* Freeze Confirmation Modal */}
      {showConfirm && (
        <div className="bg-status-action/10 border border-status-action/20 rounded-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-status-action shrink-0" />
            <div>
              <h3 className="font-headline-md font-semibold text-status-action mb-2">
                Freeze Membership
              </h3>
              <p className="text-sm text-muted-foreground">
                This will freeze the membership and suspend access. The following dependents will also be affected:
              </p>
            </div>
          </div>

          {/* Affected Dependents */}
          <div className="mb-4 space-y-2">
            {affectedDependents.map((dependent) => (
              <div
                key={dependent.id}
                className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border"
              >
                <Users className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{dependent.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {dependent.relationship}, {dependent.age} years old
                  </p>
                </div>
                <XCircle className="w-4 h-4 text-status-blocked" />
              </div>
            ))}
          </div>

          {/* Freeze Reason */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-2">
              Freeze Reason (required)
            </label>
            <textarea
              value={freezeReason}
              onChange={(e) => setFreezeReason(e.target.value)}
              placeholder="Provide a reason for freezing this membership..."
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-foreground placeholder:text-muted-foreground resize-none"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 px-4 py-2 bg-muted border border-border text-foreground rounded-lg font-medium hover:bg-muted/80 min-h-[44px]"
            >
              Cancel
            </button>
            <button
              onClick={confirmFreeze}
              disabled={!freezeReason || processing}
              className="flex-1 px-4 py-2 bg-status-action text-status-action-foreground rounded-lg font-medium hover:bg-status-action/80 min-h-[44px] disabled:opacity-50"
            >
              {processing ? "Processing..." : "Confirm Freeze"}
            </button>
          </div>
        </div>
      )}

      {/* Freeze Info */}
      {!isFrozen && !showConfirm && (
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <h4 className="font-headline-md font-semibold text-foreground mb-2">
            About Membership Freeze
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Suspends membership billing during freeze period</li>
            <li>• Blocks gym access for member and dependents</li>
            <li>• Membership can be reactivated at any time</li>
            <li>• Freeze period may affect membership renewal date</li>
          </ul>
        </div>
      )}
    </div>
  );
}