### Master Strategic Tech Spec: B2B Corporate Wellness Network Playbook

#### 1\. THE FOUNDER’S PIVOT & CO-FOUNDER CONSTITUTION

##### Transitioning from SaaS Provider to Network Orchestrator

The fundamental strategic pivot is the shift from a passive SaaS vendor to a high-agency  **Network Orchestrator** . In the fragmented East African fitness market, software alone is a commodity; controlling the "physical door" is the ultimate moat. We are building the B2B infrastructure that bridges the gap between corporate budget holders and fragmented providers. By aggregating gyms, pools, and studios into a single managed network, we solve the ROI problem for employers: underutilization due to location inconvenience. This position allows us to dictate the terms of market access.

##### The Hardware-Software Interlock (The Trojan Horse)

We do not sell gym management software; we deploy proprietary infrastructure. We offer our BOH (Back-of-House) tools to gyms at zero cost—a "Trojan Horse" strategy designed to seize control of the physical access point. This  **Hardware-Software Interlock**  utilizes our software as the verification layer and Shelly Smart Relays as the physical enforcement layer. This eliminates check-in fraud via real-time front-desk photo ID monitors and automated door locks. By owning this stream of "Verified Human Presence," we generate a proprietary data asset that aggregators like Wellhub, who rely on easily spoofed soft QR codes, cannot match.

##### Infrastructure Advantage & Financial Flow

Our infrastructure eliminates integration friction by automating transaction splits between the platform and gym providers. Utilizing the  **SPENN Flow** , we manage transaction distributions to gyms at a fixed cost of 200 RWF per transaction (for amounts \< 150,000 RWF), ensuring our $7/month backend budget remains viable. This seamless financial flow creates a locked-in ecosystem where gyms receive predictable, verified revenue, while the platform captures the spread.*This physical control layer necessitates a unified, high-velocity technical stack designed to manage high-concurrency data and sub-100ms hardware execution.*

#### 2\. UNIVERSAL TECH ARCHITECTURE (NEXT.JS \+ EXPO 56 \+ TURBOREPO)

##### The "Universal React" Philosophy

To maintain microscopic developer overhead while scaling a multi-platform network, command the architecture to a unified  **Universal React**  codebase. We minimize context-switching by enforcing a single language (TypeScript) and a shared logic layer across the BOH Gym Admin, HR Portal, and the Member App. This is the only path to maintaining a 200+ IQ architectural depth with a lean engineering squad.

##### Monorepo Specification (Turborepo)

The workspace is managed via  **Turborepo** , ensuring high-performance build caching and clear package boundaries.

* **apps/web** : Next.js 15 (App Router) for the multi-tenant HR/Admin Portals.  
* **apps/mobile** : Expo 56 for the Member App, targeting React 19 compatibility to future-proof the "Universal" philosophy.  
* **packages/ui** : Shared components using  **NativeWind**  (Tailwind v4) to ensure 1:1 styling consistency across Web and Native surfaces.

##### Shared Logic Layer

We enforce 100% type-safety using tRPC and Zod. Every Mobile Money webhook and Shelly hardware trigger must be validated through strict Zod schemas.| Component | Shared Logic/Tool | Platform Impact || \------ | \------ | \------ || **Database Types** | Drizzle ORM | Unified schema for PostgreSQL; absolute type-safety for multi-tenant queries. || **Backend Router** | tRPC \+ Zod | End-to-end safety; API changes break the build at compile-time across Web and Mobile. || **Global State** | Zustand | Lightweight session management and local cache synchronization. || **Cross-Platform Styling** | NativeWind | Tailwind-style utilities for zero-friction UI sharing between Next.js and Expo. |

##### Deployment Velocity

Command the use of  **EAS Update**  for the Expo 56 mobile app. This allows for instant Over-The-Air (OTA) bug fixes, bypassing app store review cycles for critical logic updates in the access control layer.*This unified logic layer provides the velocity needed for rapid deployment, but the economic moat is only secured if the underlying infrastructure is cost-optimized to near-zero, leading to our "Non-Cash-Burning" topology.*

#### 3\. PRODUCTION DEPLOYMENT TOPOLOGY (RENDER-CENTRIC)

##### "Non-Cash-Burning" Infrastructure

The deployment topology is engineered for near-zero maintenance costs during the growth phase without sacrificing high availability. We prioritize a lean, decentralized execution model.

##### Service Definition: 'gym-frontend-app'

* **Configuration:**  Compiled Next.js 15 application hosted as a Static Site.  
* **Cost:**  $0/month.  
* **Role:**  Serves multi-tenant administrative dashboards via global CDNs, ensuring zero latency for HR managers in Kigali or Nairobi.

##### Service Definition: 'gym-backend-core'

* **Configuration:**  Always-on Node/Express process on Render.  
* **Cost:**  $7/month.  
* **Low-Latency Hardware Logic:**  The backend must utilize a  **persistent WebSocket or MQTT broker**  to trigger Shelly Smart Relays. Standard REST calls are insufficient; the target is \<100ms from mobile tap to physical door unlock.  
* **Fintech Webhook Security:**  Secure processing of Paypack/MTN MoMo/SPENN payments. All webhooks must pass Zod validation and signature verification to prevent spoofing.*This lean technical execution provides the financial runway required to exploit the massive arbitrage opportunities inherent in the "Math of Wellness."*

#### 4\. ARBITRAGE ECONOMICS & MONETIZING SYSTEM DEFECTS

##### The "Math of Wellness" (Fitness Palace Benchmark)

Platform profitability is mathematically driven by utilization "breakage." Using  **Fitness Palace**  as our primary economic benchmark (35,000 RWF/month corporate rate vs. 5,000 RWF day pass), we define the  **Breakage Point at 7 visits** .

* **The Profitability Gap:**  Employers pay for 100% eligibility, but real-world utilization in B2B wellness is 15%–30%.  
* **Arbitrage:**  If an employee visits \<7 times, the platform retains the breakage. If \>7 visits occur, the  **Employee Co-Pay layer**  activates to cap platform liability.

##### Hybrid Pricing Architecture

1. **Fixed Platform Fees:**  B2B SaaS layer for HR reporting (pure margin).  
2. **Verified Per-Visit Billing:**  The "Wellhub" layer; providers are paid only for "Verified Human Presence."  
3. **Employee Co-Pays:**  The "Skin-in-the-game" layer, reducing moral hazard and increasing user commitment.

##### Monetizing 'Fraud'

We productize system defects. Unauthorized pass-sharing is not a security failure but a lead-generation event. We convert these "leaks" into revenue by automatically triggering invitations for  **"Family Plans"**  and  **"Plus-One"**  single-visit passes, turning unauthorized usage into a recurring growth channel.*Transition from theoretical economics to the immediate, high-velocity validation of these hypotheses in the Kigali market.*

#### 5\. 90-DAY DE-RISKED "INFORMATION BUYING" PLAN

##### The "Mechanical Turk" Philosophy

Before committing to heavy engineering, we must "buy information." Manual validation precedes automated code to prevent the expensive development of features the market does not want.

##### Decision Gates & Milestones

Timeline,Milestone,Execution Method  
Day 1-30,Anchor Employer Acquisition,"Targeted sales to  Equity Bank Rwanda, World Vision, and Rwanda Airports Company (RAC)  based on their 2025/2026 fitness tenders."  
Day 31-60,Provider Network Capture,"Onboarding 10-15 gyms (e.g., Fitness Palace) via non-intrusive web scanners and Shelly hardware trials."  
Day 61-90,Verified Usage Pilot,Tracking 50-100 employees via static QR codes and manual spreadsheets to identify edge cases in check-ins and payment splits.  
*Local validation in Kigali creates the blueprint for pan-African dominance, utilizing Rwanda's regulatory framework as a springboard.*

#### 6\. REGULATORY & FINTECH SCALING MOATS (RWANDA TO GLOBAL)

##### The Kigali Catalyst

Rwanda’s regulatory maturity is our springboard. We leverage the  **Kigali International Financial Centre (KIFC)**  to establish a holding structure that is internationally compliant and tax-efficient.

* **Fiscal Incentives:**  3% Corporate Income Tax (CIT) for KIFC members.  
* **Rwandan Advantage:**  100% foreign ownership and zero FX controls allow for friction-free capital repatriation.  
* **Talent:**  Direct pipeline from CMU-Africa for high-IQ engineering roles.

##### PAPSS: The "FX Burn Extinguisher"

As we scale to Kenya, Nigeria, and Egypt, we will utilize the  **Pan-African Payment and Settlement System (PAPSS)** . While competitors lose 3%–5% on USD/EUR currency conversion, we will settle transactions in local RWF/KES/NGN. This adds a hidden  **300bps (3%) to our gross margin** —a structural advantage that global aggregators cannot replicate.

##### AI Agent Guidelines (Windsurf/Jules/Antigravity)

* **Type Safety:**  Enforce strict tRPC-driven type safety between the packages/trpc router and both apps/web and apps/mobile.  
* **Validation:**  Use Zod for all incoming Mobile Money webhooks. No data enters the system without schema validation.  
* **Hardware Performance:**  Optimize the Node/Express backend for MQTT execution. Any relay trigger exceeding 100ms is a system failure.  
* **Infrastructure Constraints:**  Maintain the $0-static/low-cost-web-service topology. Do not introduce high-cost cloud services (AWS/GCP) during the validation phase.

