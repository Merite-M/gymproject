'use client';

import React, { useState } from 'react';
import { Calendar, Clock, DollarSign, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface HoldRequest {
  tenant_id: string;
  membership_id: string;
  profile_id: string;
  hold_reason: 'medical' | 'travel' | 'financial' | 'other';
  start_date: string;
  end_date?: string;
  notes?: string;
  created_by: string;
}

interface HoldManagementProps {
  tenantId: string;
  membershipId: string;
  profileId: string;
  currentUserId: string;
  membershipPrice: number;
  billingInterval: string;
  onCancel: () => void;
  onSubmit: (hold: HoldRequest) => Promise<void>;
}

interface FormData {
  hold_reason: 'medical' | 'travel' | 'financial' | 'other' | '';
  start_date: string;
  end_date: string;
  notes: string;
}

interface ProrationPreview {
  dailyRate: string;
  holdDays: number;
  prorationAmount: string;
}

export default function HoldManagement({
  tenantId,
  membershipId,
  profileId,
  currentUserId,
  membershipPrice,
  billingInterval,
  onCancel,
  onSubmit
}: HoldManagementProps) {
  const [formData, setFormData] = useState<FormData>({
    hold_reason: '',
    start_date: '',
    end_date: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prorationPreview, setProrationPreview] = useState<ProrationPreview | null>(null);

  const calculateProration = () => {
    if (!formData.start_date || !formData.hold_reason) return;

    const start = new Date(formData.start_date);
    const end = formData.end_date ? new Date(formData.end_date) : null;
    
    const daysInCycle: number = billingInterval === 'monthly' ? 30 : billingInterval === 'annual' ? 365 : 7;
    const dailyRate: number = membershipPrice / daysInCycle;
    
    let holdDays: number;
    if (end) {
      const diffTime: number = Math.abs(end.getTime() - start.getTime());
      holdDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } else {
      holdDays = 30; // Default for indefinite
    }
    
    const prorationAmount: number = dailyRate * holdDays;
    
    setProrationPreview({
      dailyRate: dailyRate.toFixed(2),
      holdDays,
      prorationAmount: prorationAmount.toFixed(2)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const holdRequest: HoldRequest = {
        tenant_id: tenantId,
        membership_id: membershipId,
        profile_id: profileId,
        hold_reason: formData.hold_reason as 'medical' | 'travel' | 'financial' | 'other',
        start_date: formData.start_date,
        end_date: formData.end_date || undefined,
        notes: formData.notes || undefined,
        created_by: currentUserId
      };

      await onSubmit(holdRequest);
    } catch (err: any) {
      setError(err.message || 'Failed to submit hold request');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: FormData) => ({ ...prev, [name]: value }));
    
    // Recalculate proration when relevant fields change
    if (name === 'start_date' || name === 'end_date') {
      calculateProration();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border-hairline rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border-hairline">
          <div className="flex justify-between items-center">
            <h2 className="text-headline-md font-bold text-primary">Request Membership Hold</h2>
            <button
              onClick={onCancel}
              className="text-text-muted hover:text-primary transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
          <p className="text-body-dense text-text-muted mt-2">
            Submit a hold request for approval. All holds require admin approval.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-danger-soft/10 border border-danger-crimson/20 text-danger-crimson p-4 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-body-dense font-medium text-primary mb-2">
                Hold Reason *
              </label>
              <select
                name="hold_reason"
                value={formData.hold_reason}
                onChange={handleChange}
                required
                className="w-full bg-surface-muted border border-border-hairline rounded-lg px-4 py-3 text-primary focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              >
                <option value="">Select a reason</option>
                <option value="medical">Medical/Injury</option>
                <option value="travel">Travel</option>
                <option value="financial">Financial</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-body-dense font-medium text-primary mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-surface-muted border border-border-hairline rounded-lg px-4 py-3 text-primary focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-body-dense font-medium text-primary mb-2">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  min={formData.start_date}
                  className="w-full bg-surface-muted border border-border-hairline rounded-lg px-4 py-3 text-primary focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
                <p className="text-xs text-text-muted mt-1">Leave blank for indefinite hold</p>
              </div>
            </div>

            {formData.hold_reason === 'other' && (
              <div>
                <label className="block text-body-dense font-medium text-primary mb-2">
                  Notes * (Required for "Other" reason)
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  required
                  rows={3}
                  placeholder="Please provide details about your hold request..."
                  className="w-full bg-surface-muted border border-border-hairline rounded-lg px-4 py-3 text-primary focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
                />
              </div>
            )}

            {prorationPreview && (
              <div className="bg-surface-container-low border border-border-hairline rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-5 h-5 text-secondary" />
                  <h3 className="font-medium text-primary">Proration Preview</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Daily Rate:</span>
                    <span className="text-primary font-medium">${prorationPreview.dailyRate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Hold Duration:</span>
                    <span className="text-primary font-medium">{prorationPreview.holdDays} days</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border-hairline">
                    <span className="text-text-muted font-medium">Estimated Credit:</span>
                    <span className="text-secondary font-bold">${prorationPreview.prorationAmount}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-warning-soft/10 border border-warning-amber/20 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning-amber mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-warning-amber">Important Notes:</p>
                <ul className="list-disc list-inside text-text-muted mt-1 space-y-1">
                  <li>Minimum 30 days required between consecutive holds</li>
                  <li>All hold requests require admin approval</li>
                  <li>Billing will be suspended during active hold period</li>
                  <li>Proration credit will be applied to next billing cycle</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border-hairline">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-surface-muted border border-border-hairline text-primary rounded-lg font-medium hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.hold_reason || !formData.start_date}
              className="flex-1 px-4 py-3 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}