# Design System Strategy: Sovereign Precision

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Sovereign Ledger."** 

We are not building a consumer "lifestyle" app; we are building a high-stakes financial instrument for the Solana ecosystem. The visual language takes direct inspiration from the Bloomberg Terminal and mid-century brutalist editorial design. It prioritizes information density, absolute legibility, and a sense of institutional permanence. 

The system moves away from the "bubbly" trends of modern SaaS. Instead, it embraces **Precision Brutalism**: a world of flat surfaces, sharp data, and intentional asymmetry. We replace decorative fluff with functional hierarchy, using the "instrument panel" mental model to ensure users feel in total control of their real estate assets.

---

## 2. Color Architecture: Tonal Brutalism
In a system without shadows or gradients, depth is a function of pure color value. We use a "Step-Up" logic for elevation.

### Core Palette
- **Background:** `#0E0F11` (The Foundation). A warm, obsidian base that prevents eye strain during long-form data analysis.
- **Surface 1:** `#16181C` (The Worktop). Used for primary content cards and structural panels.
- **Surface 2:** `#1E2126` (The Focus). Reserved for interactive modals or elements that require immediate attention.
- **Accent Amber:** `#E8A020`. Our "Active State" laser. This is the only color allowed to draw heat. Use it for CTAs and the logo. Never use it for large backgrounds.

### The "No-Line" Rule & Tonal Hierarchy
While the border token (`#2A2D33`) is available, it should be used sparingly for "internal" grid lines. Structural separation should first be attempted via background shifts.
- **Nesting Logic:** A `Surface 1` card sitting on a `Background` provides enough contrast to define a boundary. 
- **The Precision Border:** Use the `#2A2D33` border only when a panel needs to feel "locked" into the UI, mimicking the physical seams of a hardware instrument.
- **Strictly No Gradients:** Color must be flat. Visual interest is generated through the rhythm of the grid, not the "soul" of a color transition.

---

## 3. Typography: The Editorial Scale
Typography is our primary tool for expressing authority. We pair a high-fashion display face with a workhorse mono-space for financial integrity.

### Display & Headlines
- **Font:** Geist Bold (700).
- **Styling:** Tight negative tracking (-2% to -4% letter spacing). 
- **Role:** This is your "Editorial Voice." Headlines should feel compressed and heavy, like a broadsheet newspaper. Use `display-lg` (3.5rem) for hero moments to create intentional asymmetry against small data points.

### Body & UI
- **Font:** Inter.
- **Role:** Utility. All UI labels, descriptions, and instructions live here. Keep line heights generous (1.5x) to balance the density of the Geist headlines.

### Data & Financials
- **Font:** JetBrains Mono.
- **Rule:** **Mandatory use of Tabular Numerals (`tnum`).** In a rental guarantee protocol, numbers must align vertically in tables. If a user is comparing $1,000.00 and $9,999.99, the decimal points must stack perfectly.

---

## 4. Elevation & Depth: Lithic Stacking
Since drop shadows are prohibited, we communicate "z-index" through **Tonal Layering**.

- **The Layering Principle:** 
    - Level 0: `#0E0F11` (Canvas)
    - Level 1: `#16181C` (Structural Panels/Cards)
    - Level 2: `#1E2126` (Floating Elements/Modals)
- **Hard-Edge Logic:** Every element must feel like it was machined out of the surface. 
- **Ambient Presence:** Instead of a shadow, use a 1px border of `#2A2D33` to define a "Surface 2" modal against a "Surface 1" background. This creates a "cut-out" effect rather than a "floating" effect.

---

## 5. Components: Instrument Tooling

### Buttons (The "Actuators")
- **Primary:** Background `#E8A020` (Amber), Text `#0E0F11`. Rectangular, 6px radius.
- **Secondary:** Background `Transparent`, Border 1px `#2A2D33`, Text `#EDECE6`.
- **States:** On hover, Primary Amber shifts to a slightly higher brightness (manually defined, no opacity shifts). No transition easing; interaction should feel instantaneous—like a mechanical switch.

### Data Inputs
- **Field:** Background `#0E0F11` (inset look), Border 1px `#2A2D33`.
- **Focus State:** Border color changes to `#E8A020`. No "glow" or "outer ring."
- **Typography:** Use JetBrains Mono for the input text to emphasize the "data entry" nature of the protocol.

### Cards & Modules
- **Radius:** Fixed at 6px.
- **Density:** High. Minimize padding where possible to allow for maximum data visibility.
- **Separation:** Forbid the use of divider lines within a card. Use `8px` or `16px` vertical gaps to separate content groups.

### Data Ribbons (Specialty Component)
A full-width, 32px tall bar used for the Solana price ticker or protocol TVL. 
- **Background:** `#16181C`.
- **Text:** JetBrains Mono, `label-sm`.
- **Purpose:** Constant monitoring. This anchors the top or bottom of the viewport, reinforcing the "Terminal" energy.

---

## 6. Do’s and Don’ts

### Do:
- **Use Tabular Numerals:** Always align financial figures for quick scanning.
- **Embrace Asymmetry:** Let a large headline sit in a corner while data occupies the opposite side. It feels more "designed" and less "templated."
- **Use Sharp Icons:** Icons must have 0px corner radii. If an icon is in a circle, it’s wrong. It should be in a square or raw.
- **Leverage Metadata:** Use `#9A9B9E` for everything that isn't a primary action. High contrast is a resource—don't waste it.

### Don’t:
- **No Rounded Icons/Logos:** If the logo is a circle, it violates the system. Everything must feel architectural and sharp.
- **No Drop Shadows:** If you need depth, change the background hex code.
- **No Gradients:** Even a 1% gradient is a failure of the aesthetic. 
- **No Transitions:** Avoid 300ms "soft" fades. Use 0ms or 100ms "hard" cuts for states to mimic high-performance hardware.
- **No Centered Text:** In a terminal, everything is left-aligned or right-aligned (for numbers). Centered text feels too "marketing-heavy."