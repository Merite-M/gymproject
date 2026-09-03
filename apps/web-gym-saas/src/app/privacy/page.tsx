import Link from "next/link";
import { ArrowLeft, Shield, Lock, Eye, FileText } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link 
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to PolyFit Home
          </Link>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="font-bold text-foreground">PolyFit</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            <Shield className="w-4 h-4" />
            <span>Rwanda Law No 058/2021 Compliant</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Effective Date: September 1, 2026. Last updated: September 2026.
          </p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-foreground/90 leading-relaxed">
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <Eye className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-bold text-foreground m-0">1. Commitment to Privacy</h2>
            </div>
            <p className="text-muted-foreground">
              PolyFit Ltd (&quot;PolyFit&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides a corporate wellness network connecting employers, employees, and partner fitness facilities across East Africa, operating primarily in Rwanda. We respect your privacy and are committed to protecting your personal data in full compliance with Rwandan Law No 058/2021 relating to the protection of personal data and privacy.
            </p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-bold text-foreground m-0">2. Information We Collect</h2>
            </div>
            <p className="text-muted-foreground">
              We collect information that you directly provide when requesting corporate demos, joining our provider network, or registering an employee profile:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Corporate Leads:</strong> Name, work email address, telephone number, organization name, employee headcount, and wellness objectives.</li>
              <li><strong className="text-foreground">Fitness Providers:</strong> Business name, facility physical address, contact representative name, telephone number, operational hours, and facility capacity.</li>
              <li><strong className="text-foreground">Check-in Verification Data:</strong> Facility check-in timestamps, verification tokens, and member roster confirmation to process cross-facility billing and settlement.</li>
            </ul>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-bold text-foreground m-0">3. Purpose and Legal Basis for Processing</h2>
            </div>
            <p className="text-muted-foreground">
              We process personal information under the following legal bases:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>To evaluate and establish corporate membership contracts and provider partnership agreements.</li>
              <li>To calculate and settle facility utilization payments between corporate employers and network fitness providers.</li>
              <li>To dispatch automated transaction notifications (SMS and email confirmations) regarding inquiries, tours, and active memberships.</li>
              <li>To detect and prevent fraudulent access or double-check-in violations across partner turnstiles and scanners.</li>
            </ul>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4">
            <h2 className="text-2xl font-bold text-foreground m-0">4. Data Sharing & Third Parties</h2>
            <p className="text-muted-foreground">
              We do not sell, rent, or trade your personal data. We only share operational data with authorized network providers to verify access eligibility, and with payment processing gateways licensed by the National Bank of Rwanda (BNR) for settlement reconciliation.
            </p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4">
            <h2 className="text-2xl font-bold text-foreground m-0">5. Contact Information</h2>
            <p className="text-muted-foreground">
              If you have inquiries regarding your personal data or wish to exercise your rights of access, rectification, or deletion under Law No 058/2021, contact our Data Protection Officer:
            </p>
            <div className="p-4 bg-muted rounded-xl text-sm">
              <p className="font-semibold text-foreground">PolyFit Data Protection Officer</p>
              <p className="text-muted-foreground">Email: privacy@polyfit.rw</p>
              <p className="text-muted-foreground">Physical Office: Kigali, Rwanda</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
