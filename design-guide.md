# Handoff: CoWork Redesign

> **For Claude Code / Cursor with claude-opus-4-5**  
> Implement this redesign in the Next.js app at `github.com/Risav03/hoet-assignment`

---

## Overview

This is a full visual redesign of the **CoWork** collaborative workspace platform — a Next.js 15 app using Prisma, Auth.js, Tailwind CSS, and shadcn/ui. All 11 pages/views have been redesigned with a modern, minimal aesthetic: clean typography, a light sidebar, consistent left-aligned layouts, and subtle entrance animations.

---

## About the Design Files

`CoWork Redesign.html` is a **high-fidelity interactive prototype** built in plain HTML + React (Babel). It is a design reference — **do not ship it as-is**. Your task is to recreate these designs inside the existing Next.js codebase using its established patterns:

- Tailwind CSS utility classes (already configured)
- shadcn/ui components (`components/ui/`)
- Next.js App Router pages (`app/`)
- Existing auth, data-fetching, and API layers — leave those completely untouched

Open the HTML file in a browser and use the **black top bar** to navigate between all pages. The **Tweaks panel** (bottom-right, toggled by the toolbar button in the prototype) exposes accent color and sidebar style options — use the dark sidebar + indigo accent as the default.

---

## Fidelity

**High-fidelity.** Recreate pixel-precisely:
- Exact colors (hex values listed below)
- Exact font: **Plus Jakarta Sans** (Google Fonts) at the weights and sizes listed below
- Exact spacing, border-radius, and shadow values
- All hover states, transitions, and entrance animations
- All interactive states shown in the prototype

---

## Design Tokens

### Font
```
Family:  Plus Jakarta Sans (import from Google Fonts)
Weights: 400, 500, 600, 700, 800
```
Add to `app/layout.tsx`:
```tsx
import { Plus_Jakarta_Sans } from 'next/font/google'
const font = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400','500','600','700','800'] })
```

### Colors
```
Background canvas:   #f4f4f5   (zinc-100)
Card / surface:      #ffffff
Sidebar bg (dark):   #18181b   (zinc-900)
Sidebar border:      #27272a   (zinc-800)
Border default:      #e4e4e7   (zinc-200)
Border subtle:       #f4f4f5   (zinc-100)

Text primary:        #18181b   (zinc-900)
Text secondary:      #3f3f46   (zinc-700)
Text muted:          #71717a   (zinc-500)
Text faint:          #a1a1aa   (zinc-400)

Accent (indigo):     #4f46e5
Accent hover:        #4338ca
Accent light bg:     #eef2ff
Accent light text:   #4338ca

Emerald:             #059669  / bg #ecfdf5 / text #065f46
Amber:               #d97706  / bg #fffbeb / text #92400e
Rose:                #e11d48  / bg #fff1f2 / text #9f1239
Sky:                 #0ea5e9  / bg #f0f9ff
Violet:              #7c3aed  / bg #f5f3ff

Online dot:          #22c55e  (green-500), ring rgba(34,197,94,.25)
```

### Spacing (used as padding on page containers)
```
Page padding:        36px top/bottom, 40px left/right  (p-9 px-10 approx)
Card padding:        20px–28px
Section gap:         14px (card grids), 12px (lists)
```

### Border Radius
```
Cards:       12px  (rounded-xl)
Buttons:      8px  (rounded-lg)
Inputs:       8px
Badges:      99px  (rounded-full)
Icon boxes:  8–10px
Avatars:     50%
```

### Shadows
```
Card default:   0 1px 3px rgba(0,0,0,.04)
Card hover:     0 4px 16px rgba(79,70,229,.08)
Button primary: 0 1px 2px rgba(79,70,229,.25)
```

### Transitions
```
All interactive elements: transition: all 150ms ease
Active border-left on sidebar nav: 2.5px solid accent
```

---

## Animations

Add these keyframes to `app/globals.css`:

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

**Usage:**
- Every page wrapper: `animation: fadeUp 220ms cubic-bezier(.22,1,.36,1) both`
- Card/list items: staggered `fadeUp` with `animation-delay: n * 30ms` (up to 8 items)
- Activity timeline rows: staggered `slideInLeft` with `animation-delay: n * 40ms`

---

## Screens / Views

### 1. Landing Page (`app/page.tsx`)

**Layout:** Full-width, single column, dark background.

**Header (sticky, 60px tall):**
- Left: Logo mark (28×28px, border-radius 8px, accent bg, white "C" text 800 weight) + "CoWork" text (15px, 700)
- Right: Ghost "Sign in" button + Primary "Get started" button
- Border-bottom: 1px solid `#27272a`
- Background: `#09090b`

**Hero (centered, max-width 760px, padding 96px top 80px bottom):**
- Pill badge: bg `#1e1b4b`, text `#818cf8`, border `#312e81` — "⚡ Local-first · Offline-capable · Real-time"
- H1: 60px, 800 weight, line-height 1.1, letter-spacing -2px — "Collaborate without / **compromising**" (accent color on second word)
- Body: 17px, line-height 1.7, color `#71717a`, max-width 520px
- Two buttons: Primary "Start for free →" (lg size) + Secondary "Sign in"

**Feature grid (max-width 960px, 3 columns, gap 16px):**
- Each card: bg `#18181b`, border `#27272a`, border-radius 14px, padding 24px
- Icon box: 36×36px, border-radius 10px, bg `#1e1b4b`, icon color `#818cf8`, size 17px
- Title: 14px, 700
- Body: 13px, color `#71717a`, line-height 1.65

**Footer:** border-top `#27272a`, flex space-between, 12px text, color `#71717a`

---

### 2. Login & Signup (`app/(auth)/login/page.tsx`, `signup/page.tsx`)

**Layout:** Full-screen centered, bg `#fafafa`.

**Logo block (centered, mb 32px):**
- Logo mark: 40×40px, border-radius 12px, accent bg
- Title: 22px, 800
- Subtitle: 13px, muted

**Form card (max-width 380px, padding 28px):**
- White bg, border `#e4e4e7`, border-radius 12px, shadow `0 1px 3px rgba(0,0,0,.04)`
- Inputs: border `1.5px solid #e4e4e7`, focus border accent + `box-shadow: 0 0 0 3px rgba(79,70,229,.1)`, border-radius 8px, padding 9px 12px, 13px 500 weight
- Labels: 12px, 600, color `#3f3f46`
- Submit button: full width, lg size, mt 20px
- Footer link: 12px, muted text + accent colored link

---

### 3. Sidebar (`components/layout/sidebar.tsx`)

**Width:** 220px, fixed height, flex column

**Dark variant (default):**
- bg `#18181b`, border-right `1px solid #27272a`

**Logo strip (border-bottom):** padding 16px, logo mark + "CoWork" 14px 700 + online dot (right)

**Workspace switcher:** border `#27272a`, bg `#27272a`, border-radius 8px — building icon + workspace name 12px 600 + chevron

**Nav items:**
- Padding: 7px 10px, border-radius 8px
- Active: bg `#27272a`, text white, `border-left: 2.5px solid accent`, icon in accent color
- Inactive: text `#a1a1aa`, hover bg `#27272a` text `#d4d4d8`
- Section label: 10px, 700, uppercase, letter-spacing .08em, color `#71717a`

**User footer (border-top):** Avatar 28px + name 12px 600 + email 11px + chevron

---

### 4. Dashboard (`app/(dashboard)/dashboard/page.tsx`)

**Layout:** `padding: 36px 40px`, flush left (NO max-width centering).

**Page header:** H1 22px 800 "Welcome back, {name}" + subtitle muted + "New workspace" primary button (right)

**Workspace grid:** 3 columns, gap 14px, stagger animation

**Workspace card (hover state: border `#c7d2fe`, shadow `0 4px 16px rgba(79,70,229,.08)`):**
- Top row: Icon box (38×38px, bg `#eef2ff`, initial letter in accent, 800) + Role badge (right)
- Name: 14px, 700
- Slug: 11px, `#a1a1aa`
- Footer row: users count + docs count + time (icons at 12px)

**"New workspace" empty card:** `border: 1.5px dashed #e4e4e7`, bg `#fafafa`, centered plus icon

**Role badge colors:**
- OWNER → indigo (`#eef2ff` / `#4338ca`)
- EDITOR → emerald (`#ecfdf5` / `#065f46`)
- VIEWER → zinc (`#f4f4f5` / `#52525b`)

---

### 5. Documents (`app/(dashboard)/workspaces/[slug]/documents/page.tsx`)

**Layout:** `padding: 36px 40px`, flush left, NO max-width.

**Toolbar:** Search input (max-width 260px, left icon) + Active/Archived segmented control (bg `#f4f4f5`, active pill white with shadow)

**Document grid:** 3 columns, gap 14px, stagger animation

**Document card:**
- Icon box: 32×32px, bg `#eef2ff`, file icon in accent
- Title: 13px, 700
- Tags: Badge pills, zinc color
- Footer: clock icon + time + "N versions" right-aligned, 11px `#a1a1aa`

---

### 6. Document Editor (`app/(dashboard)/workspaces/[slug]/documents/[docId]/page.tsx`)

**Layout:** Full height flex column (sidebar + editor side by side, NO scroll on outer)

**Top bar (52px, white, border-bottom):**
- Breadcrumb: "← Documents / Document Title"
- Center: Edit / Preview / History segmented tabs
- Right: Draft badge (amber) + "Propose" primary button (sm)

**Editor area (flex row, overflow hidden):**
- Main (flex 1, padding 40px 60px, white bg, overflow-y auto):
  - Title: 28px, 800, borderless input
  - Body: 14px textarea, line-height 1.75, color `#3f3f46`
- Right panel (240px, border-left, bg `#fafafa`, padding 20px):
  - "Details" section: label/value pairs 12px
  - "Tags" section: badge pills
  - "AI Tools" section: 4 buttons (Summarize / Action items / Rewrite / Explain) — white bg, border `#e4e4e7`, border-radius 7px, 12px 600, sparkle icon `#818cf8`

---

### 7. Proposals (`app/(dashboard)/workspaces/[slug]/proposals/page.tsx`)

**Layout:** `padding: 36px 40px`, flush left.

**Status tabs:** Pending / Committed / Rejected — segmented control (bg `#f4f4f5`, active white pill)

**Proposal card (stagger animation):**
- Icon box: 36×36px, bg `#eef2ff`, git-branch icon in accent
- Title: 14px, 700
- Meta row: avatar (18px) + author + · + doc name (file icon) + · + time, 12px muted
- Vote bar: 5px tall, green fill left (approved %) + rose fill (rejected %), label row above with counts
- Action buttons: "Approve" (emerald primary sm) + "Reject" (secondary sm)

---

### 8. Members (`app/(dashboard)/workspaces/[slug]/members/page.tsx`)

**Layout:** `padding: 36px 40px`, flush left.

**Member list (Card wrapper, stagger animation):**
- Row: Avatar 36px + name/email stack (flex 1) + "Joined X ago" text + role badge + more button (non-owners)
- Row divider: `1px solid #f4f4f5`
- Row padding: 14px 20px

---

### 9. Activity (`app/(dashboard)/workspaces/[slug]/activity/page.tsx`)

**Layout:** `padding: 36px 40px`, flush left.

**Header:** Icon + title + subtitle + filter chips row (All / Documents / Proposals / Members — pill buttons, "All" active = `#18181b` bg white text)

**Timeline (grouped by date):**
- Date group label: 11px, 700, uppercase, `#a1a1aa` + horizontal rule
- Each event row:
  - Left: 30×30px circle icon (color-coded by action type, see below) on vertical line (`#f0f0f0`, 1px)
  - Right: "{User} {action} {document-link}" — document names are `<a>` links with accent color underline on hover
  - Below text: detail pill (bg `#fafafa`, border `#f0f0f0`, border-radius 7px, 12px muted) showing proposal title or context
  - Time: 11px `#a1a1aa`, right-aligned
  - `slideInLeft` stagger animation

**Action type → icon color mappings:**
```
committed a proposal  → check icon,    #059669, bg #ecfdf5
submitted a proposal  → git icon,      #4f46e5, bg #eef2ff
created a document    → file icon,     #0ea5e9, bg #f0f9ff
updated a document    → edit icon,     #d97706, bg #fffbeb
invited a member      → users icon,    #7c3aed, bg #f5f3ff
accepted a proposal   → check icon,    #059669, bg #ecfdf5
rejected a proposal   → x icon,        #e11d48, bg #fff1f2
restored a version    → history icon,  #71717a, bg #f4f4f5
created workspace     → building icon, #4f46e5, bg #eef2ff
```

**Document links in activity:** clickable, accent color, `border-bottom: 1px solid transparent` → accent on hover.

---

### 10. AI Assistant (`app/(dashboard)/workspaces/[slug]/ai-assistant/page.tsx`)

**Layout:** Full height flex column, bg `#fafafa`.

**Top bar (52px, white, border-bottom):** Sparkle icon box + "AI Assistant" title + workspace badge

**Message list (flex 1, overflow-y auto, padding 28px 40px):**
- Assistant bubble: white bg, border `#e4e4e7`, border-radius `4px 12px 12px 12px`, 13px, line-height 1.65, shadow `0 1px 3px rgba(0,0,0,.06)`
- User bubble: accent bg, white text, border-radius `12px 4px 12px 12px`
- Suggestion chips: `border: 1px solid #e4e4e7`, border-radius 20px, 12px 600, bg white

**Input bar (border-top, white bg, padding 16px 40px):**
- Input: bg `#fafafa`, border `1.5px solid #e4e4e7`, border-radius 10px, flex 1
- Send button: primary icon button

---

### 11. Settings (`app/(dashboard)/workspaces/[slug]/settings/page.tsx`)

**Layout:** `padding: 36px 40px`, `max-width: 660px` (this page is intentionally narrow — form content).

**General card:** Workspace name + slug inputs, "Save changes" button

**Permissions card:** Toggle switches (38×22px pill, accent when on, `#e4e4e7` when off, 16×16px white knob)

**Danger zone card:** `border: 1px solid #fecdd3`, red title, description text, "Delete workspace" danger button (bg `#e11d48`)

---

## Implementation Order

1. Install Plus Jakarta Sans via `next/font/google` in `app/layout.tsx`
2. Add animation keyframes to `app/globals.css`
3. Update `components/layout/sidebar.tsx` (dark variant, left-border active state)
4. Update `app/page.tsx` (landing — dark theme)
5. Update `app/(auth)/login/page.tsx` and `signup/page.tsx`
6. Update `app/(dashboard)/dashboard/page.tsx`
7. Update workspace pages one by one: documents → editor → proposals → members → activity → ai-assistant → settings
8. Add stagger animation utility classes to globals.css

---

## Files in This Bundle

| File | Purpose |
|------|---------|
| `CoWork Redesign.html` | Interactive prototype — open in browser, use top nav to switch pages |
| `README.md` | This document |

---

## Notes for Claude Code

- The existing API routes, auth logic, Prisma queries, and data-fetching (DAL functions) are **correct and should not be modified**
- All shadcn/ui components in `components/ui/` can be restyled via Tailwind — override class names, don't rewrite the component logic
- The sidebar receives `user` and `workspaces` props from `app/(dashboard)/layout.tsx` — keep that data flow intact
- The activity page document links should route to `/workspaces/[slug]/documents/[docId]` using Next.js `<Link>`
- Use `cn()` from `lib/utils` for conditional class merging (already set up)
- Lucide icons are already installed — map icon names from the prototype to their Lucide equivalents
