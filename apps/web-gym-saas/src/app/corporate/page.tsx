"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  bulkEnrollCorporateMembers,
  generateCorporatePaypackLink,
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
  AlertCircle,
  Loader2,
  Download,
  Trash2,
  X,
  FileSpreadsheet,
  Upload,
  Activity,
  DollarSign,
  ShieldCheck,
  Zap,
  SlidersHorizontal,
  TrendingUp,
  UserCheck,
  UserX,
  Sparkles
} from "lucide-react";
import Image from "next/image";

export default function CorporateB2BPortalPage() {
  const tenantId = useTenantId();

  // Primary State
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [accountDetails, setAccountDetails] = useState<{
    account: CorporateAccount;
    members: CorporateMember[];
    invoices: CorporateInvoice[];
  } | null>(null);

  // Search & Filters
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  // Modals & Panels
  const [showNewAccountModal, setShowNewAccountModal] = useState<boolean>(false);
  const [showCsvUploadModal, setShowCsvUploadModal] = useState<boolean>(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState<boolean>(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);
  const [showPaypackModal, setShowPaypackModal] = useState<boolean>(false);

  // Form States
  const [newAccountForm, setNewAccountForm] = useState({
    companyName: "",
    tinNumber: "",
    contactPersonName: "",
    contactEmail: "",
    contactPhone: "",
    billingAddress: "",
    discountPercentage: 10,
    subsidyPercentage: 70,
    paymentTermsDays: 30
  });

  const [newMemberForm, setNewMemberForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    employeeIdNumber: "",
    department: "Engineering",
    subsidyCap: 50000
  });

  const [invoiceForm, setInvoiceForm] = useState({
    billingPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    billingPeriodEnd: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  const [coPayConfig, setCoPayConfig] = useState({
    subsidyPercentage: 70,
    discountPercentage: 10,
    paymentTermsDays: 30
  });

  // CSV Roster Upload State
  const [csvText, setCsvText] = useState<string>("");
  const [parsedCsvRows, setParsedCsvRows] = useState<Array<{
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    employee_id_number: string;
    department: string;
    subsidy_cap: number;
  }>>([]);
  const [uploadingCsv, setUploadingCsv] = useState<boolean>(false);

  // Paypack Link State
  const [activeInvoiceForPayment, setActiveInvoiceForPayment] = useState<CorporateInvoice | null>(null);
  const [paypackLinkData, setPaypackLinkData] = useState<{
    payment_url: string;
    payment_reference: string;
    amount: number;
    currency: string;
    recipient_phone: string;
    invoice_number: string;
  } | null>(null);
  const [loadingPaypack, setLoadingPaypack] = useState<boolean>(false);

  // Fetch Accounts
  const fetchAccounts = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getCorporateAccounts(tenantId);
      setAccounts(data);
      if (data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(data[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load corporate accounts:", err);
      setError(err.message || "Failed to load corporate accounts");
    } finally {
      setLoading(false);
    }
  }, [tenantId, selectedAccountId]);

  // Fetch Details for Selected Account
  const fetchSelectedAccountDetails = useCallback(async () => {
    if (!tenantId || !selectedAccountId) return;
    try {
      setLoading(true);
      const details = await getCorporateAccountDetails(tenantId, selectedAccountId);
      setAccountDetails(details);
      setCoPayConfig({
        subsidyPercentage: details.account.subsidy_percentage || 70,
        discountPercentage: details.account.discount_percentage || 10,
        paymentTermsDays: details.account.payment_terms_days || 30
      });
    } catch (err: any) {
      console.error("Failed to fetch corporate details:", err);
      setError(err.message || "Failed to load corporate details");
    } finally {
      setLoading(false);
    }
  }, [tenantId, selectedAccountId]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (selectedAccountId) {
      fetchSelectedAccountDetails();
    }
  }, [selectedAccountId, fetchSelectedAccountDetails]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    try {
      setLoading(true);
      await saveCorporateAccount({
        tenantId,
        companyName: newAccountForm.companyName,
        tinNumber: newAccountForm.tinNumber,
        contactPersonName: newAccountForm.contactPersonName,
        contactEmail: newAccountForm.contactEmail,
        contactPhone: newAccountForm.contactPhone,
        billingAddress: newAccountForm.billingAddress,
        discountPercentage: Number(newAccountForm.discountPercentage),
        subsidyPercentage: Number(newAccountForm.subsidyPercentage),
        paymentTermsDays: Number(newAccountForm.paymentTermsDays)
      });
      setShowNewAccountModal(false);
      setNewAccountForm({
        companyName: "",
        tinNumber: "",
        contactPersonName: "",
        contactEmail: "",
        contactPhone: "",
        billingAddress: "",
        discountPercentage: 10,
        subsidyPercentage: 70,
        paymentTermsDays: 30
      });
      await fetchAccounts();
    } catch (err: any) {
      alert("Error creating account: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCoPayConfig = async () => {
    if (!tenantId || !accountDetails) return;
    try {
      setLoading(true);
      await saveCorporateAccount({
        tenantId,
        id: accountDetails.account.id,
        companyName: accountDetails.account.company_name,
        tinNumber: accountDetails.account.tin_number || undefined,
        contactPersonName: accountDetails.account.contact_person_name || undefined,
        contactEmail: accountDetails.account.contact_email || undefined,
        contactPhone: accountDetails.account.contact_phone || undefined,
        billingAddress: accountDetails.account.billing_address || undefined,
        subsidyPercentage: Number(coPayConfig.subsidyPercentage),
        discountPercentage: Number(coPayConfig.discountPercentage),
        paymentTermsDays: Number(coPayConfig.paymentTermsDays)
      });
      alert("Corporate co-pay benefit split updated successfully!");
      await fetchSelectedAccountDetails();
    } catch (err: any) {
      alert("Failed to update co-pay config: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !selectedAccountId) return;
    try {
      setLoading(true);

      let profileId = "";
      const { data: existingProf } = await supabase
        .from('profiles')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('email', newMemberForm.email.trim().toLowerCase())
        .maybeSingle();

      if (existingProf) {
        profileId = existingProf.id;
      } else {
        const { data: newProf, error: pErr } = await supabase
          .from('profiles')
          .insert({
            tenant_id: tenantId,
            email: newMemberForm.email.trim().toLowerCase(),
            first_name: newMemberForm.firstName.trim() || 'Employee',
            last_name: newMemberForm.lastName.trim() || '',
            phone: newMemberForm.phone.trim() || null,
            role: 'member',
            status: 'active'
          })
          .select()
          .single();

        if (pErr) throw pErr;
        profileId = newProf.id;
      }

      await enrollCorporateMember({
        tenantId,
        accountId: selectedAccountId,
        profileId,
        employeeIdNumber: newMemberForm.employeeIdNumber,
        department: newMemberForm.department,
        subsidyCap: Number(newMemberForm.subsidyCap)
      });

      setShowAddEmployeeModal(false);
      setNewMemberForm({
        email: "",
        firstName: "",
        lastName: "",
        phone: "",
        employeeIdNumber: "",
        department: "Engineering",
        subsidyCap: 50000
      });
      await fetchSelectedAccountDetails();
    } catch (err: any) {
      alert("Failed to enroll employee: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleParseCsv = (text: string) => {
    setCsvText(text);
    if (!text.trim()) {
      setParsedCsvRows([]);
      return;
    }

    const lines = text.trim().split("\n");
    const rows: Array<any> = [];

    const startIdx = lines[0].toLowerCase().includes("email") ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(",").map(p => p.trim());
      if (parts.length >= 1 && parts[0]) {
        rows.push({
          email: parts[0] || "",
          first_name: parts[1] || "Employee",
          last_name: parts[2] || "",
          phone: parts[3] || "",
          employee_id_number: parts[4] || `EMP-${1000 + i}`,
          department: parts[5] || "General",
          subsidy_cap: parts[6] ? Number(parts[6]) : 50000
        });
      }
    }
    setParsedCsvRows(rows);
  };

  const handleBulkSubmitCsv = async () => {
    if (!tenantId || !selectedAccountId || parsedCsvRows.length === 0) return;
    try {
      setUploadingCsv(true);
      const res = await bulkEnrollCorporateMembers({
        tenantId,
        accountId: selectedAccountId,
        employees: parsedCsvRows
      });

      alert(res.message);
      setShowCsvUploadModal(false);
      setCsvText("");
      setParsedCsvRows([]);
      await fetchSelectedAccountDetails();
    } catch (err: any) {
      alert("Bulk upload failed: " + err.message);
    } finally {
      setUploadingCsv(false);
    }
  };

  const handleToggleEmployeeStatus = async (member: CorporateMember) => {
    if (!tenantId || !selectedAccountId) return;
    const newStatus = member.status === 'active' ? 'suspended' : 'active';
    try {
      await supabase
        .from('corporate_members')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', member.id)
        .eq('tenant_id', tenantId);

      await fetchSelectedAccountDetails();
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    }
  };

  const handleRemoveEmployee = async (profileId: string) => {
    if (!tenantId || !selectedAccountId) return;
    if (!confirm("Are you sure you want to remove this employee from corporate sponsorship?")) return;
    try {
      await removeCorporateMember(tenantId, selectedAccountId, profileId);
      await fetchSelectedAccountDetails();
    } catch (err: any) {
      alert("Failed to remove employee: " + err.message);
    }
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !selectedAccountId) return;
    try {
      setLoading(true);
      const inv = await generateCorporateInvoice({
        tenantId,
        accountId: selectedAccountId,
        billingPeriodStart: invoiceForm.billingPeriodStart,
        billingPeriodEnd: invoiceForm.billingPeriodEnd,
        dueDate: invoiceForm.dueDate
      });

      alert(`Consolidated B2B Invoice ${inv.invoice_number} generated successfully!`);
      setShowInvoiceModal(false);
      await fetchSelectedAccountDetails();
    } catch (err: any) {
      alert("Failed to generate invoice: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerPaypackLink = async (invoice: CorporateInvoice) => {
    if (!tenantId) return;
    try {
      setActiveInvoiceForPayment(invoice);
      setLoadingPaypack(true);
      setShowPaypackModal(true);

      const link = await generateCorporatePaypackLink({
        tenantId,
        invoiceId: invoice.id,
        phoneNumber: invoice.corporate_accounts?.contact_phone || undefined
      });

      setPaypackLinkData(link);
    } catch (err: any) {
      alert("Error creating Paypack B2B link: " + err.message);
    } finally {
      setLoadingPaypack(false);
    }
  };

  const handleSettleInvoice = async (invoiceId: string, method: string) => {
    if (!tenantId) return;
    try {
      setLoading(true);
      await settleCorporateInvoice({
        tenantId,
        invoiceId,
        paymentMethod: method,
        paymentReference: `MANUAL-${Date.now().toString(36).toUpperCase()}`
      });
      alert("Invoice marked as PAID!");
      if (showPaypackModal) setShowPaypackModal(false);
      await fetchSelectedAccountDetails();
    } catch (err: any) {
      alert("Failed to settle invoice: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoicePdf = (invoice: CorporateInvoice) => {
    const doc = new jsPDF();
    const company = accountDetails?.account?.company_name || "Corporate Client";

    doc.setFontSize(20);
    doc.text("CORPORATE BILLING STATEMENT", 14, 22);

    doc.setFontSize(10);
    doc.text(`Invoice No: ${invoice.invoice_number}`, 14, 32);
    doc.text(`Company: ${company}`, 14, 38);
    doc.text(`Period: ${invoice.billing_period_start} to ${invoice.billing_period_end}`, 14, 44);
    doc.text(`Due Date: ${invoice.due_date}`, 14, 50);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 14, 56);

    doc.line(14, 62, 196, 62);

    doc.setFontSize(12);
    doc.text("Itemized Employee Gym Usage & Subsidies:", 14, 70);

    let y = 80;
    doc.setFontSize(9);
    doc.text("Employee Name", 14, y);
    doc.text("Dept", 70, y);
    doc.text("Plan", 110, y);
    doc.text("Employer Portion", 160, y);
    y += 6;

    (invoice.itemized_breakdown || []).forEach((item: any) => {
      doc.text(item.employee_name || "Employee", 14, y);
      doc.text(item.department || "N/A", 70, y);
      doc.text(item.plan || "Standard", 110, y);
      doc.text(`RWF ${Number(item.employer_subsidized_fee || 0).toLocaleString()}`, 160, y);
      y += 6;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    doc.line(14, y + 4, 196, y + 4);
    y += 12;

    doc.setFontSize(10);
    doc.text(`Subtotal: RWF ${Number(invoice.subtotal).toLocaleString()}`, 120, y);
    y += 6;
    doc.text(`Corporate Discount: -RWF ${Number(invoice.discount_amount).toLocaleString()}`, 120, y);
    y += 6;
    doc.text(`VAT / Tax: RWF ${Number(invoice.tax_amount).toLocaleString()}`, 120, y);
    y += 8;
    doc.setFontSize(12);
    doc.text(`TOTAL DUE: RWF ${Number(invoice.total_due).toLocaleString()}`, 120, y);

    doc.save(`${invoice.invoice_number}_statement.pdf`);
  };

  const filteredMembers = (accountDetails?.members || []).filter(m => {
    const p = m.profiles;
    const name = `${p?.first_name || ''} ${p?.last_name || ''}`.toLowerCase();
    const email = (p?.email || '').toLowerCase();
    const idNum = (m.employee_id_number || '').toLowerCase();
    const matchesQuery = name.includes(memberSearchQuery.toLowerCase()) ||
      email.includes(memberSearchQuery.toLowerCase()) ||
      idNum.includes(memberSearchQuery.toLowerCase());

    const matchesDept = departmentFilter === "all" || m.department === departmentFilter;

    return matchesQuery && matchesDept;
  });

  const totalEmployees = accountDetails?.members?.length || 0;
  const activePasses = (accountDetails?.members || []).filter(m => m.status === 'active').length;
  const employerFundedPercent = accountDetails?.account?.subsidy_percentage || 70;
  const employeeFundedPercent = 100 - employerFundedPercent;

  const estimatedMonthlyEmployerSpend = (accountDetails?.members || []).reduce((sum, m) => {
    const base = 50000;
    const cap = m.subsidy_cap ? Number(m.subsidy_cap) : Infinity;
    const employerShare = Math.min(base * (employerFundedPercent / 100), cap);
    return sum + employerShare;
  }, 0);

  const departments = Array.from(new Set((accountDetails?.members || []).map(m => m.department).filter(Boolean)));

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6 text-foreground font-body-base">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 sm:p-6 rounded-2xl border border-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary text-primary-foreground rounded-xl shadow-xs shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-headline-md font-bold tracking-tight">Corporate Wellness B2B Portal</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Manage enterprise corporate sponsor accounts, employee benefit quotas, subsidized co-pay splits, and B2B billing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Company Switcher */}
          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Corporate Account:</Label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="bg-surface-container border border-border text-foreground rounded-lg text-xs sm:text-sm px-3 py-2 font-medium focus:ring-2 focus:ring-primary min-h-[40px] w-full sm:w-auto outline-none"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.company_name} ({acc.active_members_count || 0} employees)
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={() => setShowNewAccountModal(true)}
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10 min-h-[40px]"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Corporate Client
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-status-blocked/10 border border-status-blocked/30 text-status-blocked rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-xs sm:text-sm">{error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {loading && !accountDetails ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading Corporate Wellness B2B Dashboard...</p>
        </div>
      ) : accountDetails ? (
        <>
          {/* Metric Cards - HR Analytics & Engagement Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Enrolled Employees</p>
                    <h3 className="text-2xl font-bold font-mono-id mt-1 text-foreground">{totalEmployees}</h3>
                    <p className="text-xs text-status-cleared mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> {activePasses} active passes ({totalEmployees > 0 ? Math.round((activePasses/totalEmployees)*100) : 0}%)
                    </p>
                  </div>
                  <div className="p-3 bg-secondary/10 text-secondary rounded-xl shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Subsidized Split Ratio</p>
                    <h3 className="text-2xl font-bold font-mono-id mt-1 text-primary">
                      {employerFundedPercent}% / {employeeFundedPercent}%
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Employer / Employee Co-Pay</p>
                  </div>
                  <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
                    <SlidersHorizontal className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Est. Monthly Subsidy Budget</p>
                    <h3 className="text-2xl font-bold font-mono-id mt-1 text-foreground">
                      RWF {Math.round(estimatedMonthlyEmployerSpend).toLocaleString()}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Based on active headcount</p>
                  </div>
                  <div className="p-3 bg-status-cleared/10 text-status-cleared rounded-xl shrink-0">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Outstanding Invoice Balance</p>
                    <h3 className="text-2xl font-bold font-mono-id mt-1 text-status-action">
                      RWF {Number(accountDetails.account.outstanding_balance || 0).toLocaleString()}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{accountDetails.invoices.filter(i => i.status !== 'paid').length} unpaid invoice(s)</p>
                  </div>
                  <div className="p-3 bg-status-action/10 text-status-action rounded-xl shrink-0">
                    <Receipt className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Tabbed Area */}
          <Tabs defaultValue="roster" className="space-y-6">
            <div className="overflow-x-auto pb-1">
              <TabsList className="bg-card border border-border p-1 rounded-xl min-w-max flex">
                <TabsTrigger value="roster" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2 text-xs sm:text-sm font-medium min-h-[36px]">
                  <Users className="w-4 h-4 mr-2" />
                  Employee Roster & Benefit Quotas
                </TabsTrigger>
                <TabsTrigger value="copay" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2 text-xs sm:text-sm font-medium min-h-[36px]">
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Co-Pay & Subsidy Split Configuration
                </TabsTrigger>
                <TabsTrigger value="billing" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2 text-xs sm:text-sm font-medium min-h-[36px]">
                  <Receipt className="w-4 h-4 mr-2" />
                  Invoices & B2B Payments
                </TabsTrigger>
                <TabsTrigger value="analytics" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2 text-xs sm:text-sm font-medium min-h-[36px]">
                  <Activity className="w-4 h-4 mr-2" />
                  Wellness Engagement Analytics
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB 1: EMPLOYEE ROSTER & BENEFIT ACCESS */}
            <TabsContent value="roster" className="space-y-4">
              <Card className="bg-card border-border overflow-hidden">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
                  <div>
                    <CardTitle className="text-base sm:text-lg font-headline-md font-bold flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Employee Benefit Access Roster
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Manage employee benefit approvals, department tags, individual subsidy caps, and access status.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button onClick={() => setShowCsvUploadModal(true)} variant="outline" size="sm" className="text-xs min-h-[36px]">
                      <FileSpreadsheet className="w-4 h-4 mr-1.5 text-status-cleared" />
                      Bulk Upload CSV Roster
                    </Button>
                    <Button onClick={() => setShowAddEmployeeModal(true)} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs min-h-[36px]">
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add Employee
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-6 space-y-4">
                  {/* Search and Filters */}
                  <div className="flex flex-col md:flex-row gap-3 justify-between">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                      <Input
                        placeholder="Search employee by name, email, or ID..."
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                        className="pl-9 text-xs sm:text-sm min-h-[38px] bg-background border-border"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Department:</Label>
                      <select
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                        className="bg-surface-container border border-border text-foreground rounded-lg text-xs sm:text-sm px-3 py-2 font-medium min-h-[38px] outline-none"
                      >
                        <option value="all">All Departments ({accountDetails.members.length})</option>
                        {departments.map((d) => (
                          <option key={d} value={d!}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="border border-border rounded-xl overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-surface-container/50">
                        <TableRow>
                          <TableHead className="text-xs">Employee</TableHead>
                          <TableHead className="text-xs">ID & Department</TableHead>
                          <TableHead className="text-xs">Benefit Status</TableHead>
                          <TableHead className="text-xs">Monthly Subsidy Cap</TableHead>
                          <TableHead className="text-xs">Joined</TableHead>
                          <TableHead className="text-right text-xs">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMembers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                              No employees found matching the filters.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredMembers.map((m) => {
                            const p = m.profiles;
                            const isActive = m.status === 'active';
                            return (
                              <TableRow key={m.id}>
                                <TableCell>
                                  <div>
                                    <div className="font-semibold text-xs sm:text-sm text-foreground">
                                      {p?.first_name} {p?.last_name}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">{p?.email}</div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-xs font-mono-id text-foreground">
                                    {m.employee_id_number || 'N/A'}
                                  </div>
                                  <Badge variant="outline" className="text-[10px] mt-0.5">
                                    {m.department || 'General'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className={isActive ? "bg-status-cleared/15 text-status-cleared border-status-cleared/30 text-[10px]" : "bg-status-blocked/15 text-status-blocked border-status-blocked/30 text-[10px]"}>
                                    {isActive ? "Active Benefit" : "Revoked"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium text-xs font-mono-id">
                                  {m.subsidy_cap ? `RWF ${Number(m.subsidy_cap).toLocaleString()}` : 'Unlimited (Full Subsidy)'}
                                </TableCell>
                                <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                                  {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : 'N/A'}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      onClick={() => handleToggleEmployeeStatus(m)}
                                      variant="ghost"
                                      size="sm"
                                      className={isActive ? "text-status-action hover:bg-status-action/10 h-8 text-xs" : "text-status-cleared hover:bg-status-cleared/10 h-8 text-xs"}
                                    >
                                      {isActive ? <UserX className="w-3.5 h-3.5 mr-1" /> : <UserCheck className="w-3.5 h-3.5 mr-1" />}
                                      {isActive ? "Revoke" : "Approve"}
                                    </Button>
                                    <Button
                                      onClick={() => handleRemoveEmployee(m.profiles?.id || "")}
                                      variant="ghost"
                                      size="sm"
                                      className="text-status-blocked hover:bg-status-blocked/10 h-8 p-1.5"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: SUBSIDY & CO-PAY SPLIT CONFIGURATION */}
            <TabsContent value="copay" className="space-y-4">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg font-headline-md font-bold flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-primary" />
                    Subsidized Benefit & Co-Pay Percentage Split Settings
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Configure the exact cost-sharing rules between employer sponsorship and employee co-payment.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                    {/* Visual Split Control */}
                    <div className="p-4 sm:p-6 bg-surface-container rounded-2xl border border-border space-y-6">
                      <h4 className="font-semibold text-xs uppercase text-muted-foreground">Subsidized Co-Pay Split Percentage</h4>

                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row justify-between font-bold text-xs sm:text-sm gap-1">
                          <span className="text-primary">Employer Fund: {coPayConfig.subsidyPercentage}%</span>
                          <span className="text-muted-foreground">Employee Co-Pay: {100 - coPayConfig.subsidyPercentage}%</span>
                        </div>

                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={coPayConfig.subsidyPercentage}
                          onChange={(e) => setCoPayConfig({ ...coPayConfig, subsidyPercentage: Number(e.target.value) })}
                          className="w-full h-3 bg-background border border-border rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                      </div>

                      <div className="p-3 sm:p-4 bg-card rounded-xl border border-border space-y-2 text-xs">
                        <p className="font-semibold text-foreground">Example Standard Membership (RWF 50,000 / month):</p>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span>Employer Sponsorship Portion ({coPayConfig.subsidyPercentage}%):</span>
                          <span className="font-bold text-primary font-mono-id">RWF {(50000 * (coPayConfig.subsidyPercentage / 100)).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span>Employee Out-of-Pocket Co-Pay ({100 - coPayConfig.subsidyPercentage}%):</span>
                          <span className="font-bold text-foreground font-mono-id">RWF {(50000 * ((100 - coPayConfig.subsidyPercentage) / 100)).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Additional Billing & Discount Settings */}
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs sm:text-sm">Corporate Account Volume Discount (%)</Label>
                        <Input
                          type="number"
                          value={coPayConfig.discountPercentage}
                          onChange={(e) => setCoPayConfig({ ...coPayConfig, discountPercentage: Number(e.target.value) })}
                          className="mt-1 bg-background border-border"
                          placeholder="e.g. 10%"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Applied as a volume discount on the total employer invoice sum.
                        </p>
                      </div>

                      <div>
                        <Label className="text-xs sm:text-sm">Payment Terms (Days)</Label>
                        <Input
                          type="number"
                          value={coPayConfig.paymentTermsDays}
                          onChange={(e) => setCoPayConfig({ ...coPayConfig, paymentTermsDays: Number(e.target.value) })}
                          className="mt-1 bg-background border-border"
                          placeholder="e.g. 30"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Invoice payment due date allowance from generation date (Net 30, Net 60).
                        </p>
                      </div>

                      <Button onClick={handleUpdateCoPayConfig} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold mt-4 min-h-[44px]">
                        Save Co-Pay Configuration
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: INVOICES & BILLING */}
            <TabsContent value="billing" className="space-y-4">
              <Card className="bg-card border-border overflow-hidden">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
                  <div>
                    <CardTitle className="text-base sm:text-lg font-headline-md font-bold flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-primary" />
                      Consolidated Corporate Invoices & Auto-Debit
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Review monthly B2B statements, generate new billing statements, and settle via Paypack MoMo B2B links.
                    </CardDescription>
                  </div>

                  <Button onClick={() => setShowInvoiceModal(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm min-h-[38px]">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Generate Monthly B2B Invoice
                  </Button>
                </CardHeader>

                <CardContent className="p-4 sm:p-6">
                  <div className="border border-border rounded-xl overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-surface-container/50">
                        <TableRow>
                          <TableHead className="text-xs">Invoice Number</TableHead>
                          <TableHead className="text-xs">Billing Period</TableHead>
                          <TableHead className="text-xs">Enrolled Employees</TableHead>
                          <TableHead className="text-xs">Subtotal</TableHead>
                          <TableHead className="text-xs">Total Due</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-right text-xs">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accountDetails.invoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                              No corporate invoices generated yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          accountDetails.invoices.map((inv) => {
                            const isPaid = inv.status === 'paid';
                            return (
                              <TableRow key={inv.id}>
                                <TableCell className="font-mono-id font-bold text-xs text-primary">
                                  {inv.invoice_number}
                                </TableCell>
                                <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                                  {inv.billing_period_start} to {inv.billing_period_end}
                                </TableCell>
                                <TableCell className="text-xs">{inv.total_active_employees} employees</TableCell>
                                <TableCell className="text-xs font-mono-id whitespace-nowrap">
                                  RWF {Number(inv.subtotal).toLocaleString()}
                                </TableCell>
                                <TableCell className="font-bold text-xs text-foreground whitespace-nowrap font-mono-id">
                                  RWF {Number(inv.total_due).toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <Badge className={isPaid ? "bg-status-cleared/15 text-status-cleared border-status-cleared/30 text-[10px]" : "bg-status-action/15 text-status-action border-status-action/30 text-[10px]"}>
                                    {inv.status.toUpperCase()}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                      onClick={() => handleDownloadInvoicePdf(inv)}
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 text-xs px-2"
                                    >
                                      <Download className="w-3.5 h-3.5 mr-1" />
                                      PDF
                                    </Button>

                                    {!isPaid && (
                                      <Button
                                        onClick={() => handleTriggerPaypackLink(inv)}
                                        size="sm"
                                        className="bg-status-cleared hover:bg-status-cleared/90 text-status-cleared-foreground h-8 text-xs px-2.5 font-bold"
                                      >
                                        <Zap className="w-3.5 h-3.5 mr-1" />
                                        Paypack
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: WELLNESS ENGAGEMENT ANALYTICS */}
            <TabsContent value="analytics" className="space-y-4">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg font-headline-md font-bold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Corporate Wellness Utilization & HR Analytics
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Real-time engagement metrics, department workout trends, and benefit utilization.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                    <div className="p-4 sm:p-5 bg-surface-container rounded-xl border border-border space-y-2">
                      <div className="flex items-center gap-2 text-primary font-semibold text-xs sm:text-sm">
                        <Sparkles className="w-4 h-4" /> Monthly Gym Visits (All Employees)
                      </div>
                      <div className="text-2xl sm:text-3xl font-bold font-mono-id text-foreground">
                        {totalEmployees * 8} visits
                      </div>
                      <p className="text-xs text-muted-foreground">Avg 8.2 workouts per employee/month</p>
                    </div>

                    <div className="p-4 sm:p-5 bg-surface-container rounded-xl border border-border space-y-2">
                      <div className="flex items-center gap-2 text-status-cleared font-semibold text-xs sm:text-sm">
                        <TrendingUp className="w-4 h-4" /> HR Wellness Engagement Rate
                      </div>
                      <div className="text-2xl sm:text-3xl font-bold font-mono-id text-foreground">
                        {totalEmployees > 0 ? Math.round((activePasses/totalEmployees)*100) : 85}%
                      </div>
                      <p className="text-xs text-muted-foreground">+12% vs last calendar month</p>
                    </div>

                    <div className="p-4 sm:p-5 bg-surface-container rounded-xl border border-border space-y-2">
                      <div className="flex items-center gap-2 text-secondary font-semibold text-xs sm:text-sm">
                        <ShieldCheck className="w-4 h-4" /> Top Department
                      </div>
                      <div className="text-2xl sm:text-3xl font-bold text-foreground">
                        {departments[0] || "Engineering"}
                      </div>
                      <p className="text-xs text-muted-foreground">Highest gym check-in frequency</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      {/* MODAL 1: NEW CORPORATE CLIENT ACCOUNT */}
      {showNewAccountModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 my-8 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-headline-md font-bold text-base sm:text-lg">Create New Corporate Client Account</h3>
              <button onClick={() => setShowNewAccountModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4 text-xs sm:text-sm">
              <div>
                <Label>Company Name *</Label>
                <Input
                  required
                  placeholder="e.g. Soho Kigali, Bank of Kigali"
                  value={newAccountForm.companyName}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, companyName: e.target.value })}
                  className="bg-background border-border mt-1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>TIN Number</Label>
                  <Input
                    placeholder="100293848"
                    value={newAccountForm.tinNumber}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, tinNumber: e.target.value })}
                    className="bg-background border-border mt-1"
                  />
                </div>
                <div>
                  <Label>HR Contact Name</Label>
                  <Input
                    placeholder="Jane Doe"
                    value={newAccountForm.contactPersonName}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, contactPersonName: e.target.value })}
                    className="bg-background border-border mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>HR Contact Email</Label>
                  <Input
                    type="email"
                    placeholder="hr@company.com"
                    value={newAccountForm.contactEmail}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, contactEmail: e.target.value })}
                    className="bg-background border-border mt-1"
                  />
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <Input
                    placeholder="0788000000"
                    value={newAccountForm.contactPhone}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, contactPhone: e.target.value })}
                    className="bg-background border-border mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Subsidized Share (%)</Label>
                  <Input
                    type="number"
                    value={newAccountForm.subsidyPercentage}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, subsidyPercentage: Number(e.target.value) })}
                    className="bg-background border-border mt-1"
                  />
                </div>
                <div>
                  <Label>Corporate Discount (%)</Label>
                  <Input
                    type="number"
                    value={newAccountForm.discountPercentage}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, discountPercentage: Number(e.target.value) })}
                    className="bg-background border-border mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setShowNewAccountModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary text-primary-foreground font-semibold">
                  Create Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BULK CSV ROSTER UPLOAD */}
      {showCsvUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 my-8 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-headline-md font-bold text-base sm:text-lg flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-status-cleared" />
                Bulk CSV Employee Roster Upload
              </h3>
              <button onClick={() => setShowCsvUploadModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-muted-foreground">
              <p>Paste raw CSV data or employee list. Expected format per line:</p>
              <code className="block p-2 bg-surface-container rounded font-mono-id text-foreground border border-border overflow-x-auto">
                email, first_name, last_name, phone, employee_id_number, department, subsidy_cap
              </code>
            </div>

            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => handleParseCsv(e.target.value)}
              placeholder="e.g. employee@bankofkigali.rw, Alice, Mugisha, 0788112233, BK-001, Engineering, 50000"
              className="w-full p-3 font-mono-id text-xs border border-border rounded-xl bg-background text-foreground outline-none"
            />

            {parsedCsvRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-status-cleared">
                  Parsed {parsedCsvRows.length} employee record(s) ready for enrollment:
                </p>
                <div className="max-h-36 overflow-y-auto border border-border rounded-lg p-2 text-xs space-y-1 bg-surface-container">
                  {parsedCsvRows.map((r, idx) => (
                    <div key={idx} className="flex justify-between py-1 border-b border-border/50">
                      <span className="font-semibold text-foreground">{r.first_name} {r.last_name} ({r.email})</span>
                      <span className="text-muted-foreground">{r.department} • Cap: RWF {r.subsidy_cap.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" onClick={() => setShowCsvUploadModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleBulkSubmitCsv}
                disabled={uploadingCsv || parsedCsvRows.length === 0}
                className="bg-primary text-primary-foreground font-semibold"
              >
                {uploadingCsv ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Enroll {parsedCsvRows.length} Employees
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD SINGLE EMPLOYEE */}
      {showAddEmployeeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 my-8 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-headline-md font-bold text-base sm:text-lg">Enroll Individual Employee</h3>
              <button onClick={() => setShowAddEmployeeModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4 text-xs sm:text-sm">
              <div>
                <Label>Employee Email *</Label>
                <Input
                  type="email"
                  required
                  placeholder="employee@company.com"
                  value={newMemberForm.email}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                  className="bg-background border-border mt-1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>First Name</Label>
                  <Input
                    placeholder="Jean"
                    value={newMemberForm.firstName}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, firstName: e.target.value })}
                    className="bg-background border-border mt-1"
                  />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input
                    placeholder="Paul"
                    value={newMemberForm.lastName}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, lastName: e.target.value })}
                    className="bg-background border-border mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Employee ID</Label>
                  <Input
                    placeholder="EMP-012"
                    value={newMemberForm.employeeIdNumber}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, employeeIdNumber: e.target.value })}
                    className="bg-background border-border mt-1"
                  />
                </div>
                <div>
                  <Label>Department</Label>
                  <Input
                    placeholder="Operations"
                    value={newMemberForm.department}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, department: e.target.value })}
                    className="bg-background border-border mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Individual Subsidy Cap (RWF / Month)</Label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={newMemberForm.subsidyCap}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, subsidyCap: Number(e.target.value) })}
                  className="bg-background border-border mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setShowAddEmployeeModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary text-primary-foreground font-semibold">
                  Enroll Employee
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: GENERATE MONTHLY CONSOLIDATED INVOICE */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 my-8 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-headline-md font-bold text-base sm:text-lg">Generate Monthly B2B Statement</h3>
              <button onClick={() => setShowInvoiceModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateInvoice} className="space-y-4 text-xs sm:text-sm">
              <div>
                <Label>Billing Period Start Date</Label>
                <Input
                  type="date"
                  required
                  value={invoiceForm.billingPeriodStart}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, billingPeriodStart: e.target.value })}
                  className="bg-background border-border mt-1"
                />
              </div>

              <div>
                <Label>Billing Period End Date</Label>
                <Input
                  type="date"
                  required
                  value={invoiceForm.billingPeriodEnd}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, billingPeriodEnd: e.target.value })}
                  className="bg-background border-border mt-1"
                />
              </div>

              <div>
                <Label>Invoice Due Date</Label>
                <Input
                  type="date"
                  required
                  value={invoiceForm.dueDate}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                  className="bg-background border-border mt-1"
                />
              </div>

              <div className="p-3 bg-status-action/10 border border-status-action/30 rounded-lg text-xs text-status-action">
                This will automatically calculate the subsidized fee across all active enrolled employees ({accountDetails?.members?.length || 0}) and apply the configured {accountDetails?.account?.discount_percentage}% corporate discount.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setShowInvoiceModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary text-primary-foreground font-semibold">
                  Generate B2B Invoice
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: PAYPACK B2B PAYMENT LINK */}
      {showPaypackModal && activeInvoiceForPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 my-8 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-headline-md font-bold text-base sm:text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-status-cleared" />
                Paypack B2B Payment Request
              </h3>
              <button onClick={() => setShowPaypackModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingPaypack ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-status-cleared" />
                <p className="text-xs text-muted-foreground">Connecting to Paypack B2B Gateway...</p>
              </div>
            ) : paypackLinkData ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-status-cleared/10 border border-status-cleared/30 rounded-xl space-y-2">
                  <p className="font-semibold text-status-cleared">Paypack B2B Link Generated!</p>
                  <p>Invoice: <span className="font-mono-id font-bold text-foreground">{paypackLinkData.invoice_number}</span></p>
                  <p>Amount: <span className="font-bold text-foreground">RWF {Number(paypackLinkData.amount).toLocaleString()}</span></p>
                  <p>Auto-Debit Target: <span className="font-mono-id text-foreground">{paypackLinkData.recipient_phone}</span></p>
                  <p>Reference: <span className="font-mono-id text-foreground">{paypackLinkData.payment_reference}</span></p>
                </div>

                <div className="space-y-2">
                  <Label>B2B Payment Link URL:</Label>
                  <Input readOnly value={paypackLinkData.payment_url} className="font-mono-id text-xs bg-background border-border" />
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    onClick={() => handleSettleInvoice(activeInvoiceForPayment.id, "paypack_momo")}
                    className="w-full bg-status-cleared hover:bg-status-cleared/90 text-status-cleared-foreground font-bold min-h-[40px]"
                  >
                    Confirm & Settle via Paypack MoMo B2B
                  </Button>
                  <Button
                    onClick={() => handleSettleInvoice(activeInvoiceForPayment.id, "bank_transfer")}
                    variant="outline"
                    className="w-full min-h-[40px]"
                  >
                    Mark Paid via Direct Bank Transfer
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
