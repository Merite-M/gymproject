**POLYFIT**

**Brand & Design System — v1.0**

*Canonical visual foundation for PolyFit products, websites, dashboards, mobile apps, marketing, and AI engineering agents.*

# **1\. Brand Direction**

PolyFit is an enterprise wellness infrastructure company, not a traditional bodybuilding or gym brand. The visual identity should communicate corporate-grade trust, energy, accessibility, intelligence, and modern technology.

Reference feeling: Stripe × modern health-tech × premium fitness technology.

# **2\. Brand Personality**

* Confident
* Energetic
* Trustworthy
* Accessible
* Intelligent
* Human

# **3\. Core Color Tokens**

| Token | Name | Hex | Primary Use |
| :---- | :---- | :---- | :---- |
| brand.navy | PolyFit Navy | \#0B1F33 | Headers, navigation, primary text, dark sections |
| brand.green | PolyFit Green | \#28D17C | Primary CTA, active states, success, verified visits, key metrics |
| brand.blue | PolyFit Blue | \#3B82F6 | Information, links, analytics, secondary actions |
| brand.lime | PolyFit Lime | \#B8F36B | Highlights, illustrations, promotional moments, gradients |
| neutral.white | White | \#FFFFFF | Primary surface |
| neutral.bg | Background | \#F7F9FC | App/page background |
| neutral.surface2 | Surface Secondary | \#F1F4F8 | Secondary surfaces |
| neutral.border | Border | \#E2E8F0 | Dividers and component borders |
| text.primary | Text Primary | \#0B1F33 | Primary copy |
| text.secondary | Text Secondary | \#526173 | Supporting copy |
| text.muted | Text Muted | \#8491A3 | Low-emphasis copy |

# **4\. Semantic Colors**

| Semantic Token | Hex | Usage |
| :---- | :---- | :---- |
| success | \#16A34A | Successful actions, verified states |
| warning | \#F59E0B | Warnings, attention states |
| error | \#DC2626 | Errors, destructive actions |
| info | \#2563EB | Informational states |

# **5\. Dark Mode Tokens**

* dark.background \= \#071521
* dark.surface \= \#0D2235
* dark.surfaceElevated \= \#132D43
* dark.border \= \#21405A
* dark.textPrimary \= \#F8FAFC
* dark.textSecondary \= \#B8C5D3
* Keep PolyFit Green as the primary accent.

# **6\. Typography**

Primary typeface: Inter. Use it consistently across web, mobile, dashboards, and marketing.

| Token | Size | Line Height | Weight |
| :---- | :---- | :---- | :---- |
| Display | 48px | 56px | 700 |
| H1 | 36px | 44px | 700 |
| H2 | 30px | 38px | 700 |
| H3 | 24px | 32px | 650 |
| H4 | 20px | 28px | 600 |
| Body Large | 18px | 28px | 400 |
| Body | 16px | 24px | 400 |
| Body Small | 14px | 20px | 400 |
| Caption | 12px | 16px | 500 |

# **7\. Spacing System**

Use a 4px base unit. AI engineers should use tokens instead of arbitrary spacing.

space-1 4px · space-2 8px · space-3 12px · space-4 16px · space-5 20px · space-6 24px · space-8 32px · space-10 40px · space-12 48px · space-16 64px · space-20 80px · space-24 96px

# **8\. Radius & Elevation**

Radius: sm 6px · md 10px · lg 14px · xl 20px · full 9999px. Recommended: 14px cards, 10px buttons, 9999px pills. Shadows should remain subtle.

# **9\. Core Brand Elements**

## **Network**

Use connected nodes as a recurring visual motif: Employer → PolyFit → multiple fitness providers. Apply it selectively to hero graphics, onboarding, empty states, network maps, and marketing.

## **Movement & Flow**

Use curved paths, arcs, flowing gradients, and restrained motion to communicate people and benefits moving through the network.

## **Logo Direction**

Explore a P-based symbol incorporating multiple connected paths/nodes or a movement motif. It must work as favicon, app icon, QR/check-in mark, signage, and business identity. Avoid generic dumbbell \+ wordmark combinations.

# **10\. Iconography**

Use Lucide Icons consistently. Preferred style: outline, geometric, approximately 1.75–2px stroke.

Examples: Building2 (employer), UserRound (employee), Dumbbell (gym), MapPin (location), BadgeCheck (verified visit), CreditCard (payments), chart icons (analytics), Network (network).

# **11\. Product Surface Rules**

## **Employee App**

Energetic, visual, simple and action-oriented. Prioritize nearby providers, availability, check-in, membership status, and clear next actions.

## **Employer Dashboard**

Analytical and corporate. Prioritize participation, utilization, spend, cost per active employee, provider utilization, and outcomes.

## **Provider Dashboard**

Commercial and operational. Prioritize check-ins, earnings, members, attendance, payments, settlements, and analytics.

# **12\. Photography & Illustration**

Prefer authentic African users and realistic fitness/wellness situations: diverse body types, men and women, ordinary employees, strength training, running, group classes, swimming, walking, and cycling.

Avoid bodybuilding clichés, overly muscular influencer imagery, generic corporate handshakes, and unrealistic stock-photo aesthetics.

Illustrations should be minimal and geometric, using network nodes and flowing lines rather than cartoon-heavy characters.

# **13\. Buttons & Components**

* Primary: PolyFit Green background with high-contrast text.
* Secondary: neutral surface with Navy text/border.
* Ghost: transparent, low-emphasis actions.
* Destructive: semantic Error.
* Cards: white/neutral surface, 1px border, 14px radius, generous spacing.
* Reuse existing tokens/components rather than inventing new styles.

# **14\. Motion**

Motion should be fast, subtle, purposeful, and functional. Example: QR scan → confirmation → verified state. Network animation may show nodes connecting. Avoid flashy animation.

# **15\. AI Engineering Constitution**

* PolyFit is an enterprise wellness infrastructure company, not a bodybuilding/gym brand.
* Prioritize clarity, trust, accessibility, and simplicity.
* Use design tokens instead of hard-coded visual values.
* Never introduce new colors without adding them to the design system.
* Never introduce arbitrary font sizes or spacing values.
* Use Lucide icons consistently.
* Use connected nodes and movement/flow as recurring brand motifs.
* Employee interfaces prioritize simplicity and action.
* Employer interfaces prioritize analytics and business outcomes.
* Provider interfaces prioritize revenue, attendance, and settlement.
* Avoid generic gym aesthetics.
* Design mobile-first for employees and responsive web for employers/providers.

# **16\. Recommended Token Structure for Stitch / Code**

Maintain a single source of truth. Suggested groups: brand.\*, neutral.\*, text.\*, semantic.\*, dark.\*, typography.\*, spacing.\*, radius.\*, shadow.\*, and motion.\*. Components should consume these tokens rather than embedding raw values.

# **17\. Brand Guardrails**

* Do not make every surface green.
* Do not use black/red bodybuilding aesthetics.
* Do not use emojis as the primary icon system.
* Do not mix multiple icon libraries.
* Do not create a separate visual identity for every product surface.
* Do not overuse gradients, glassmorphism, or floating cards.
* Do not sacrifice accessibility for visual novelty.

# **18\. Future Evolution**

The initial product is corporate fitness access, but the brand should remain broad enough to evolve into a corporate wellness network. Avoid visual decisions that permanently constrain PolyFit to gyms alone.

**POLYFIT — One benefit. Multiple ways to move.**