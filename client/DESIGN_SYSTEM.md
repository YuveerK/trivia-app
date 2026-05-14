# Jobox Design System

A comprehensive design system for the Jobox component library, built with **React**, **Tailwind CSS**, **shadcn/ui**, and **Radix UI** primitives. This document describes colors, typography, spacing, components, and usage patterns.

---

## Table of Contents

1. [Overview](#overview)
2. [Design Tokens](#design-tokens)
3. [Typography](#typography)
4. [Color System](#color-system)
5. [Spacing & Layout](#spacing--layout)
6. [Border Radius](#border-radius)
7. [Shadows & Elevation](#shadows--elevation)
8. [Motion & Animation](#motion--animation)
9. [Components](#components)
10. [App-Level Layout & Patterns](#app-level-layout--patterns)
11. [Utilities & Conventions](#utilities--conventions)
12. [Implementation Notes](#implementation-notes)

---

## Overview

- **Stack:** Next.js 14, React 19, TypeScript, Tailwind CSS 4.x
- **UI base:** [shadcn/ui](https://ui.shadcn.com) (new-york style, CSS variables, no prefix) — see `components.json`
- **Primitives:** Radix UI
- **Icons:** [Lucide React](https://lucide-react.dev)
- **Variants:** [class-variance-authority (CVA)](https://cva.style)
- **Styling:** `cn()` from `@/lib/utils` (clsx + tailwind-merge)
- **Animations:** Keyframes in `app/globals.css`, [tw-animate-css](https://github.com/nicksrandall/tw-animate-css), optional `lib/animations.ts` for JS-driven presets
- **Theme persistence:** [next-themes](https://github.com/pacocoursey/next-themes) via `@/components/theme-provider`

The design system supports **light** and **dark** modes via the `dark` class on the root element (e.g. `<html className="dark">`). Theme is driven by CSS custom properties in `app/globals.css`.

---

## Design Tokens

Tokens are defined in **`app/globals.css`**, which is the single source of truth for this app. The root layout imports `app/globals.css`; **`styles/globals.css`** exists as an alternative theme (oklch, Geist fonts) and is not used by the app layout.

- **`app/globals.css`** — Jobox brand palette in hex on `:root` and `.dark`, plus `@theme` block with HSL and radius for Tailwind 4.
- **Tailwind 4:** No `tailwind.config.ts`; theme is defined via `@theme { ... }` in CSS. The app uses `@import "tailwindcss"` and `@import "tw-animate-css"`.

Tailwind semantic colors use the `@theme` HSL mappings (e.g. `--color-primary: hsl(29 100% 52%)`), so classes like `bg-primary`, `text-foreground` work with light/dark when the `dark` class is applied to the root.

### Token summary (Jobox brand — from `app/globals.css`)

| Token | Light (hex) | Dark (hex) | Purpose |
|-------|-------------|------------|--------|
| `--background` | `#ffffff` | `#222831` | Page/surface background |
| `--foreground` | `#222831` | `#ffffff` | Primary text (Charleston) |
| `--primary` | `#ff8a08` | `#ff8a08` | Primary brand (American Orange) |
| `--primary-foreground` | `#ffffff` | `#ffffff` | Text on primary |
| `--secondary` | `#222831` | `#393e46` | Secondary surfaces/buttons |
| `--secondary-foreground` | `#ffffff` | `#ffffff` | Text on secondary |
| `--accent` | `#ffddb8` | `#ffddb8` | Accent highlight |
| `--accent-foreground` | `#222831` | `#222831` | Text on accent |
| `--muted` | `#f5f5f5` | `#393e46` | Muted backgrounds |
| `--muted-foreground` | `#666666` | `#999999` | Secondary text |
| `--border` | `#e5e5e5` | `#393e46` | Borders |
| `--input` | `#ffffff` | `#393e46` | Input backgrounds |
| `--ring` | `#ff8a08` | `#ff8a08` | Focus ring |
| `--card` | `#ffffff` | `#2d3238` | Card background |
| `--popover` | `#ffffff` | `#2d3238` | Popover background |
| `--destructive` | `#ef4444` | `#ef4444` | Destructive actions |
| `--radius` | `1.5rem` | — | Default border radius |

**Sidebar tokens** (light/dark): `--sidebar-background`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`.

**Chart tokens:** `--chart-1` … `--chart-5` (brand-aligned in app: orange, charleston, accent, green, blue).

### Tailwind semantic colors (`@theme` in `app/globals.css`)

All map to HSL and support light/dark:

- **Surfaces:** `background`, `foreground`, `card`, `popover`, `sidebar` (with sub-tokens)
- **Semantic:** `primary`, `secondary`, `muted`, `accent`, `destructive`
- **UI:** `border`, `input`, `ring`
- **Charts:** `chart-1` … `chart-5`
- **Named:** `american-orange` (#FF8A08), `charleston` (#222831)

---

## Typography

### Font family

- **Primary (sans):** **Manrope** (Google Fonts), with system fallbacks.
- **Weights:** 200, 300, 400, 500, 600, 700, 800.
- **Display:** `swap`.

Manrope is loaded in `app/layout.tsx` and exposed as `--font-manrope`; Tailwind uses it via `font-sans` and `font-manrope`.

```ts
// app/layout.tsx
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-manrope",
})
```

Body: `font-sans antialiased`.

### Type scale (from components)

| Use | Classes | Notes |
|-----|---------|--------|
| Card title | `text-2xl font-semibold leading-none tracking-tight` | Section titles |
| Sheet/Dialog title | `text-lg font-semibold text-foreground` | Modal titles |
| Labels / small headings | `text-sm font-medium leading-none` | Labels, list headers |
| Body / inputs | `text-base` / `md:text-sm` | Default and inputs |
| Descriptions / captions | `text-sm text-muted-foreground` | Secondary text |
| Badge / small UI | `text-xs font-semibold` | Badges, sidebar hints |
| Table header | `text-sm font-medium text-muted-foreground` | Table headers |

---

## Color System

### Brand colors

- **American Orange:** `#FF8A08` — primary actions, links, focus ring.
- **Charleston:** `#222831` — primary text, secondary surfaces.

### Semantic roles

- **Primary:** Main actions and emphasis.
- **Secondary:** Secondary actions, alternate surfaces.
- **Muted:** Backgrounds and secondary text.
- **Accent:** Hover/selected states, highlights.
- **Destructive:** Errors, destructive actions.
- **Foreground / background:** Base text and surfaces.

### Usage in Tailwind

Use semantic names so light/dark and theming stay consistent:

- `bg-background`, `text-foreground`
- `bg-primary`, `text-primary-foreground`
- `bg-muted`, `text-muted-foreground`
- `border-border`, `ring-ring`

---

## Spacing & Layout

- **Base unit:** Tailwind’s default scale (4px per step unless overridden).
- **Card padding:** `p-6` (header/content/footer), `space-y-1.5` (header), `pt-0` for content/footer under header.
- **Input/button height:** `h-10` (default), `h-9` (sm), `h-11` (lg).
- **Icon size in buttons:** `[&_svg]:size-4`.
- **Gap:** `gap-2` for inline icon + label.

---

## Border Radius

- **Global:** `--radius` (e.g. `1.5rem` in `app/globals.css`).
- **Tailwind:**
  - `rounded-lg` → `var(--radius)`
  - `rounded-md` → `calc(var(--radius) - 2px)`
  - `rounded-sm` → `calc(var(--radius) - 4px)`

Components use `rounded-md` or `rounded-lg` for consistency.

---

## Shadows & Elevation

- **Cards:** `shadow-sm`
- **Popovers / dropdowns:** `shadow-md`
- **Toasts / overlays:** `shadow-lg` (e.g. Sonner)

No custom shadow scale is defined; Tailwind defaults are used.

---

## Motion & Animation

### Custom keyframes (`app/globals.css`)

| Name | Purpose |
|------|--------|
| `fadeIn` / `fadeOut` | Opacity in/out |
| `slideUp` / `slideDown` | Vertical slide (20px) |
| `slideLeft` / `slideRight` | Horizontal slide (20px) |
| `scaleIn` / `scaleOut` | Scale 0.9 ↔ 1 |
| `bounceIn` | Bounce scale-in |
| `shake` | Horizontal shake (4px) |
| `spinSlow` | 360° rotation (2s loop) |

### Utility classes

- `.animate-fadeIn`, `.animate-fadeOut` — 0.3s ease-out
- `.animate-slideUp`, `.animate-slideDown`, `.animate-slideLeft`, `.animate-slideRight` — 0.3s ease-out
- `.animate-scaleIn`, `.animate-scaleOut` — 0.3s ease-out
- `.animate-bounceIn` — 0.5s cubic-bezier
- `.animate-shake` — 0.5s ease-in-out
- `.animate-spinSlow` — 2s linear infinite

### Tailwind / Radix

- **tailwindcss-animate:** `animate-in`, `animate-out`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*` for popovers, dropdowns, sheets.
- **tw-animate-css:** Imported in `app/globals.css` for enter/exit animations.
- **Spinner:** `animate-spin` (Loader2 icon from Lucide).

### Animation utility library (`lib/animations.ts`)

JavaScript presets for Framer Motion–style animations (use with `motion` from `framer-motion` if added, or as reference for timing):

| Preset | Use |
|--------|-----|
| `fadeIn`, `fadeInUp`, `fadeInDown` | Fade with optional vertical offset |
| `scaleIn`, `scaleUp` | Scale in / hover scale |
| `slideInRight`, `slideInLeft`, `slideUp`, `slideDown` | Full slide (e.g. sheets) |
| `bounce`, `pulse`, `spin`, `shake` | Looping or one-off effects |
| `staggerContainer` / `staggerItem` | Staggered list animations |

**Exports:**

- **`easings`:** `easeInOut`, `easeOut`, `easeIn`, `sharp`, `bounce` (cubic-bezier arrays).
- **`durations`:** `fast` (0.15s), `normal` (0.3s), `slow` (0.5s).
- **`springs`:** `gentle`, `bouncy`, `stiff` (stiffness/damping).
- **`animationClasses`:** Tailwind-compatible class strings (e.g. `animate-[fadeIn_0.2s_ease-out]`) for use without Framer Motion.

---

## Components

All components live under `@/components/ui`, use `cn()` for class merging, and follow the same token and radius conventions.

### Component list (55+)

| Category | Components |
|----------|------------|
| **Layout** | `card`, `separator`, `aspect-ratio`, `resizable`, `scroll-area`, `sidebar` |
| **Overlay** | `dialog`, `sheet`, `drawer` (Vaul), `popover`, `hover-card`, `tooltip`, `alert-dialog` |
| **Forms** | `button`, `button-group`, `input`, `textarea`, `input-group`, `input-otp`, `label`, `checkbox`, `radio-group`, `switch`, `select`, `form`, `field` |
| **Feedback** | `alert`, `toast`, `toaster`, `sonner`, `progress`, `spinner`, `skeleton`, `empty` |
| **Navigation** | `tabs`, `breadcrumb`, `navigation-menu`, `menubar`, `pagination` |
| **Data** | `table`, `chart`, `calendar` |
| **Menus** | `dropdown-menu`, `context-menu`, `command` |
| **Other** | `accordion`, `collapsible`, `toggle`, `toggle-group`, `badge`, `avatar`, `kbd`, `item`, `carousel` |

### Common patterns

- **Focus:** `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- **Disabled:** `disabled:pointer-events-none disabled:opacity-50` (or `disabled:cursor-not-allowed` for inputs)
- **Transitions:** `transition-colors` or `transition-all` on interactive elements

### Button variants (CVA)

- **Variant:** `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
- **Size:** `default` (h-10, px-4), `sm` (h-9, px-3), `lg` (h-11, px-8), `icon` (h-10 w-10)

### Alert variants

- **Variant:** `default`, `destructive`

### Badge variants

- **Variant:** `default`, `secondary`, `destructive`, `outline`

---

## App-Level Layout & Patterns

These patterns come from the current app (dashboard, profile, auth) and can be standardized using design tokens where applicable.

### Layout components

| Component | Path | Purpose |
|-----------|------|--------|
| **DashboardLayout** | `@/components/dashboard-layout.tsx` | Full dashboard shell: collapsible sidebar, top header, notifications, main content. Used by student and employer dashboards. |
| **TopNavbar** | `@/components/top-navbar.tsx` | Sticky header with optional menu button and `NotificationCenter`. |
| **Sidebar** | `@/components/sidebar.tsx` | Design-system demo sidebar (sections: Design System, Dashboard, Wizard, Table, Forms, Charts, Notifications). Uses `cn()`, `animate-fadeIn` for overlay. |
| **Breadcrumbs** | `@/components/breadcrumbs.tsx` | Nav with `ChevronRight` separators; links `text-gray-600 hover:text-[#ff8a08]`, current item `text-[#ff8a08] font-semibold`. |
| **ThemeProvider** | `@/components/theme-provider.tsx` | Wraps app with `next-themes` for dark mode persistence. |

### Dashboard layout patterns

- **Container:** `flex h-screen`, main content `flex-1 overflow-y-auto`.
- **Sidebar:** `lg:w-64` / `lg:w-20` (collapsed), `border-r border-gray-200`, `shadow-lg`, mobile overlay `bg-black bg-opacity-50` or `bg-black/50`.
- **Header:** `bg-white border-b border-gray-200 shadow-sm`, padding `px-6 py-4`.
- **Page content:** Wrapper `p-6 space-y-6`; sections use `space-y-6` or `gap-6`.

### Primary gradient (optional pattern)

Used for hero banners, avatar backgrounds, and notification panel headers:

- **Classes:** `bg-gradient-to-r from-[#ff8a08] to-[#ff6b08]` (or `from-[#ff8a08] to-[#ff6b08]`).
- **Text on gradient:** `text-white`, secondary `text-orange-100` or `text-orange-50`.
- Prefer semantic tokens where possible (e.g. `bg-primary`); use hex when a distinct gradient stop is required.

### Dashboard page patterns

- **Welcome hero:** Full-width gradient card, `rounded-2xl p-8`, `text-3xl font-bold` title, supporting text `text-lg text-orange-100`.
- **Stat cards:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`, each card `bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow`; icon in colored box (e.g. `p-3 bg-blue-100 rounded-lg`), value `text-2xl font-bold text-gray-900`, label `text-sm font-medium text-gray-600`, caption `text-xs text-gray-500`.
- **Section cards:** White card `rounded-xl border border-gray-200 shadow-sm`, header `px-6 py-4 border-b border-gray-200` with `text-lg font-bold`, list `divide-y divide-gray-100`, rows `p-6 hover:bg-gray-50 transition-colors`.
- **Primary CTAs:** `bg-[#ff8a08] text-white` with `hover:bg-[#e67a07]`; secondary `bg-gray-100 text-gray-700 hover:bg-gray-200`.
- **Links:** Primary link `text-[#ff8a08] hover:text-[#e67a07]` or `hover:underline`.
- **Status badges:** Semantic backgrounds, e.g. `bg-blue-100 text-blue-700 border-blue-200`, `bg-green-100 text-green-700`, `bg-purple-100 text-purple-700`, `bg-red-100 text-red-700`; pill shape `rounded-full text-xs font-medium border`.
- **Profile avatar:** Gradient circle `bg-gradient-to-br from-[#ff8a08] to-[#ff6b08]`, initials or icon in white.

### Auth & standalone form patterns (Login, Register, Contact Us)

Used on `app/login/page.tsx`, `app/register/page.tsx`, and the home page Contact Us section. Apply these for visual consistency whenever adding a similar standalone form.

**Form container**

- **Width:** `max-w-md` for the form block; center in section with `flex flex-col items-center` or equivalent.
- **Form header strip:** `bg-[#ff8a08] text-white text-center py-4 rounded-t-3xl` with title `text-2xl font-bold font-sans` (e.g. "Login", "Register", "Contact Us").
- **Form body:** `bg-white border-2 border-gray-100 rounded-b-3xl shadow-xl p-8` (directly under the header strip, no gap).

**Labels**

- **Class:** `block text-sm font-medium text-gray-600 mb-2 font-sans`.
- Optional required marker in label text (e.g. "Email *").

**Inputs with left icon**

- **Wrapper:** `relative` on the parent `div`.
- **Icon:** `absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400` (Lucide icons: `User`, `Mail`, `Lock`, `Phone`, `FileText`, `MessageSquare`, etc.).
- **Standard input:** `w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-full focus:outline-none focus:border-[#222831] transition-all font-sans text-[#151b22]`.
- **Highlighted input** (e.g. email/password on login): same as above but `bg-blue-50 border-2 border-transparent` instead of `border-gray-300`.
- **Focus:** `focus:border-[#222831]` (Charleston) for all.

**Textarea with left icon**

- Same border and focus as inputs; use `rounded-2xl` (not `rounded-full`). Icon: `absolute left-4 top-4 w-5 h-5 text-gray-400` so it aligns with the first line. `pl-12 pr-4 py-3`, `min-h-24 resize-y`, `font-sans text-[#151b22]`.

**Submit button**

- **Class:** `w-full bg-[#ff8a08] text-white py-3 rounded-full font-semibold font-sans hover:bg-[#e67a07] transition-all hover:scale-[1.02] shadow-lg`.
- Use uppercase label for primary action (e.g. "REGISTER", "LET'S GO", "SEND MESSAGE").

**Form spacing**

- **Between fields:** `space-y-5` (register, contact) or `space-y-6` (login).
- **Optional helper links:** e.g. "Already have an account? Login" / "Forgot Password?" with `text-blue-600 text-sm font-medium font-sans hover:underline`.

### Loading states

- Route-level loading: `app/dashboard/**/loading.tsx` (currently returns `null`). Can be extended with `Skeleton` or spinner for consistent loading UX.

---

## Utilities & Conventions

### `cn()` utility

```ts
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Use `cn()` for all conditional or overridable class names so Tailwind classes merge correctly.

### Path aliases (`components.json`)

- `@/components` — components
- `@/components/ui` — UI primitives
- `@/lib` — lib (e.g. `utils`)
- `@/hooks` — hooks

### Icons

Use **Lucide React** from `lucide-react` (e.g. `Loader2Icon` in Spinner). Prefer consistent size: `size-4` for inline with text, or as specified by the component.

---

## Implementation Notes

1. **CSS variables:** Hex tokens on `:root` and `.dark` in `app/globals.css` drive body and custom styles; the `@theme` block there provides HSL and radius so Tailwind 4 classes like `bg-primary` and `text-foreground` work. The app’ uses `app/globals.css` as the single source of truth; do not mix in `styles/globals.css` unless switching the app to that theme.
2. **Tailwind 4:** There is no `tailwind.config.ts`; theme is in the `@theme` block in `app/globals.css`. PostCSS uses `@tailwindcss/postcss`.
3. **Dark mode:** Toggle by adding/removing the `dark` class on `<html>`. Use the app's `ThemeProvider` (next-themes) for persistence and system preference.
4. **New components:** Prefer CVA for variants, Radix for behavior where applicable, and semantic color/radius tokens so components stay consistent with the rest of the system.
5. **Animations:** Use the keyframes and utility classes from `app/globals.css` for CSS-only animations; use `tw-animate-css` / `tailwindcss-animate` for enter/exit on overlays and dropdowns. For JS-driven animation, use or extend `lib/animations.ts`.
6. **App layouts:** Use `DashboardLayout` for dashboard routes; use `Breadcrumbs` for page hierarchy. Prefer design tokens (e.g. `bg-primary`) over hardcoded hex in new code where the token already exists.

---

*This design system document is generated from the Jobox component library codebase. Keep it updated as tokens, components, or conventions change.*
