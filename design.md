# EgSA AI Engineering Platform --- UI Conventions & Branding

> **Purpose:** This document defines the visual language, branding
> rules, UI conventions, layout patterns, typography, colors, imagery,
> components, and interaction style for the EgSA AI Engineering
> Platform.
>
> This is a **design-system document**, not a feature specification. New
> screens should follow these rules so the platform looks like one
> coherent product.

------------------------------------------------------------------------

# 1. Brand Identity

## Product Name

**EgSA AI Engineering Platform**

Use this exact product name in the main application header.

Short references may use:

-   EgSA AI
-   EgSA AI Platform

Avoid generic names such as:

-   AI Dashboard
-   Engineering AI
-   Space AI

unless used as descriptive text.

## Organization

**Egyptian Space Agency**

Use the Egyptian Space Agency identity as the parent brand.

The platform should visually communicate:

**Egyptian Space Agency + Space Engineering + Enterprise AI + Secure
Knowledge**

------------------------------------------------------------------------

# 2. Overall Visual Direction

The reference design establishes a:

-   Professional enterprise appearance
-   Modern engineering/software aesthetic
-   Clean aerospace identity
-   Light interface
-   White content surfaces
-   Dark navy typography
-   Strong blue primary actions
-   Subtle gradients
-   Rounded cards
-   Soft shadows
-   Generous whitespace
-   High information density without visual clutter

The interface should feel like an **internal mission/engineering
platform**, not a consumer social application.

### Design keywords

``` text
Professional
Engineering
Aerospace
Modern
Reliable
Clean
Technical
Trustworthy
Controlled
Premium
```

------------------------------------------------------------------------

# 3. Color System

Use a restrained color palette.

## Primary Navy

Used for:

-   Main headings
-   Product title
-   Important labels
-   Navigation text
-   Strong information hierarchy

``` text
Primary Navy
#0B1F5B
```

A slightly brighter navy may be used for emphasis:

``` text
Deep Blue
#102A72
```

## Primary Blue

Used for:

-   Active navigation
-   Primary buttons
-   Links
-   Selected states
-   Icons
-   Progress indicators

``` text
EgSA Blue
#1769E0
```

Optional lighter blue:

``` text
Light Blue
#EAF3FF
```

## Background

Main application background:

``` text
#F7F9FC
```

Primary surfaces:

``` text
#FFFFFF
```

Secondary surfaces:

``` text
#F3F6FA
```

The application should generally use **white cards on a very light
gray/blue background**.

------------------------------------------------------------------------

# 4. Semantic Colors

These colors communicate system state.

## Success

``` text
Green
#16A36A
```

Use for:

-   Active
-   Approved
-   Healthy
-   Online
-   Completed
-   Successful

## Warning

``` text
Amber
#E6A23C
```

Use for:

-   Pending
-   Review
-   Warning
-   Draft requiring attention

## Error

``` text
Red
#E5484D
```

Use for:

-   Failed
-   Error
-   Inactive
-   Destructive actions

## AI / Accent Purple

``` text
Purple
#7657E8
```

Use sparingly for:

-   AI-specific actions
-   Model features
-   AI configuration
-   AI-related badges

Purple should complement the EgSA blue rather than become the primary
brand color.

------------------------------------------------------------------------

# 5. Color Usage Rule

Do not make the interface colorful everywhere.

Recommended visual hierarchy:

``` text
Navy       → Identity / headings
Blue       → Interaction
Green      → Positive state
Amber      → Attention
Red        → Problems / destructive
Purple     → AI
Gray       → Neutral information
```

Most of the interface should remain:

``` text
White + Light Gray + Navy + Blue
```

------------------------------------------------------------------------

# 6. Logo & Egyptian Space Agency Branding

The Egyptian Space Agency logo should be treated as a **brand asset**,
not as a generic icon.

## Sidebar

Place the EgSA logo at the top-left.

Recommended structure:

``` text
┌──────────────────────┐
│     EgSA Logo        │
│ Egyptian Space       │
│ Agency               │
├──────────────────────┤
│ Dashboard            │
│ AI Chat              │
│ Documents            │
│ ...                  │
└──────────────────────┘
```

Maintain sufficient whitespace around the logo.

Do not:

-   Stretch the logo
-   Change its proportions
-   Apply arbitrary filters
-   Place it on visually noisy backgrounds
-   Use excessive decorative effects

------------------------------------------------------------------------

# 7. Tagline / Brand Messaging

The reference screens use:

> **Space for a Brighter Egypt**

This can be used in the sidebar footer.

Recommended layout:

``` text
Space
for a Brighter
Egypt
────────
PEOPLE | KNOWLEDGE | IMPACT
```

The tagline should remain subtle.

It should support the interface rather than compete with application
content.

------------------------------------------------------------------------

# 8. Hero Imagery

The reference screens use a consistent aerospace hero image.

The preferred visual is:

-   Earth viewed from space
-   Egypt / Nile region visible when possible
-   Satellite in orbit
-   Dark space background
-   Blue/white atmospheric tones
-   High-quality realistic photography/rendering

Use this imagery primarily in:

-   Dashboard hero
-   Major section headers
-   Engineering Library
-   Knowledge/AI sections
-   Administration overview

Do not use a different unrelated hero image on every page.

------------------------------------------------------------------------

# 9. Hero Banner Style

Reference pattern:

``` text
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Page Title                              Satellite       │
│  Short description                         🌍            │
│                                                          │
│  EGYPTIAN SPACE AGENCY                                  │
└──────────────────────────────────────────────────────────┘
```

Recommended characteristics:

-   Large horizontal banner
-   Rounded corners
-   Image aligned to the right
-   Text aligned to the left
-   Dark blue/white text depending on background
-   Subtle overlay if necessary
-   No excessive decoration

## Page Title

Use:

``` text
32–40px
Bold / Semibold
Dark Navy
```

## Subtitle

Use:

``` text
14–18px
Regular
Muted Navy/Gray
```

------------------------------------------------------------------------

# 10. Dashboard Hero

The dashboard hero can be more prominent than internal pages.

Reference style:

``` text
Welcome, Eng. Ahmed

Turn engineering knowledge into real progress.

Ask. Search. Build. For a stronger space future.

EGYPTIAN SPACE AGENCY
```

Use a large satellite/Earth image behind or beside the content.

The hero should have a premium aerospace feel without becoming visually
heavy.

------------------------------------------------------------------------

# 11. Layout System

Use a persistent application shell.

``` text
┌──────────────┬─────────────────────────────────────────┐
│              │ Header                                  │
│              ├─────────────────────────────────────────┤
│   Sidebar    │                                         │
│              │ Main Content                             │
│              │                                         │
│              │                                         │
└──────────────┴─────────────────────────────────────────┘
```

## Sidebar Width

Desktop:

``` text
220–250px
```

The reference design uses a relatively narrow sidebar with generous
whitespace.

## Content

Main content should have:

``` text
24–32px
```

horizontal and vertical spacing from the shell.

------------------------------------------------------------------------

# 12. Grid System

Use a responsive grid.

Typical dashboard layout:

``` text
┌──────────────┬──────────────┬──────────────┐
│ Card         │ Card         │ Card         │
└──────────────┴──────────────┴──────────────┘

┌──────────────────────────────┬──────────────┐
│ Main content                 │ Side panel   │
└──────────────────────────────┴──────────────┘
```

Use consistent gaps:

``` text
16px
24px
32px
```

Avoid tightly packed cards.

------------------------------------------------------------------------

# 13. Cards

Cards are one of the primary visual patterns.

## Card Style

``` text
Background: #FFFFFF
Border: 1px solid #E7ECF3
Radius: 12–16px
Shadow: subtle
Padding: 20–24px
```

Cards should have very soft shadows.

Avoid:

-   Heavy black shadows
-   Excessive borders
-   Strong gradients
-   Excessive corner rounding

------------------------------------------------------------------------

# 14. Stat Cards

Reference pattern:

``` text
┌──────────────────────────────┐
│  ◉                           │
│                              │
│  Active Users                │
│  42                  ↑ 12%   │
│  of 60 provisioned           │
└──────────────────────────────┘
```

Structure:

1.  Icon
2.  Label
3.  Large number
4.  Optional trend
5.  Supporting text

Number:

``` text
26–32px
Bold
```

Label:

``` text
14–16px
Semibold
```

------------------------------------------------------------------------

# 15. Buttons

## Primary Button

Blue background:

``` text
#1769E0
```

White text.

Example:

``` text
[ + New Chat ]
[ Upload Document ]
[ Save Changes ]
```

Radius:

``` text
8–10px
```

## Secondary Button

White background with subtle border.

``` text
[ Cancel ]
[ View Details ]
```

## AI Button

Can use a subtle purple accent:

``` text
[ ✦ Ask AI ]
```

Do not make every AI action purple.

------------------------------------------------------------------------

# 16. Inputs

Inputs should be clean and compact.

``` text
┌──────────────────────────────────────┐
│ 🔍  Search documents...              │
└──────────────────────────────────────┘
```

Recommended:

``` text
Height: 40–44px
Radius: 8–10px
Border: #DCE3EC
Background: #FFFFFF
```

Focused state:

``` text
Border: EgSA Blue
Subtle blue focus ring
```

------------------------------------------------------------------------

# 17. Search Bars

Search is a prominent platform feature.

The global search should look like the reference:

``` text
┌───────────────────────────────────────────────┐
│ 🔍  Search documents, projects, or ask...   ⌘K│
└───────────────────────────────────────────────┘
```

Keep keyboard shortcut hints subtle.

Example:

``` text
Ctrl + K
```

------------------------------------------------------------------------

# 18. Sidebar Navigation

Navigation should be visually simple.

Example:

``` text
⌂  Dashboard

◉  AI Chat

▣  Documents

▱  Projects
```

Active item:

``` text
Light blue background
Blue icon
Blue text
Rounded rectangle
```

Example:

``` text
┌─────────────────────────┐
│  ◉  AI Chat             │
└─────────────────────────┘
```

Inactive items:

-   Dark navy/gray text
-   Neutral icon
-   Transparent background

------------------------------------------------------------------------

# 19. Icons

Use one consistent icon family.

Recommended:

-   Lucide
-   Phosphor
-   Material Symbols

Do not mix multiple icon styles.

Icons should generally be:

``` text
16px
20px
24px
```

Use larger icons for dashboard feature cards.

Avoid decorative icons that do not communicate meaning.

------------------------------------------------------------------------

# 20. Typography

The reference design uses a modern, highly readable sans-serif.

Recommended primary font:

**Inter**

Alternative:

**IBM Plex Sans**

Typography hierarchy:

``` text
Page title:       32–40px / 700
Section title:    20–24px / 600
Card title:       16–18px / 600
Body:             14–16px / 400
Metadata:         12–14px / 400
Labels:           12–14px / 500
```

Headings should use dark navy.

Body text should use a darker neutral gray.

------------------------------------------------------------------------

# 21. Tables

Tables should look like enterprise engineering tables.

Example:

``` text
┌────┬──────────────┬──────────────┬───────────┐
│ □  │ Document     │ Project      │ Status    │
├────┼──────────────┼──────────────┼───────────┤
│ □  │ EPS-SRS-001  │ NEXSAT-1     │ Approved  │
│ □  │ EPS-TRS-001  │ NEXSAT-1     │ Draft     │
└────┴──────────────┴──────────────┴───────────┘
```

Rules:

-   Light separators
-   Compact rows
-   Clear column headers
-   Status badges
-   Hover state
-   Selected row state
-   Pagination at bottom

Avoid dark table headers.

------------------------------------------------------------------------

# 22. Status Badges

Use pill-shaped badges.

Examples:

``` text
● Active
● Approved
● In Development
● Pending Review
● Draft
● Inactive
```

Recommended:

``` text
Radius: 999px
Padding: 4px 10px
Font: 12–13px
```

Use a very light semantic background with darker text.

Example:

``` text
Green background → Green text
Amber background → Amber text
Red background   → Red text
Blue background  → Blue text
```

------------------------------------------------------------------------

# 23. Avatars

Use circular avatars.

Reference style:

``` text
(AA)
(MH)
(SS)
```

For users without profile images:

-   Generate initials
-   Use neutral/brand-tinted background
-   Keep text readable

The avatar should be small and professional.

------------------------------------------------------------------------

# 24. Chat UI Visual Style

The chat interface should be more spacious than normal dashboard
screens.

Use:

``` text
Conversation sidebar
        +
Main chat area
```

The chat should resemble a professional AI workspace rather than a
messaging/social application.

## User Message

Use a subtle blue-tinted or neutral message surface.

## AI Message

Use a clean white/neutral surface.

Avoid huge chat bubbles.

------------------------------------------------------------------------

# 25. AI Branding

AI features should use a recognizable visual language.

Possible AI icon:

``` text
✦
```

or a consistent AI/brain/spark icon.

Use:

-   Blue
-   Purple accents
-   Small sparkle motifs

Avoid:

-   Excessive neon
-   Futuristic sci-fi styling
-   Glowing effects
-   Cyberpunk visuals

The AI should feel **engineering-grade and trustworthy**.

------------------------------------------------------------------------

# 26. Document UI

Documents should visually resemble an engineering document management
system.

Use:

-   File-type icons
-   Document IDs
-   Revision badges
-   Status badges
-   Project tags
-   Updated date
-   Author

Example:

``` text
PDF  EPS-SRS-001
     Spacecraft Requirements Specification

     NEXSAT-1    Rev. C    ● Approved
```

File types:

``` text
PDF → red
DOC/DOCX → blue
XLS/XLSX → green
TXT → gray
```

These colors are semantic file-type indicators and should not dominate
the page.

------------------------------------------------------------------------

# 27. Project Cards

Project cards should use aerospace imagery.

Example:

``` text
┌────────────────────────────────────┐
│                                    │
│       Satellite image              │
│                                    │
├────────────────────────────────────┤
│ NEXSAT-1                           │
│ Electrical Power System            │
│                                    │
│ ● In Development                   │
│                                    │
│ 24 Docs       6 Members       →    │
└────────────────────────────────────┘
```

Images should be consistent in aspect ratio.

------------------------------------------------------------------------

# 28. Aerospace Imagery Rules

Preferred imagery:

-   Satellites
-   Earth from orbit
-   Egyptian geography from space
-   Spacecraft
-   Engineering hardware
-   Mission operations

Avoid:

-   Generic stock-office photography
-   People in suits posing for corporate imagery
-   Generic AI robots
-   Futuristic holograms
-   Random planets
-   Unrelated technology imagery

The imagery should reinforce the EgSA mission.

------------------------------------------------------------------------

# 29. Background Decorations

The reference uses very subtle space/Earth imagery in empty
sidebar/background areas.

These should remain low contrast.

Example:

``` text
opacity: low
contrast: low
```

The background must never compete with navigation or content.

------------------------------------------------------------------------

# 30. Breadcrumbs

Use breadcrumbs on deep pages.

Example:

``` text
NEXSAT-1  >  Project Knowledge  >  EPS
```

Style:

-   Small
-   Gray/blue
-   Simple separators

The current page should have stronger emphasis.

------------------------------------------------------------------------

# 31. Page Headers

Every major page should follow:

``` text
Breadcrumb (optional)

Page Title
Short descriptive subtitle

──────────────────────────────

Main content
```

Example:

``` text
Engineering Library

Access engineering documents, standards, and knowledge
across EgSA's space projects.
```

This is one of the strongest recurring patterns in the reference
screens.

------------------------------------------------------------------------

# 32. Tabs

Use tabs for related content.

Example:

``` text
[ Overview ] [ Documents ] [ Members ] [ Activity ]
```

Active tab:

-   Blue text
-   Blue underline or blue top/bottom indicator

Inactive:

-   Neutral gray/navy

Avoid heavy tab containers.

------------------------------------------------------------------------

# 33. Drawers & Detail Panels

For administration and document management, use right-side detail panels
where appropriate.

Example:

``` text
┌─────────────────────────────┬──────────────────────────┐
│ Users                       │ Mohamed Hany          ×  │
│                             │                          │
│ Mohamed Hany                │ Role: Platform Admin    │
│ Hussein Saleh               │                          │
│ Sara Mohamed                │ Permissions              │
│ ...                         │ Projects                 │
│                             │ Activity                 │
└─────────────────────────────┴──────────────────────────┘
```

This matches the reference application's enterprise feel.

------------------------------------------------------------------------

# 34. Modals

Use modals for focused actions:

-   Delete confirmation
-   Add user
-   Create project
-   Change permissions
-   Upload document
-   Configure AI model

Do not put entire pages inside modals.

------------------------------------------------------------------------

# 35. Shadows

Use shadows sparingly.

Recommended:

``` text
Very subtle
0 2px 10px rgba(...)
```

Cards should mostly be distinguished through:

-   White surface
-   Border
-   Spacing

rather than heavy shadows.

------------------------------------------------------------------------

# 36. Borders

Use light blue-gray borders:

``` text
#E5EAF1
```

Borders should be visible enough to separate content but not dominate.

Avoid pure black borders.

------------------------------------------------------------------------

# 37. Corner Radius

Standard system:

``` text
Small controls:    8px
Cards:             12–16px
Hero banners:      16px
Pills/badges:      999px
Avatars:           50%
```

Keep radius values consistent across the application.

------------------------------------------------------------------------

# 38. Motion

Animations should be subtle.

Use transitions for:

-   Hover
-   Sidebar selection
-   Dropdowns
-   Modals
-   Loading
-   Chat streaming

Recommended duration:

``` text
150–250ms
```

Avoid:

-   Large page animations
-   Constant floating elements
-   Excessive parallax
-   Decorative motion

The product should feel stable and reliable.

------------------------------------------------------------------------

# 39. Hover States

Interactive elements should have obvious but subtle feedback.

Buttons:

``` text
Normal → slightly darker
```

Cards:

``` text
Normal → subtle elevation/border change
```

Navigation:

``` text
Normal → light blue background
```

Table row:

``` text
Normal → very light blue/gray background
```

------------------------------------------------------------------------

# 40. Accessibility

The visual system should maintain accessible contrast.

Rules:

-   Do not use color as the only status indicator
-   Provide readable text beside icons
-   Make focus states visible
-   Use sufficiently large click targets
-   Keep body text readable
-   Support keyboard navigation
-   Provide labels for icon-only controls

------------------------------------------------------------------------

# 41. Responsive Design

Desktop is the primary target.

### Desktop

``` text
Sidebar + Header + Multi-column content
```

### Tablet

``` text
Collapsed sidebar + Main content
```

### Mobile

``` text
Top header
Collapsible navigation
Single-column content
```

Do not simply shrink desktop layouts.

Cards, tables, and panels should reflow appropriately.

------------------------------------------------------------------------

# 42. Do / Don't

## Do

-   Use navy + blue as the primary visual language
-   Use white cards
-   Use subtle aerospace imagery
-   Maintain generous whitespace
-   Use consistent icons
-   Use rounded cards
-   Use semantic status colors
-   Keep AI styling subtle
-   Use clear enterprise tables
-   Keep layouts structured

## Don't

-   Use excessive gradients
-   Use neon colors
-   Use glassmorphism everywhere
-   Use dark cyberpunk themes
-   Use random AI/robot imagery
-   Use giant rounded bubbles
-   Mix icon styles
-   Overuse purple
-   Add decorative elements without purpose
-   Make every page visually different

------------------------------------------------------------------------

# 43. Design Tokens

A basic token foundation:

``` css
:root {
  --color-primary: #1769E0;
  --color-primary-dark: #102A72;
  --color-navy: #0B1F5B;

  --color-background: #F7F9FC;
  --color-surface: #FFFFFF;
  --color-surface-muted: #F3F6FA;

  --color-border: #E5EAF1;

  --color-success: #16A36A;
  --color-warning: #E6A23C;
  --color-danger: #E5484D;
  --color-ai: #7657E8;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-pill: 999px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
}
```

The implementation may convert these into the chosen UI framework's
theme system.

------------------------------------------------------------------------

# 44. Reference Screen Consistency

All new screens should visually belong to the same family as the
supplied reference screens.

A new page should generally contain:

``` text
EgSA Branding
       ↓
Application Header
       ↓
Sidebar Navigation
       ↓
Page Header / Hero
       ↓
Cards / Tables / Panels
       ↓
Consistent Status + Actions
```

The exact content can change, but the visual grammar should remain
consistent.

------------------------------------------------------------------------

# 45. Core Design Principle

The platform should look like:

> **An Egyptian aerospace engineering organization that built a modern
> AI platform.**

It should **not** look like:

> A generic AI chatbot that happens to have an Egyptian Space Agency
> logo.

The EgSA identity, engineering context, structured enterprise layouts,
satellite/Earth imagery, and restrained AI visual language should remain
visible throughout the product.
