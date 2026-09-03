# PolyFit Brand & Design System v1.0
*A machine-readable Visual Constitution for PolyFit engineers, designers, and AI coding agents.*

---

## 1. Brand Essence & Personality
PolyFit is an enterprise wellness infrastructure and B2B network platform connecting corporate employers, employees, and local fitness facilities in Rwanda and across East Africa.

- **Primary Persona:** Confident, institutional, enterprise-grade (inspired by Stripe & modern health-tech).
- **Secondary Persona:** Energetic, kinetic, health & movement forward.
- **Supporting Attributes:** Trustworthy, accessible, intelligent, human.
- **What PolyFit is NOT:** Traditional gym brand, bodybuilding supplement company, aggressive black/red aesthetic, or consumer fitness fad.

---

## 2. Core Color Tokens

### Brand Core
```yaml
brand:
  primary: "#0B1F33"      # PolyFit Navy: Headers, navigation, primary text, dark sections, enterprise surfaces
  accent: "#28D17C"       # PolyFit Green: Primary CTA, active states, verified check-ins, success metrics
  secondary: "#3B82F6"    # Electric Blue: Informational states, secondary actions, links, analytic accents
  highlight: "#B8F36B"    # Warm Lime: Subtle illustrations, promotional moments, gradient accents (never primary)
```

### Neutral Surface Palette
```yaml
neutral:
  background: "#F7F9FC"   # Clean enterprise canvas
  surface: "#FFFFFF"      # Pure white cards and panels
  surface-dark: "#0B1F33" # Dark mode / hero background
  surface-dark-subtle: "#0E2238" # Elevated dark container
  border: "#E2E8F0"       # 1px hairline border on light surfaces
  border-dark: "rgba(255, 255, 255, 0.1)" # 1px hairline on dark surfaces
  text-primary: "#0B1F33" # High-contrast primary reading text
  text-secondary: "#64748B" # Muted descriptive labels
  text-dark-primary: "#FFFFFF" # White text on dark navy
  text-dark-secondary: "#94A3B8" # Slate text on dark navy
```

### Semantic Status Tokens
```yaml
semantic:
  success: "#28D17C"      # Verified check-in, payment cleared, active membership
  warning: "#F59E0B"      # Expiring plan, capacity warning, pending review
  error: "#EF4444"        # Payment failed, invalid credential, access denied
  info: "#3B82F6"         # Informational banners, scheduled visits
```

---

## 3. Typography & Scale
Primary typeface: **Inter** (fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
Monospace numbers & IDs: **JetBrains Mono**.

| Token | Size | Weight | Line Height | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `display-2xl` | 60px | 700 / 800 | 1.1 | -0.02em | Hero headline (desktop) |
| `display-xl` | 48px | 700 | 1.15 | -0.02em | Hero headline (tablet), major titles |
| `headline-lg` | 36px | 700 | 1.2 | -0.015em | Section headlines (H2) |
| `headline-md` | 24px | 700 | 1.3 | -0.01em | Card headings, module headers |
| `headline-sm` | 20px | 600 | 1.35 | -0.005em | Subheadings, modal titles |
| `body-lg` | 18px | 400 / 500 | 1.6 | 0 | Hero subcopy, lead paragraphs |
| `body-base` | 16px | 400 / 500 | 1.5 | 0 | Standard body copy, inputs, buttons |
| `body-sm` | 14px | 400 / 500 | 1.5 | 0 | Secondary text, table data, cards |
| `caption` | 12px | 500 / 600 | 1.4 | 0.01em | Metadata, timestamps, pill badges |
| `mono-id` | 12px | 500 | 1.4 | 0 | Member IDs, RWF amounts, transaction hashes |

---

## 4. Spacing System (4px Base Unit)
All paddings, margins, and gaps must strictly adhere to the 4px scale:
- `space-1`: 4px
- `space-2`: 8px
- `space-3`: 12px
- `space-4`: 16px
- `space-5`: 20px
- `space-6`: 24px
- `space-8`: 32px
- `space-10`: 40px
- `space-12`: 48px
- `space-16`: 64px
- `space-24`: 96px

---

## 5. Border Radius & Elevation
```yaml
radius:
  card: 14px       # Standard for all content cards and panels
  button: 10px     # Standard for interactive buttons and inputs
  badge: 9999px    # Full pill radius for tags, status chips, badges
  inner: 8px       # Nested sub-elements inside cards

shadow:
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
  card: "0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)"
  elevated: "0 10px 25px -5px rgba(11, 31, 51, 0.1), 0 8px 10px -6px rgba(11, 31, 51, 0.05)"
  modal: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
```

---

## 6. Core Visual Motifs

### Motif 1: The Connected Network
The foundational visual architecture of PolyFit is **connected nodes**:
`Employer / Company` ───► `PolyFit Hub` ───► `Gym A · Studio B · Pool C`
- Use subtle glowing nodes, clean 1.5–2px dashed or solid connecting lines, and small labeled badges.
- Highlights: One corporate contract routes into multiple fitness choices.

### Motif 2: Movement & Flow
- Curved paths and directional transitions representing benefit flow from companies to employees to facilities.
- Subtle particle animations or directional flow indicators (never distracting or looping endlessly).

---

## 7. Component Rules

### Buttons
- **Primary:** Background `#28D17C` (PolyFit Green), text `#0B1F33` (PolyFit Navy) or `#FFFFFF`, radius `10px`, min-height `44px` (desktop) / `48px` (touch).
- **Secondary / Outlined:** Background transparent/white, border `1px solid #0B1F33` or `#28D17C`, text `#0B1F33` or `#28D17C`, radius `10px`.
- **Destructive:** Background `#EF4444`, text `#FFFFFF`, radius `10px`.
- **Ghost:** Transparent background, text hover transition, radius `10px`.

### Cards
- Clean white background (`#FFFFFF`), `1px border solid #E2E8F0`, `14px` border radius, generous internal padding (`p-6` to `p-8`).
- Never use heavy drop-shadows or floating card noise.

### Iconography
- Exclusively **Lucide Icons**.
- Geometric, outline style, `1.75px` to `2px` stroke width.
- Core map:
  - Employer: `Building2`
  - Employee: `UserRound`
  - Facility / Gym: `Dumbbell`
  - Location: `MapPin`
  - Verified Visit: `BadgeCheck` / `ShieldCheck`
  - Billing & Settlement: `DollarSign` / `CreditCard`
  - Analytics & Reports: `BarChart3` / `TrendingUp`
  - Network: `Network`

---

## 8. Surface Archetypes: Employee vs. Employer vs. Provider

| Dimension | Employee Interface | Employer Dashboard | Provider Console |
| :--- | :--- | :--- | :--- |
| **Primary Goal** | Action & discovery | Analytics & cost governance | Revenue & attendance settlement |
| **Tone** | Energetic, simple, visual | Institutional, corporate, authoritative | Commercial, operational, clear |
| **Key Metrics** | Nearby open gyms, check-in pass | Active employee count, % utilization, cost | Today's visits, monthly settlement (RWF) |
| **Form Factor** | Mobile-first touch interface | 12-column responsive web | High-density reception / tablet web |

---

## 9. Photography & Illustration Guidelines
- **Real People:** Feature ordinary African employees, professionals, and fitness enthusiasts engaging in diverse physical activities (running, swimming, weight training, group yoga, walking).
- **Avoid:** Bodybuilding competition extremes, aggressive gym tropes, fake stock handshake photos, unrealistic influencers.
- **Illustrations:** Minimalist geometric vector lines, connected network nodes, regional map accents (Musanze, Kigali).

---

## 10. The PolyFit Design Constitution (Rules for AI Coding Agents)
1. **Infrastructure First:** PolyFit is an enterprise wellness infrastructure platform, never a bodybuilding gym brand.
2. **Strict Token Adherence:** Always use design tokens (`#0B1F33`, `#28D17C`, `#3B82F6`, `#B8F36B`, `#F7F9FC`). Never invent arbitrary hex codes.
3. **No Arbitrary Sizing:** Font sizes and spacing must match the Inter typographic scale and 4px baseline rhythm.
4. **Card Radius 14px / Button Radius 10px:** Never mix arbitrary border radii.
5. **No Fake Social Proof:** Never invent customer logos, fake review quotes, or fabricated numbers (e.g., "500+ gyms", "10,000 active employees").
6. **Ground in Rwanda:** Reference genuine validation clusters (Musanze pilot, Kigali corridor).
7. **Lucide Icons Exclusively:** Do not mix icon sets or emojis in professional UI components.
8. **Consistent Separation:** Ensure Employee, Employer, and Provider dashboards follow their specific tonal archetypes.
