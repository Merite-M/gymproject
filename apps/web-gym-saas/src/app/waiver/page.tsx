'use client';

import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { jsPDF } from 'jspdf';
import { useTenantId } from '@/contexts/AuthContext';
import {
  getContractTemplates,
  generateContract,
  signContract,
  type ContractTemplate,
  type GeneratedContract,
  type FullSignedContract
} from '@/lib/api/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  PenTool,
  RotateCcw,
  CheckCircle2,
  Download,
  Loader2,
  ShieldCheck,
  Building,
  User,
  ArrowRight
} from 'lucide-react';

export default function WaiverPortalPage() {
  const sigCanvas = useRef<SignatureCanvas | null>(null);
  const authTenantId = useTenantId();

  const [tenantId, setTenantId] = useState(authTenantId || '2c604504-41c3-406b-82a0-a43700057af8');
  const [profileId, setProfileId] = useState('4f60bc62-a9ed-42fa-8272-cc626eb954a7');
  const [signerName, setSignerName] = useState('John Doe');
  
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [contractData, setContractData] = useState<GeneratedContract | null>(null);
  
  const [step, setStep] = useState<'details' | 'sign' | 'complete'>('details');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [signedContract, setSignedContract] = useState<FullSignedContract | null>(null);
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState('');

  useEffect(() => {
    if (authTenantId) setTenantId(authTenantId);
  }, [authTenantId]);

  // Load templates on tenant change
  useEffect(() => {
    if (!tenantId) return;
    async function loadTemplates() {
      try {
        const tmpls = await getContractTemplates(tenantId);
        setTemplates(tmpls);
        if (tmpls.length > 0) {
          setSelectedTemplateId(tmpls[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load templates:', err);
      }
    }
    loadTemplates();
  }, [tenantId]);

  // Generate contract preview
  const handleLoadContract = async () => {
    if (!tenantId || !profileId) {
      setStatusMessage({ type: 'error', text: 'Please provide Tenant ID and Profile ID.' });
      return;
    }

    try {
      setLoading(true);
      setStatusMessage(null);
      const generated = await generateContract({
        tenantId,
        profileId,
        templateId: selectedTemplateId || undefined
      });
      setContractData(generated);
      if (generated.member.name) {
        setSignerName(generated.member.name);
      }
      setStep('sign');
    } catch (err: any) {
      console.error('Contract generation failed:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to generate contract preview.' });
    } finally {
      setLoading(false);
    }
  };

  const handleClearSignature = () => {
    sigCanvas.current?.clear();
  };

  const handleSignContract = async () => {
    if (!contractData) return;

    if (sigCanvas.current?.isEmpty()) {
      setStatusMessage({ type: 'error', text: 'Please sign on the canvas pad before submitting.' });
      return;
    }

    try {
      setSubmitting(true);
      setStatusMessage(null);

      const dataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
      if (!dataUrl) throw new Error('Failed to capture signature');
      setSigDataUrl(dataUrl);

      const res = await signContract({
        tenantId,
        profileId,
        templateId: contractData.template_id,
        membershipId: contractData.membership?.id || null,
        title: contractData.title,
        renderedContent: contractData.rendered_content,
        signatureData: dataUrl,
        guardianName: isMinor ? guardianName : null
      });

      setSignedContract(res.contract);
      setStep('complete');
      setStatusMessage({ type: 'success', text: 'Agreement officially signed and archived!' });
    } catch (err: any) {
      console.error('Sign error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to submit digital signature.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!contractData || !sigDataUrl) return;
    try {
      const doc = new jsPDF();
      let y = 20;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(contractData.title, 20, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Executed on: ${new Date().toLocaleString()} | Digital Ref: GYM-E-SIGN`, 20, y);
      y += 10;

      doc.setDrawColor(220);
      doc.line(20, y, 190, y);
      y += 8;

      doc.setTextColor(30);
      doc.setFontSize(9.5);
      const lines = doc.splitTextToSize(contractData.rendered_content, 170);
      for (const line of lines) {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 20, y);
        y += 5.2;
      }

      if (y > 220) {
        doc.addPage();
        y = 25;
      } else {
        y += 10;
      }

      doc.line(20, y, 190, y);
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('E-Signature Verification:', 20, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.text(`Signer: ${signerName}`, 20, y);
      y += 6;
      doc.addImage(sigDataUrl, 'PNG', 20, y, 60, 22);
      y += 26;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text('Cryptographically validated by PolyFit Core E-Signature Vault', 20, y);

      doc.save(`PolyFit_Contract_${signerName.replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Could not download PDF.');
    }
  };

  return (
    <div className="min-h-screen bg-canvas-bg text-on-background py-12 px-4 flex flex-col items-center justify-center font-body-base">
      <div className="w-full max-w-3xl space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-primary/10 text-primary mb-1">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Digital Membership Contract Portal</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Review and digitally execute your gym membership agreement or liability waiver.
          </p>
        </div>

        {/* Global Alert */}
        {statusMessage && (
          <div
            className={`p-4 rounded-lg text-sm border flex items-center justify-between ${
              statusMessage.type === 'success'
                ? 'bg-status-cleared/10 border-status-cleared/30 text-status-cleared'
                : 'bg-status-blocked/10 border-status-blocked/30 text-status-blocked'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button onClick={() => setStatusMessage(null)} className="text-xs uppercase font-bold">Dismiss</button>
          </div>
        )}

        {/* STEP 1: SELECT MEMBER & TEMPLATE */}
        {step === 'details' && (
          <Card className="border-border bg-card shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-heading flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                Select Contract & Member Details
              </CardTitle>
              <CardDescription>
                Choose an agreement template to dynamically compile clauses with live pricing and member data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="templateSelect">Agreement Template</Label>
                <select
                  id="templateSelect"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full bg-background border border-border text-foreground text-sm rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.contract_type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tenantId">Tenant / Gym ID</Label>
                  <Input
                    id="tenantId"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    placeholder="Tenant UUID"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="profileId">Member Profile ID</Label>
                  <Input
                    id="profileId"
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value)}
                    placeholder="Profile UUID"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end">
                <Button onClick={handleLoadContract} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  <span>Compile Agreement Clauses</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: REVIEW CLAUSES & DIGITAL SIGNATURE */}
        {step === 'sign' && contractData && (
          <Card className="border-border bg-card shadow-lg">
            <CardHeader className="border-b border-border bg-surface-container/30 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-xl font-heading text-foreground">{contractData.title}</CardTitle>
                  <CardDescription>Review dynamic clauses and sign on the canvas pad below</CardDescription>
                </div>
                <Badge variant="outline" className="self-start sm:self-auto bg-primary/10 text-primary border-primary/20">
                  {contractData.membership?.tier || 'Membership'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Contract Clauses Text Box */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contract Clauses (Dynamic Merge Tags Resolved)</Label>
                <div className="p-4 rounded-lg bg-surface border border-border text-foreground font-mono-id text-xs leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap selection:bg-primary/20">
                  {contractData.rendered_content}
                </div>
              </div>

              {/* Signer Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signerInput">Signer Legal Name</Label>
                  <Input
                    id="signerInput"
                    value={signerFullName(contractData.member.name || signerName)}
                    onChange={(e) => setSignerName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Date of Execution</Label>
                  <Input value={new Date().toLocaleDateString()} disabled className="bg-surface opacity-80" />
                </div>
              </div>

              {/* Minor Consent */}
              <div className="p-3.5 rounded-lg bg-surface border border-border space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMinor}
                    onChange={(e) => setIsMinor(e.target.checked)}
                    className="rounded text-primary size-4"
                  />
                  <span>Signer is a minor (under 18 years old)</span>
                </label>
                {isMinor && (
                  <div className="pt-2">
                    <Label htmlFor="guardName" className="text-xs">Parent / Legal Guardian Full Name</Label>
                    <Input
                      id="guardName"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="e.g. Mary Doe"
                      className="mt-1 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Signature Pad */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <PenTool className="size-3.5" />
                    <span>Handwritten Electronic Signature</span>
                  </Label>
                  <Button variant="outline" size="sm" onClick={handleClearSignature} className="h-7 text-xs gap-1">
                    <RotateCcw className="size-3" />
                    Clear
                  </Button>
                </div>
                <div className="border-2 border-dashed border-border rounded-lg bg-white overflow-hidden touch-none">
                  <SignatureCanvas
                    ref={sigCanvas}
                    penColor="#000000"
                    canvasProps={{ className: 'w-full h-44 cursor-crosshair bg-white' }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <Button variant="outline" onClick={() => setStep('details')}>
                  Back
                </Button>
                <Button onClick={handleSignContract} disabled={submitting} className="gap-2 bg-primary text-primary-foreground">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  <span>Sign & Bind Agreement</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: COMPLETED CONFIRMATION */}
        {step === 'complete' && (
          <Card className="border-border bg-card shadow-lg text-center py-8">
            <CardContent className="space-y-6">
              <div className="size-16 rounded-full bg-status-cleared/10 text-status-cleared flex items-center justify-center mx-auto ring-8 ring-status-cleared/5">
                <CheckCircle2 className="size-8" />
              </div>

              <div className="space-y-2">
                <CardTitle className="text-2xl font-heading font-bold text-foreground">Agreement Successfully Executed!</CardTitle>
                <CardDescription className="max-w-md mx-auto">
                  Your signed membership contract has been recorded into the facility ledger and stored securely in Supabase document archives.
                </CardDescription>
              </div>

              {signedContract && (
                <div className="max-w-md mx-auto p-4 rounded-lg bg-surface border border-border text-left space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contract Title:</span>
                    <span className="font-semibold text-foreground">{signedContract.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Signed At:</span>
                    <span className="font-mono-id text-foreground">{new Date(signedContract.signed_at).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant="outline" className="text-[10px] bg-status-cleared/10 text-status-cleared border-status-cleared/30">
                      Official Record
                    </Badge>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep('details')}>
                  Sign Another Document
                </Button>
                <Button onClick={handleDownloadPDF} className="gap-2 bg-primary text-primary-foreground">
                  <Download className="size-4" />
                  <span>Download Executed PDF</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );

  function signerFullName(name: string) {
    return signerName || name;
  }
}
