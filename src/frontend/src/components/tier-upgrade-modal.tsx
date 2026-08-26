'use client';

import React, { useState, useEffect } from 'react';
import {
  getMembershipPlans,
  calculateProration,
  applyTierChange,
  type MembershipPlan,
  type ProrationCalculation,
  type TierChangeRecord
} from '@/lib/api/tiers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Sparkles,
  Zap,
  ShieldCheck,
  X,
  ChevronRight,
  RefreshCw,
  Wallet
} from 'lucide-react';

interface TierUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  profileId: string;
  memberFullName: string;
  onTierChangedSuccess?: (tierChange: TierChangeRecord) => void;
}

export function TierUpgradeModal({
  isOpen,
  onClose,
  tenantId,
  profileId,
  memberFullName,
  onTierChangedSuccess
}: TierUpgradeModalProps) {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [calculation, setCalculation] = useState<ProrationCalculation | null>(null);

  const [step, setStep] = useState<'select' | 'proration' | 'complete'>('select');
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [prorationMode, setProrationMode] = useState<'immediate_prorated' | 'scheduled_next_cycle'>('immediate_prorated');
  const [paymentMethod, setPaymentMethod] = useState<string>('momo');
  const [reason, setReason] = useState<string>('Member requested tier change');

  // Load plans on open
  useEffect(() => {
    if (!isOpen || !tenantId) return;

    async function loadPlans() {
      try {
        setLoadingPlans(true);
        setErrorMessage(null);
        setStep('select');
        const planList = await getMembershipPlans(tenantId);
        setPlans(planList);
        if (planList.length > 0) {
          setSelectedPlanId(planList[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load plans:', err);
        setErrorMessage(err.message || 'Failed to load membership plans');
      } finally {
        setLoadingPlans(false);
      }
    }
    loadPlans();
  }, [isOpen, tenantId]);

  // Compute proration when target plan is selected
  const handleCalculateProration = async (targetId?: string) => {
    const planId = targetId || selectedPlanId;
    if (!planId) return;

    try {
      setCalculating(true);
      setErrorMessage(null);
      const calc = await calculateProration({
        tenantId,
        profileId,
        targetPlanId: planId
      });
      setCalculation(calc);
      if (calc.proration.change_type === 'downgrade') {
        setProrationMode('scheduled_next_cycle');
      } else {
        setProrationMode('immediate_prorated');
      }
      setStep('proration');
    } catch (err: any) {
      console.error('Proration calculation error:', err);
      setErrorMessage(err.message || 'Failed to calculate proration');
    } finally {
      setCalculating(false);
    }
  };

  // Submit tier change execution
  const handleApplyChange = async () => {
    if (!calculation) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const res = await applyTierChange({
        tenantId,
        profileId,
        targetPlanId: calculation.target_plan.id,
        prorationMode,
        paymentMethod,
        reason
      });

      setStep('complete');
      if (onTierChangedSuccess) {
        onTierChangedSuccess(res.tier_change);
      }
    } catch (err: any) {
      console.error('Apply tier change error:', err);
      setErrorMessage(err.message || 'Failed to execute tier upgrade/downgrade');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 font-body-base text-foreground">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-foreground">
                Membership Tier Upgrade & Proration
              </h3>
              <p className="text-xs text-muted-foreground">
                Adjust plan for {memberFullName || 'Member'} with automated mid-cycle delta invoicing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-surface-container"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-lg bg-status-blocked/10 border border-status-blocked/30 text-status-blocked text-xs flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="p-6">
          
          {/* STEP 1: SELECT TARGET PLAN */}
          {step === 'select' && (
            <div className="space-y-6">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Select New Membership Tier
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose a target plan to calculate mid-cycle unconsumed credits and delta charges.
                </p>
              </div>

              {loadingPlans ? (
                <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <span>Loading Tier Catalog...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                  {plans.map((p) => {
                    const isSelected = selectedPlanId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedPlanId(p.id);
                          handleCalculateProration(p.id);
                        }}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-primary bg-primary/10 ring-1 ring-primary shadow-sm'
                            : 'border-border bg-surface hover:bg-surface-container/60'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h4 className="font-heading font-bold text-sm text-foreground">{p.name}</h4>
                            <Badge variant="outline" className="text-[10px] bg-surface-container border-border">
                              Level {p.tier_level}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{p.description || 'Full gym facility access'}</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                          <span className="text-sm font-bold text-primary font-mono">
                            {Number(p.price).toLocaleString()} {p.currency || 'RWF'}
                          </span>
                          <span className="text-[11px] text-muted-foreground capitalize">
                            per {p.billing_interval}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-4 border-t border-border flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} className="text-xs">
                  Cancel
                </Button>
                <Button
                  onClick={() => handleCalculateProration()}
                  disabled={!selectedPlanId || calculating}
                  className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
                >
                  {calculating ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronRight className="size-3.5" />}
                  <span>Calculate Prorated Delta</span>
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: PRORATION BREAKDOWN & CONFIRMATION */}
          {step === 'proration' && calculation && (
            <div className="space-y-5">
              
              {/* Transition Header Card */}
              <div className="p-4 rounded-xl bg-surface border border-border flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Plan</span>
                  <h4 className="font-bold text-sm text-foreground">{calculation.current_membership.tier}</h4>
                  <p className="text-xs text-muted-foreground font-mono">{calculation.current_membership.price.toLocaleString()} RWF / mo</p>
                </div>

                <div className="flex flex-col items-center px-4">
                  {calculation.proration.change_type === 'upgrade' ? (
                    <Badge className="bg-status-cleared/15 text-status-cleared border-status-cleared/30 gap-1 text-[10px]">
                      <ArrowUpRight className="size-3" /> UPGRADE
                    </Badge>
                  ) : (
                    <Badge className="bg-status-action/15 text-status-action border-status-action/30 gap-1 text-[10px]">
                      <ArrowDownRight className="size-3" /> DOWNGRADE
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground mt-1">{calculation.proration.days_remaining} Days Left in Cycle</span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Tier</span>
                  <h4 className="font-bold text-sm text-primary">{calculation.target_plan.name}</h4>
                  <p className="text-xs text-primary font-mono">{calculation.target_plan.price.toLocaleString()} RWF / mo</p>
                </div>
              </div>

              {/* Proration Calculation Ledger Box */}
              <div className="p-4 rounded-xl bg-surface-container/50 border border-border space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Billing Cycle Span:</span>
                  <span className="font-mono text-foreground">
                    {calculation.proration.days_elapsed} of {calculation.proration.total_cycle_days} days elapsed ({calculation.proration.days_remaining} remaining)
                  </span>
                </div>

                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Unconsumed Current Tier Credit:</span>
                  <span className="font-mono text-status-cleared font-semibold">
                    -{calculation.proration.unconsumed_credit.toLocaleString()} {calculation.proration.currency}
                  </span>
                </div>

                <div className="flex justify-between items-center text-muted-foreground">
                  <span>New Tier Cost for Remaining {calculation.proration.days_remaining} Days:</span>
                  <span className="font-mono text-foreground font-semibold">
                    +{calculation.proration.new_tier_cost_remaining.toLocaleString()} {calculation.proration.currency}
                  </span>
                </div>

                <div className="pt-2 border-t border-border flex justify-between items-center font-bold text-sm">
                  <span className="text-foreground">Net Delta Invoiced Today:</span>
                  <span className={`font-mono ${calculation.proration.net_delta_amount > 0 ? 'text-primary' : 'text-status-cleared'}`}>
                    {calculation.proration.net_delta_amount > 0 ? `+${calculation.proration.net_delta_amount.toLocaleString()}` : calculation.proration.net_delta_amount.toLocaleString()} {calculation.proration.currency}
                  </span>
                </div>
              </div>

              {/* Downgrade Options */}
              {calculation.proration.change_type === 'downgrade' && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground">Downgrade Effective Timing</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProrationMode('scheduled_next_cycle')}
                      className={`p-3 rounded-lg border text-left text-xs transition-all ${
                        prorationMode === 'scheduled_next_cycle'
                          ? 'border-primary bg-primary/10 text-foreground font-bold'
                          : 'border-border bg-surface text-muted-foreground'
                      }`}
                    >
                      <p className="font-semibold text-foreground">At End of Cycle</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Keep VIP access until cycle ends. No delta charge now.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProrationMode('immediate_prorated')}
                      className={`p-3 rounded-lg border text-left text-xs transition-all ${
                        prorationMode === 'immediate_prorated'
                          ? 'border-primary bg-primary/10 text-foreground font-bold'
                          : 'border-border bg-surface text-muted-foreground'
                      }`}
                    >
                      <p className="font-semibold text-foreground">Immediate Downgrade</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Downgrades today and adjusts account balance.</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Tender Method (for upgrades with positive delta) */}
              {calculation.proration.net_delta_amount > 0 && prorationMode === 'immediate_prorated' && (
                <div className="space-y-1.5">
                  <Label htmlFor="tenderSelect" className="text-xs font-bold text-muted-foreground">Delta Payment Method</Label>
                  <select
                    id="tenderSelect"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-surface border border-border text-foreground text-xs rounded-lg px-3 py-2 outline-none"
                  >
                    <option value="momo">MTN / Airtel Mobile Money (MoMo)</option>
                    <option value="cash">Cash at Reception Desk</option>
                    <option value="pos_card">Credit / Debit Card Terminal</option>
                    <option value="member_tab">Charge to Member Ledger / Tab</option>
                  </select>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setStep('select')} className="text-xs">
                  Back
                </Button>
                <Button
                  onClick={handleApplyChange}
                  disabled={submitting}
                  className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
                >
                  {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                  <span>Confirm & Apply Tier Change</span>
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: COMPLETED SUCCESS */}
          {step === 'complete' && calculation && (
            <div className="py-6 text-center space-y-4">
              <div className="size-14 rounded-full bg-status-cleared/15 text-status-cleared flex items-center justify-center mx-auto ring-8 ring-status-cleared/5">
                <CheckCircle2 className="size-7" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-heading font-bold text-foreground">Membership Plan Updated!</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Member is now officially on <strong>{calculation.target_plan.name}</strong>. Gate access permissions updated immediately.
                </p>
              </div>

              <div className="pt-4 border-t border-border flex justify-center">
                <Button onClick={onClose} className="text-xs bg-primary text-primary-foreground font-semibold">
                  Done
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
