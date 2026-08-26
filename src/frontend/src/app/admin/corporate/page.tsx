"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { jsPDF } from "jspdf";
import { useTenantId } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  getCorporateAccounts,
  saveCorporateAccount,
  getCorporateAccountDetails,
  enrollCorporateMember,
  removeCorporateMember,
  generateCorporateInvoice,
  settleCorporateInvoice,
  type CorporateAccount,
  type CorporateMember,
  type CorporateInvoice
} from "@/lib/api/corporate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Building2,
  Users,
  Receipt,
  Plus,
  Search,
  Mail,
  Phone,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Trash2,
  Calendar,
  X,
  FileSpreadsheet,
  CheckCircle,
  FileSignature
} from "lucide-react";

export default function CorporateBillingPage() {
  const contextTenantId = useTenantId();
  const tenantId = contextTenantId || '2c604504-41c3-406b-82a0-a43700057af8';

  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedAccountData, setSelectedAccountData] = useState<{
    account: CorporateAccount;
    members: CorporateMember[];
    invoices: CorporateInvoice[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedInvoiceToSettle, setSelectedInvoiceToSettle] = useState<CorporateInvoice | null>(null);

  // Form States - Account
  const [accountFormData, setAccountFormData] = useState({
    companyName: '',
    tinNumber: '',
    contactPersonName: '',
    contactEmail: '',
    contactPhone: '',
    billingAddress: '',
    discountPercentage: 15,
    subsidyPercentage: 100,
    billingCycle: 'monthly',
    paymentTermsDays: 30
  });

  // Form States - Enroll Member
  const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);
  const [enrollFormData, setEnrollFormData] = useState({
    profileId: '',
    employeeIdNumber: '',
    department: '',
    subsidyCap: ''
  });

  // Form States - Generate Invoice
  const [invoiceFormData, setInvoiceFormData] = useState({
    billingPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    billingPeriodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  // Form States - Settle Payment
  const [settleFormData, setSettleFormData] = useState({
    paymentMethod: 'bank_transfer',
    paymentReference: ''
  });

  const [submitting, setSubmitting] = useState(false);

  // 1. Load Accounts List
  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const accs = await getCorporateAccounts(tenantId);
      setAccounts(accs);
      if (accs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accs[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load corporate accounts:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to fetch corporate accounts' });
    } finally {
      setLoading(false);
    }
  }, [tenantId, selectedAccountId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // 2. Load Selected Account Details
  const loadAccountDetails = useCallback(async (accId: string) => {
    try {
      setLoadingDetails(true);
      const details = await getCorporateAccountDetails(tenantId, accId);
      setSelectedAccountData(details);
    } catch (err: any) {
      console.error('Failed to load account details:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to load details' });
    } finally {
      setLoadingDetails(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountDetails(selectedAccountId);
    }
  }, [selectedAccountId, loadAccountDetails]);

  // Load gym member profiles for enrollment dropdown
  const loadProfilesForEnrollment = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone, email')
        .eq('tenant_id', tenantId)
        .order('first_name', { ascending: true })
        .limit(100);

      if (error) throw error;
      setAvailableProfiles(data || []);
      if (data && data.length > 0) {
        setEnrollFormData(prev => ({ ...prev, profileId: data[0].id }));
      }
    } catch (e) {
      console.error('Failed to load profiles for enroll:', e);
    }
  };

  // Save Account Handler
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountFormData.companyName.trim()) {
      setStatusMessage({ type: 'error', text: 'Company Name is required' });
      return;
    }

    try {
      setSubmitting(true);
      const saved = await saveCorporateAccount({
        tenantId,
        companyName: accountFormData.companyName,
        tinNumber: accountFormData.tinNumber,
        contactPersonName: accountFormData.contactPersonName,
        contactEmail: accountFormData.contactEmail,
        contactPhone: accountFormData.contactPhone,
        billingAddress: accountFormData.billingAddress,
        discountPercentage: Number(accountFormData.discountPercentage),
        subsidyPercentage: Number(accountFormData.subsidyPercentage),
        billingCycle: accountFormData.billingCycle,
        paymentTermsDays: Number(accountFormData.paymentTermsDays)
      });

      setShowAccountModal(false);
      setStatusMessage({ type: 'success', text: `Corporate partner "${saved.company_name}" created successfully!` });
      await loadAccounts();
      setSelectedAccountId(saved.id);
    } catch (err: any) {
      console.error('Save account error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save corporate partner' });
    } finally {
      setSubmitting(false);
    }
  };

  // Enroll Member Handler
  const handleEnrollMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !enrollFormData.profileId) return;

    try {
      setSubmitting(true);
      await enrollCorporateMember({
        tenantId,
        accountId: selectedAccountId,
        profileId: enrollFormData.profileId,
        employeeIdNumber: enrollFormData.employeeIdNumber,
        department: enrollFormData.department,
        subsidyCap: enrollFormData.subsidyCap ? Number(enrollFormData.subsidyCap) : undefined
      });

      setShowEnrollModal(false);
      setStatusMessage({ type: 'success', text: 'Employee successfully enrolled under corporate sponsorship!' });
      await loadAccountDetails(selectedAccountId);
      await loadAccounts();
    } catch (err: any) {
      console.error('Enroll error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to enroll employee' });
    } finally {
      setSubmitting(false);
    }
  };

  // Remove Member Handler
  const handleRemoveMember = async (profileId: string) => {
    if (!selectedAccountId || !confirm('Are you sure you want to revoke corporate sponsorship for this employee?')) return;

    try {
      await removeCorporateMember(tenantId, selectedAccountId, profileId);
      setStatusMessage({ type: 'success', text: 'Employee removed from corporate roster' });
      await loadAccountDetails(selectedAccountId);
      await loadAccounts();
    } catch (err: any) {
      console.error('Remove error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to remove employee' });
    }
  };

  // Generate Grouped Invoice Handler
  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) return;

    try {
      setSubmitting(true);
      const inv = await generateCorporateInvoice({
        tenantId,
        accountId: selectedAccountId,
        billingPeriodStart: invoiceFormData.billingPeriodStart,
        billingPeriodEnd: invoiceFormData.billingPeriodEnd,
        dueDate: invoiceFormData.dueDate
      });

      setShowInvoiceModal(false);
      setStatusMessage({ type: 'success', text: `Grouped B2B invoice ${inv.invoice_number} generated (${inv.total_active_employees} employees, ${inv.total_due.toLocaleString()} ${inv.currency})!` });
      await loadAccountDetails(selectedAccountId);
      await loadAccounts();
    } catch (err: any) {
      console.error('Generate invoice error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to generate grouped invoice' });
    } finally {
      setSubmitting(false);
    }
  };

  // Settle Invoice Handler
  const handleSettleInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceToSettle) return;

    try {
      setSubmitting(true);
      await settleCorporateInvoice({
        tenantId,
        invoiceId: selectedInvoiceToSettle.id,
        paymentMethod: settleFormData.paymentMethod,
        paymentReference: settleFormData.paymentReference
      });

      setShowSettleModal(false);
      setSelectedInvoiceToSettle(null);
      setStatusMessage({ type: 'success', text: `Payment recorded for corporate invoice ${selectedInvoiceToSettle.invoice_number}!` });
      if (selectedAccountId) await loadAccountDetails(selectedAccountId);
      await loadAccounts();
    } catch (err: any) {
      console.error('Settle error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to record invoice settlement' });
    } finally {
      setSubmitting(false);
    }
  };

  // Download Invoice PDF
  const handleDownloadInvoicePDF = (inv: CorporateInvoice) => {
    try {
      const doc = new jsPDF();
      const margin = 20;
      let y = 25;

      // Header Banner
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('CORPORATE TAX INVOICE', margin, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Invoice No: ${inv.invoice_number}`, margin, y);
      y += 6;
      doc.text(`Billing Period: ${inv.billing_period_start} to ${inv.billing_period_end}`, margin, y);
      y += 6;
      doc.text(`Due Date: ${inv.due_date} | Status: ${inv.status.toUpperCase()}`, margin, y);
      y += 10;

      // B2B Company Details
      doc.setDrawColor(220);
      doc.line(margin, y, 190, y);
      y += 8;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(20);
      doc.text(`Billed To: ${selectedAccountData?.account.company_name || 'Corporate Partner'}`, margin, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80);
      if (selectedAccountData?.account.tin_number) {
        doc.text(`Company TIN: ${selectedAccountData.account.tin_number}`, margin, y);
        y += 5;
      }
      if (selectedAccountData?.account.contact_person_name) {
        doc.text(`Attn: ${selectedAccountData.account.contact_person_name} (${selectedAccountData.account.contact_email || ''})`, margin, y);
        y += 5;
      }
      y += 5;

      // Table Header
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, y, 170, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(40);
      doc.text('Employee Name', margin + 3, y + 5.5);
      doc.text('ID #', margin + 55, y + 5.5);
      doc.text('Department', margin + 85, y + 5.5);
      doc.text('Plan Fee', margin + 140, y + 5.5);
      y += 10;

      // Table Rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30);

      const items = inv.itemized_breakdown || [];
      for (const item of items) {
        if (y > 260) {
          doc.addPage();
          y = 25;
        }
        doc.text(item.employee_name || 'Staff Member', margin + 3, y);
        doc.text(item.employee_id_number || '—', margin + 55, y);
        doc.text(item.department || 'General', margin + 85, y);
        doc.text(`${(item.employer_subsidized_fee || 0).toLocaleString()} ${inv.currency}`, margin + 140, y);
        y += 6;
      }

      y += 6;
      doc.line(margin, y, 190, y);
      y += 8;

      // Summary Block
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Subtotal (${inv.total_active_employees} Enrolled Staff):`, 110, y);
      doc.text(`${Number(inv.subtotal).toLocaleString()} ${inv.currency}`, 160, y);
      y += 6;

      if (Number(inv.discount_amount) > 0) {
        doc.text(`Corporate Discount:`, 110, y);
        doc.text(`-${Number(inv.discount_amount).toLocaleString()} ${inv.currency}`, 160, y);
        y += 6;
      }

      doc.text(`VAT / Tax (18%):`, 110, y);
      doc.text(`${Number(inv.tax_amount).toLocaleString()} ${inv.currency}`, 160, y);
      y += 8;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Total Due:`, 110, y);
      doc.text(`${Number(inv.total_due).toLocaleString()} ${inv.currency}`, 160, y);

      doc.save(`Corporate_Invoice_${inv.invoice_number}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Could not compile PDF invoice download.');
    }
  };

  const filteredAccounts = accounts.filter(a =>
    a.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.tin_number && a.tin_number.includes(searchQuery))
  );

  // Overall metric calculations
  const totalPartners = accounts.length;
  const totalEmployees = accounts.reduce((sum, a) => sum + (a.active_members_count || 0), 0);
  const totalReceivables = accounts.reduce((sum, a) => sum + (a.outstanding_balance || 0), 0);

  return (
    <div className="container mx-auto py-8 max-w-7xl space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Corporate & Employer Billing</h1>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              B2B Sponsor Hub
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage corporate master sponsor accounts, employee subsidy rosters, and consolidated B2B monthly invoices.
          </p>
        </div>

        <Button
          onClick={() => {
            setAccountFormData({
              companyName: '',
              tinNumber: '',
              contactPersonName: '',
              contactEmail: '',
              contactPhone: '',
              billingAddress: '',
              discountPercentage: 15,
              subsidyPercentage: 100,
              billingCycle: 'monthly',
              paymentTermsDays: 30
            });
            setShowAccountModal(true);
          }}
          className="gap-2 self-start sm:self-auto bg-primary text-primary-foreground"
        >
          <Plus className="size-4" />
          <span>Add Corporate Sponsor</span>
        </Button>
      </div>

      {/* Global Status Alert */}
      {statusMessage && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm border ${
            statusMessage.type === 'success'
              ? 'bg-status-cleared/10 border-status-cleared/30 text-status-cleared'
              : 'bg-status-blocked/10 border-status-blocked/30 text-status-blocked'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-xs uppercase font-bold">Dismiss</button>
        </div>
      )}

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Corporate Partners</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{totalPartners} Companies</h3>
            </div>
            <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sponsored Employees</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{totalEmployees} Members</h3>
            </div>
            <div className="size-10 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Users className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outstanding B2B Receivables</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{totalReceivables.toLocaleString()} RWF</h3>
            </div>
            <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Receipt className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Two-Column Master / Detail Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Corporate Accounts List (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search companies or TIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <Loader2 className="size-6 animate-spin text-primary" />
                <span>Loading Corporate Partners...</span>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                No corporate partners found.
              </div>
            ) : (
              filteredAccounts.map((acc) => {
                const isSelected = selectedAccountId === acc.id;
                return (
                  <div
                    key={acc.id}
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm'
                        : 'border-border bg-card hover:bg-surface'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-heading font-bold text-sm text-foreground">{acc.company_name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">TIN: {acc.tin_number || 'N/A'}</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${acc.status === 'active' ? 'bg-status-cleared/10 text-status-cleared border-status-cleared/30' : 'bg-muted text-muted-foreground'}`}>
                        {acc.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs mt-3 pt-3 border-t border-border/60">
                      <span className="text-muted-foreground">
                        <Users className="size-3.5 inline mr-1" />
                        {acc.active_members_count || 0} Staff
                      </span>
                      <span className="font-semibold text-primary">
                        {acc.discount_percentage}% Disc.
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Account Detail & Invoicing Tabs (8 cols) */}
        <div className="lg:col-span-8">
          {loadingDetails ? (
            <div className="p-16 border rounded-xl bg-card flex flex-col items-center justify-center text-center">
              <Loader2 className="size-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium">Loading partner account details...</p>
            </div>
          ) : !selectedAccountData ? (
            <div className="p-16 border border-dashed rounded-xl bg-card text-center text-muted-foreground">
              Select a corporate partner to view employee rosters and grouped invoices.
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Selected Account Overview Header */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-2xl font-heading font-bold text-foreground">
                        {selectedAccountData.account.company_name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        <span>TIN: {selectedAccountData.account.tin_number || 'Not Registered'}</span>
                        <span>•</span>
                        <span>Terms: Net {selectedAccountData.account.payment_terms_days} Days</span>
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                        {selectedAccountData.account.discount_percentage}% Corporate Discount
                      </Badge>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">
                        {selectedAccountData.account.subsidy_percentage}% Employer Subsidized
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-0 text-xs text-muted-foreground border-t border-border pt-4">
                  <div className="flex items-center gap-2">
                    <Mail className="size-3.5 text-primary" />
                    <span>{selectedAccountData.account.contact_email || 'No email registered'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="size-3.5 text-primary" />
                    <span>{selectedAccountData.account.contact_phone || 'No phone registered'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="size-3.5 text-primary" />
                    <span>Contact: {selectedAccountData.account.contact_person_name || 'HR Team'}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Detail Tabs */}
              <Tabs defaultValue="roster" className="space-y-4">
                <TabsList className="bg-surface-container p-1 rounded-lg border border-border">
                  <TabsTrigger value="roster" className="gap-2 text-xs">
                    <Users className="size-3.5" />
                    <span>Sponsored Employees ({selectedAccountData.members.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="invoices" className="gap-2 text-xs">
                    <Receipt className="size-3.5" />
                    <span>Grouped B2B Invoices ({selectedAccountData.invoices.length})</span>
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: EMPLOYEE ROSTER */}
                <TabsContent value="roster" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Active Sponsored Employees</h4>
                      <p className="text-xs text-muted-foreground">Gym memberships billed to {selectedAccountData.account.company_name}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        loadProfilesForEnrollment();
                        setShowEnrollModal(true);
                      }}
                      className="gap-1.5 text-xs"
                    >
                      <Plus className="size-3.5" />
                      <span>Enroll Employee</span>
                    </Button>
                  </div>

                  <Card className="border-border bg-card overflow-hidden">
                    <Table>
                      <TableHeader className="bg-surface-container/50">
                        <TableRow>
                          <TableHead className="text-xs">Employee Name</TableHead>
                          <TableHead className="text-xs">Employee ID</TableHead>
                          <TableHead className="text-xs">Department</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-right text-xs">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedAccountData.members.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                              No employees enrolled yet. Click "Enroll Employee" to link gym members to this sponsor.
                            </TableCell>
                          </TableRow>
                        ) : (
                          selectedAccountData.members.map((m) => (
                            <TableRow key={m.id}>
                              <TableCell className="font-semibold text-xs text-foreground">
                                {m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}` : 'Unknown Profile'}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground">
                                {m.employee_id_number || '—'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {m.department || 'General Staff'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] bg-status-cleared/10 text-status-cleared border-status-cleared/30">
                                  {m.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => m.profiles && handleRemoveMember(m.profiles.id)}
                                  className="h-7 text-xs text-status-blocked hover:bg-status-blocked/10"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </Card>
                </TabsContent>

                {/* TAB 2: GROUPED B2B INVOICES */}
                <TabsContent value="invoices" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Consolidated Monthly Invoices</h4>
                      <p className="text-xs text-muted-foreground">Aggregated invoices with itemized employee subscriptions & VAT</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setShowInvoiceModal(true)}
                      className="gap-1.5 text-xs bg-primary text-primary-foreground"
                    >
                      <Receipt className="size-3.5" />
                      <span>Generate Grouped Invoice</span>
                    </Button>
                  </div>

                  <Card className="border-border bg-card overflow-hidden">
                    <Table>
                      <TableHeader className="bg-surface-container/50">
                        <TableRow>
                          <TableHead className="text-xs">Invoice #</TableHead>
                          <TableHead className="text-xs">Period</TableHead>
                          <TableHead className="text-xs">Staff Count</TableHead>
                          <TableHead className="text-xs">Total Due</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-right text-xs">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedAccountData.invoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                              No grouped invoices generated yet. Click "Generate Grouped Invoice" to run billing.
                            </TableCell>
                          </TableRow>
                        ) : (
                          selectedAccountData.invoices.map((inv) => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-semibold text-xs text-foreground font-mono">
                                {inv.invoice_number}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {inv.billing_period_start} to {inv.billing_period_end}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {inv.total_active_employees} employees
                              </TableCell>
                              <TableCell className="text-xs font-bold text-foreground">
                                {Number(inv.total_due).toLocaleString()} {inv.currency}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    inv.status === 'paid'
                                      ? 'bg-status-cleared/10 text-status-cleared border-status-cleared/30'
                                      : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                  }`}
                                >
                                  {inv.status.toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right space-x-1">
                                {inv.status !== 'paid' && (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedInvoiceToSettle(inv);
                                      setShowSettleModal(true);
                                    }}
                                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                  >
                                    <CheckCircle className="size-3 mr-1" />
                                    <span>Settle</span>
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadInvoicePDF(inv)}
                                  className="h-7 text-xs"
                                >
                                  <Download className="size-3 mr-1" />
                                  <span>PDF</span>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </Card>
                </TabsContent>

              </Tabs>
            </div>
          )}
        </div>

      </div>

      {/* MODAL 1: ADD CORPORATE SPONSOR */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
              <h3 className="font-heading font-bold text-base text-foreground">Add Corporate Sponsor Partner</h3>
              <button onClick={() => setShowAccountModal(false)}><X className="size-4" /></button>
            </div>
            <form onSubmit={handleSaveAccount} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="companyName">Company / Employer Legal Name</Label>
                <Input
                  id="companyName"
                  required
                  placeholder="e.g. Bank of Kigali Group"
                  value={accountFormData.companyName}
                  onChange={(e) => setAccountFormData({ ...accountFormData, companyName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tinNumber">TIN (Tax ID Number)</Label>
                  <Input
                    id="tinNumber"
                    placeholder="e.g. 100293847"
                    value={accountFormData.tinNumber}
                    onChange={(e) => setAccountFormData({ ...accountFormData, tinNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="discountPercentage">Corporate Discount (%)</Label>
                  <Input
                    id="discountPercentage"
                    type="number"
                    min="0"
                    max="100"
                    value={accountFormData.discountPercentage}
                    onChange={(e) => setAccountFormData({ ...accountFormData, discountPercentage: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contactPerson">HR / Contact Person</Label>
                  <Input
                    id="contactPerson"
                    placeholder="e.g. Sarah Uwera"
                    value={accountFormData.contactPersonName}
                    onChange={(e) => setAccountFormData({ ...accountFormData, contactPersonName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactEmail">Billing Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="billing@company.com"
                    value={accountFormData.contactEmail}
                    onChange={(e) => setAccountFormData({ ...accountFormData, contactEmail: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAccountModal(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground">
                  {submitting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Plus className="size-4 mr-1" />}
                  <span>Save Corporate Partner</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ENROLL EMPLOYEE */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
              <h3 className="font-heading font-bold text-base text-foreground">Enroll Employee to Corporate Account</h3>
              <button onClick={() => setShowEnrollModal(false)}><X className="size-4" /></button>
            </div>
            <form onSubmit={handleEnrollMember} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="memberSelect">Select Member Profile</Label>
                <select
                  id="memberSelect"
                  value={enrollFormData.profileId}
                  onChange={(e) => setEnrollFormData({ ...enrollFormData, profileId: e.target.value })}
                  className="w-full bg-background border border-border text-foreground text-sm rounded-md px-3 py-2 outline-none"
                >
                  {availableProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} ({p.phone || p.email || 'No contact'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="empId">Employee ID #</Label>
                  <Input
                    id="empId"
                    placeholder="e.g. EMP-9021"
                    value={enrollFormData.employeeIdNumber}
                    onChange={(e) => setEnrollFormData({ ...enrollFormData, employeeIdNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dept">Department</Label>
                  <Input
                    id="dept"
                    placeholder="e.g. Finance"
                    value={enrollFormData.department}
                    onChange={(e) => setEnrollFormData({ ...enrollFormData, department: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowEnrollModal(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground">
                  {submitting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Plus className="size-4 mr-1" />}
                  <span>Enroll Staff</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GENERATE GROUPED INVOICE */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
              <h3 className="font-heading font-bold text-base text-foreground">Generate Consolidated Monthly Invoice</h3>
              <button onClick={() => setShowInvoiceModal(false)}><X className="size-4" /></button>
            </div>
            <form onSubmit={handleGenerateInvoice} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="periodStart">Period Start Date</Label>
                  <Input
                    id="periodStart"
                    type="date"
                    value={invoiceFormData.billingPeriodStart}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, billingPeriodStart: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="periodEnd">Period End Date</Label>
                  <Input
                    id="periodEnd"
                    type="date"
                    value={invoiceFormData.billingPeriodEnd}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, billingPeriodEnd: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dueDate">Payment Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={invoiceFormData.dueDate}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, dueDate: e.target.value })}
                />
              </div>

              <div className="p-3 bg-surface rounded-lg border text-xs text-muted-foreground space-y-1">
                <p><strong>Partner:</strong> {selectedAccountData?.account.company_name}</p>
                <p><strong>Enrolled Employees:</strong> {selectedAccountData?.members.length} active staff</p>
                <p><strong>Discount:</strong> {selectedAccountData?.account.discount_percentage}% applied to subtotal</p>
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowInvoiceModal(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground">
                  {submitting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Receipt className="size-4 mr-1" />}
                  <span>Generate B2B Invoice</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: SETTLE INVOICE PAYMENT */}
      {showSettleModal && selectedInvoiceToSettle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
              <h3 className="font-heading font-bold text-base text-foreground">Record B2B Invoice Settlement</h3>
              <button onClick={() => setShowSettleModal(false)}><X className="size-4" /></button>
            </div>
            <form onSubmit={handleSettleInvoice} className="p-6 space-y-4">
              <div className="p-3 bg-surface rounded-lg border text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice:</span>
                  <span className="font-mono font-bold text-foreground">{selectedInvoiceToSettle.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Due:</span>
                  <span className="font-bold text-primary">{Number(selectedInvoiceToSettle.total_due).toLocaleString()} {selectedInvoiceToSettle.currency}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payMethod">Payment Tender Method</Label>
                <select
                  id="payMethod"
                  value={settleFormData.paymentMethod}
                  onChange={(e) => setSettleFormData({ ...settleFormData, paymentMethod: e.target.value })}
                  className="w-full bg-background border border-border text-foreground text-sm rounded-md px-3 py-2 outline-none"
                >
                  <option value="bank_transfer">Direct Bank Transfer</option>
                  <option value="momo_business">MTN / Airtel Mobile Money Business</option>
                  <option value="paypack">Paypack Payment Gateway</option>
                  <option value="cheque">Company Cheque</option>
                  <option value="card">Corporate Credit Card</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payRef">Bank Reference / MoMo Transaction ID</Label>
                <Input
                  id="payRef"
                  placeholder="e.g. BK-TRF-99021 or MOMO-91823"
                  value={settleFormData.paymentReference}
                  onChange={(e) => setSettleFormData({ ...settleFormData, paymentReference: e.target.value })}
                />
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowSettleModal(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {submitting ? <Loader2 className="size-4 animate-spin mr-1" /> : <CheckCircle className="size-4 mr-1" />}
                  <span>Mark as Paid</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
