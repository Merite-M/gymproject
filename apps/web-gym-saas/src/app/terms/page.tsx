import Link from "next/link";
import { ArrowLeft, Scale, Building2, Dumbbell, UserCheck } from "lucide-react";

export default function TermsPage() {
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
            <Scale className="w-4 h-4" />
            <span>Platform Agreement</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Effective Date: September 1, 2026. Governing East African Operations.
          </p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-foreground/90 leading-relaxed">
          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4">
            <h2 className="text-2xl font-bold text-foreground m-0">1. Overview of Services</h2>
            <p className="text-muted-foreground">
              PolyFit operates a decentralized corporate wellness network and operations software infrastructure. By accessing the PolyFit platform, submitting corporate inquiries, or participating in the network, you agree to these Terms of Service.
            </p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-bold text-foreground m-0">2. Corporate Employer Terms</h2>
            </div>
            <p className="text-muted-foreground">
              Corporate clients enter into corporate wellness service agreements providing employee rosters with access to partner fitness facilities. The employer agrees to maintain accurate employee rosters, designate authorized administrative leads, and adhere to agreed invoice payment terms.
            </p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <Dumbbell className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-bold text-foreground m-0">3. Network Provider Terms</h2>
            </div>
            <p className="text-muted-foreground">
              Participating fitness facilities agree to provide access to verified corporate employees during standard operational hours. Visits are verified via PolyFit&apos;s digital check-in system or integrated IoT turnstile relays. Providers are reimbursed monthly based on verified check-in volume and agreed tier rates.
            </p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <UserCheck className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-bold text-foreground m-0">4. Member Code of Conduct</h2>
            </div>
            <p className="text-muted-foreground">
              Members utilizing the PolyFit pass must abide by all house safety rules and facility guidelines of each host venue. Passes and verification credentials (QR codes, NFC tokens, or PINs) are strictly personal and non-transferable. Anti-passback algorithms monitor check-in frequencies to prevent badge sharing.
            </p>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4">
            <h2 className="text-2xl font-bold text-foreground m-0">5. Governing Law & Jurisdiction</h2>
            <p className="text-muted-foreground">
              These terms are governed by the laws of the Republic of Rwanda. Any dispute arising under this agreement shall be settled through amicable negotiation or submitted to the competent commercial courts in Kigali, Rwanda.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
