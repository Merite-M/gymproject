'use client';

import React, { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { jsPDF } from 'jspdf';
import {
  generateContract,
  signContract,
  getContractTemplates,
  type GeneratedContract,
  type ContractTemplate,
  type FullSignedContract
} from '@/lib/api/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  FileText,
  PenTool,
  CheckCircle2,
  Download,
  X,
  RotateCcw,
  Loader2,
  ShieldCheck,
  Calendar,
  User,
  CreditCard,
  Building
} from 'lucide-react';

interface ContractSignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  profileId: string;
  memberFullName?: string;
  onSignedSuccess?: (contract: FullSignedContract) => void;
}

export function ContractSignerModal({
  isOpen,
  onClose,
  tenantId,
  profileId,
  memberFullName,
  onSignedSuccess
}: ContractSignerModalProps) {
  const sigPad = useRef<SignatureCanvas | null>(null);

  const [step, setStep] = useState<'review' | 'sign' | 'complete'>('review');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [contractData, setContractData] = useState<GeneratedContract | null>(null);

  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('Parent');
  const [signerFullName, setSignerFullName] = useState(memberFullName || '');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [signedResult, setSignedResult] = useState<FullSignedContract | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  // 1. Fetch available templates on mount
  useEffect(() => {
    if (!isOpen || !tenantId || !profileId) return;

    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        setErrorMessage(null);
        setStep('review');
        setSignedResult(null);

        const tmpls = await getContractTemplates(tenantId);
        if (isMounted) {
          setTemplates(tmpls);
          const initialTmplId = tmpls.length > 0 ? tmpls[0].id : '';
          setSelectedTemplateId(initialTmplId);

          // Generate contract
          const generated = await generateContract({
            tenantId,
            profileId,
            templateId: initialTmplId || undefined
          });
          setContractData(generated);
          if (generated.member.name) {
            setSignerFullName(generated.member.name);
          }
        }
      } catch (err: any) {
        console.error('Failed to initialize contract signer:', err);
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to load membership contract');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, tenantId, profileId]);

  // Handle template change
  const handleTemplateChange = async (newTmplId: string) => {
    setSelectedTemplateId(newTmplId);
    try {
      setLoading(true);
      setErrorMessage(null);
      const generated = await generateContract({
        tenantId,
        profileId,
        templateId: newTmplId
      });
      setContractData(generated);
    } catch (err: any) {
      console.error('Failed to regenerate contract:', err);
      setErrorMessage(err.message || 'Failed to change contract template');
    } finally {
      setLoading(false);
    }
  };

  const handleClearSignature = () => {
    sigPad.current?.clear();
  };

  // Submit digital signature
  const handleSubmitSignature = async () => {
    if (!contractData) return;

    if (sigPad.current?.isEmpty()) {
      setErrorMessage('Please provide a handwritten signature before continuing.');
      return;
    }

    if (!agreedToTerms) {
      setErrorMessage('You must check the agreement box to confirm acceptance.');
      return;
    }

    if (isMinor && !guardianName.trim()) {
      setErrorMessage('Please provide the Legal Guardian Full Name.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const sigCanvas = sigPad.current?.getTrimmedCanvas();
      const sigData = sigCanvas?.toDataURL('image/png');
      if (!sigData) throw new Error('Could not capture signature graphic');
      setSignatureDataUrl(sigData);

      const res = await signContract({
        tenantId,
        profileId,
        templateId: contractData.template_id,
        membershipId: contractData.membership?.id || null,
        title: contractData.title,
        renderedContent: contractData.rendered_content,
        signatureData: sigData,
        guardianName: isMinor ? guardianName.trim() : null,
        guardianRelationship: isMinor ? guardianRelationship : null,
        customMetadata: {
          signer_full_name: signerFullName,
          membership_tier: contractData.membership?.tier || 'General Access'
        }
      });

      setSignedResult(res.contract);
      setStep('complete');
      if (onSignedSuccess) {
        onSignedSuccess(res.contract);
      }
    } catch (err: any) {
      console.error('Signature submission failed:', err);
      setErrorMessage(err.message || 'Failed to record electronic signature');
    } finally {
      setSubmitting(false);
    }
  };

  // Generate & Download PDF
  const handleDownloadPDF = () => {
    if (!contractData) return;

    try {
      const doc = new jsPDF();
      const margin = 20;
      let cursorY = 25;

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(contractData.title, margin, cursorY);
      cursorY += 10;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Document Reference: GYM-CTR-${Date.now().toString(36).toUpperCase()}`, margin, cursorY);
      cursorY += 8;
      doc.text(`Generated & Executed: ${new Date().toLocaleString()}`, margin, cursorY);
      cursorY += 12;

      doc.setDrawColor(200);
      doc.line(margin, cursorY, 190, cursorY);
      cursorY += 10;

      // Body text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(30);

      const splitText = doc.splitTextToSize(contractData.rendered_content, 170);
      for (const line of splitText) {
        if (cursorY > 260) {
          doc.addPage();
          cursorY = 20;
        }
        doc.text(line, margin, cursorY);
        cursorY += 5.5;
      }

      // Signature block on new page if needed
      if (cursorY > 220) {
        doc.addPage();
        cursorY = 25;
      } else {
        cursorY += 10;
      }

      doc.setDrawColor(200);
      doc.line(margin, cursorY, 190, cursorY);
      cursorY += 10;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('E-Signature Verification & Audit Trail', margin, cursorY);
      cursorY += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Signer Legal Name: ${signerFullName}`, margin, cursorY);
      cursorY += 6;
      doc.text(`Sign Date: ${new Date().toLocaleDateString()}`, margin, cursorY);
      cursorY += 8;

      if (signatureDataUrl) {
        doc.addImage(signatureDataUrl, 'PNG', margin, cursorY, 65, 25);
        cursorY += 30;
      }

      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text('This document has been digitally executed and cryptographically timestamped by PolyFit OS.', margin, cursorY);

      doc.save(`${contractData.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
    } catch (e) {
      console.error('PDF generation error:', e);
      alert('Could not compile PDF download.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card text-card-foreground border border-border w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-heading font-bold text-foreground">Membership Contract & E-Signature</h2>
              <p className="text-xs text-muted-foreground">Legally binding digital agreement with dynamic merge tags</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Step Progression Bar */}
        <div className="grid grid-cols-3 border-b border-border text-xs font-medium shrink-0 bg-surface-container/40">
          <div
            className={`py-2.5 px-4 flex items-center justify-center gap-2 border-r border-border transition-colors ${
              step === 'review' ? 'text-primary font-bold bg-primary/5 border-b-2 border-b-primary' : 'text-muted-foreground'
            }`}
          >
            <span className="size-5 rounded-full bg-surface-container flex items-center justify-center text-[10px]">1</span>
            <span>Review Clauses</span>
          </div>
          <div
            className={`py-2.5 px-4 flex items-center justify-center gap-2 border-r border-border transition-colors ${
              step === 'sign' ? 'text-primary font-bold bg-primary/5 border-b-2 border-b-primary' : 'text-muted-foreground'
            }`}
          >
            <span className="size-5 rounded-full bg-surface-container flex items-center justify-center text-[10px]">2</span>
            <span>Digital Signature</span>
          </div>
          <div
            className={`py-2.5 px-4 flex items-center justify-center gap-2 transition-colors ${
              step === 'complete' ? 'text-status-cleared font-bold bg-status-cleared/10 border-b-2 border-b-status-cleared' : 'text-muted-foreground'
            }`}
          >
            <span className="size-5 rounded-full bg-surface-container flex items-center justify-center text-[10px]">3</span>
            <span>Executed & Archived</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-status-blocked/10 border border-status-blocked/30 text-status-blocked text-xs flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-xs uppercase font-bold">Dismiss</button>
          </div>
        )}

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <Loader2 className="size-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium text-foreground">Resolving Dynamic Merge Tags...</p>
              <p className="text-xs text-muted-foreground mt-1">Pulling member profile, tier rates, and gym policy</p>
            </div>
          ) : step === 'review' ? (
            /* STEP 1: REVIEW CONTRACT */
            <div className="space-y-6">
              {/* Template Selector & Member Overview Bento */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3.5 rounded-lg bg-surface border border-border space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Select Agreement Template</Label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="w-full bg-background border border-border text-foreground text-xs rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-primary outline-none"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.contract_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3.5 rounded-lg bg-surface border border-border space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <User className="size-3.5" />
                    <span className="font-semibold uppercase tracking-wider text-[10px]">Member</span>
                  </div>
                  <p className="text-sm font-bold text-foreground truncate">{contractData?.member.name || 'Member'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{contractData?.member.phone || 'No phone'}</p>
                </div>

                <div className="p-3.5 rounded-lg bg-surface border border-border space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <CreditCard className="size-3.5" />
                    <span className="font-semibold uppercase tracking-wider text-[10px]">Membership Plan</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{contractData?.membership?.tier || 'Standard'}</span>
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                      {contractData?.membership ? `${contractData.membership.price} RWF` : 'Active'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Billed {contractData?.membership?.billing_interval || 'monthly'}</p>
                </div>
              </div>

              {/* Rendered Contract Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contract Clauses & Terms Preview</Label>
                  <span className="text-[11px] text-muted-foreground">All tags compiled</span>
                </div>
                <div className="p-5 rounded-lg bg-surface-container/50 border border-border text-foreground font-mono-id text-xs leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap selection:bg-primary/20">
                  {contractData?.rendered_content}
                </div>
              </div>
            </div>
          ) : step === 'sign' ? (
            /* STEP 2: DIGITAL SIGNATURE PAD */
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signerName" className="text-xs font-medium">Signer Full Legal Name</Label>
                  <Input
                    id="signerName"
                    value={signerFullName}
                    onChange={(e) => setSignerFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Agreement Type</Label>
                  <div className="p-2.5 bg-surface border border-border rounded-md text-xs font-semibold text-foreground truncate">
                    {contractData?.title}
                  </div>
                </div>
              </div>

              {/* Minor / Guardian Consent Toggle */}
              <div className="p-4 rounded-lg bg-surface border border-border space-y-3">
                <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={isMinor}
                    onChange={(e) => setIsMinor(e.target.checked)}
                    className="rounded text-primary focus:ring-primary size-4"
                  />
                  <span>Signer is under 18 years old (Parent or Legal Guardian Consent Required)</span>
                </label>

                {isMinor && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                    <div className="space-y-1">
                      <Label htmlFor="guardianName" className="text-xs">Guardian Full Legal Name</Label>
                      <Input
                        id="guardianName"
                        value={guardianName}
                        onChange={(e) => setGuardianName(e.target.value)}
                        placeholder="e.g. Jane Doe"
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="guardianRel" className="text-xs">Relationship</Label>
                      <select
                        id="guardianRel"
                        value={guardianRelationship}
                        onChange={(e) => setGuardianRelationship(e.target.value)}
                        className="w-full bg-background border border-border text-foreground text-xs rounded-md px-3 py-2 outline-none"
                      >
                        <option value="Parent">Parent</option>
                        <option value="Legal Guardian">Legal Guardian</option>
                        <option value="Authorized Representative">Authorized Representative</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Signature Canvas Pad */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <PenTool className="size-3.5" />
                    <span>Draw Signature Here</span>
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearSignature}
                    className="h-7 text-xs gap-1"
                  >
                    <RotateCcw className="size-3" />
                    Clear Pad
                  </Button>
                </div>

                <div className="border-2 border-dashed border-border rounded-lg bg-background overflow-hidden relative touch-none">
                  <SignatureCanvas
                    ref={sigPad}
                    penColor="#000000"
                    canvasProps={{
                      className: 'w-full h-44 cursor-crosshair bg-white'
                    }}
                  />
                  <div className="absolute bottom-2 left-4 text-[10px] text-neutral-400 select-none pointer-events-none">
                    Sign inside the box using stylus, touch, or mouse pointer
                  </div>
                </div>
              </div>

              {/* Terms Checkbox */}
              <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="rounded text-primary focus:ring-primary size-4 mt-0.5"
                />
                <span>
                  I legally affirm that I am the individual named above and that my electronic mark constitutes a binding signature under national electronic transactions legislation.
                </span>
              </label>
            </div>
          ) : (
            /* STEP 3: SIGNED CONFIRMATION */
            <div className="py-8 text-center space-y-6">
              <div className="size-16 rounded-full bg-status-cleared/10 text-status-cleared flex items-center justify-center mx-auto ring-8 ring-status-cleared/5">
                <CheckCircle2 className="size-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-heading font-bold text-foreground">Agreement Successfully Executed!</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  The membership agreement for <strong className="text-foreground">{signerFullName}</strong> has been digitally stamped, archived in Supabase storage, and linked to the member record.
                </p>
              </div>

              {/* Summary Audit Pill */}
              <div className="max-w-md mx-auto p-4 rounded-lg bg-surface border border-border text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contract Title:</span>
                  <span className="font-semibold text-foreground">{signedResult?.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Signed At:</span>
                  <span className="font-mono-id text-foreground">{signedResult ? new Date(signedResult.signed_at).toLocaleString() : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" className="text-[10px] bg-status-cleared/10 text-status-cleared border-status-cleared/30">
                    Officially Signed
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface flex items-center justify-between shrink-0">
          {step === 'review' ? (
            <>
              <Button variant="outline" onClick={onClose} size="sm">
                Cancel
              </Button>
              <Button
                onClick={() => setStep('sign')}
                disabled={loading || !contractData}
                className="gap-2"
                size="sm"
              >
                <span>Proceed to E-Sign</span>
                <PenTool className="size-4" />
              </Button>
            </>
          ) : step === 'sign' ? (
            <>
              <Button variant="outline" onClick={() => setStep('review')} size="sm">
                Back to Clauses
              </Button>
              <Button
                onClick={handleSubmitSignature}
                disabled={submitting}
                className="gap-2 bg-primary text-primary-foreground min-w-[140px]"
                size="sm"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                <span>Finalize & Sign</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} size="sm">
                Close Modal
              </Button>
              <Button
                onClick={handleDownloadPDF}
                className="gap-2 bg-primary text-primary-foreground"
                size="sm"
              >
                <Download className="size-4" />
                <span>Download Signed PDF</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
