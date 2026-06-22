# Frontend Final Fix Report

**Date:** 2026-06-22  
**Branch:** main  
**Scope:** `frontend/` — final review fix wave

## Items Fixed

### 1. Stale home page → redirect `/` to `/earn`

`frontend/app/page.tsx` replaced entirely with a server-component `redirect("/earn")`.
Removes the duplicate `<nav>` that stacked on top of NavShell's nav bar and the stale
"contracts pending deployment" scaffold text.

Build confirms `/` is listed as a static prerendered route (Next.js renders the redirect
as a static page with the appropriate redirect header — expected).

### 2. `cover_default` picker — robust overdue derivation

`frontend/app/protocol/page.tsx` (~line 727): replaced the index-based filter
(`guaranteeOptions.filter((_, i) => data.activeGuarantees[i] && !g.isCurrent)`) with
a direct derivation from `data.activeGuarantees`:

```tsx
options={data.activeGuarantees
  .filter((g) => !g.isCurrent)
  .map((g) => ({
    value: String(g.id),
    label: `#${g.id} — ${truncAddr(g.guarantee.landlord)} · ${fmtUsd(g.guarantee.monthly_amount)}/mo · overdue`,
  }))}
```

Label shape matches `guaranteeOptions`. No longer fragile to ordering differences
between the mapped array and the source array.

### 3. Test scripts added to `package.json`

Added `"test": "vitest run"` and `"test:ui": "vitest --ui"` to the `scripts` block,
justifying the existing `@vitest/ui` dev-dep.

## Verification

- `bun run build` — PASS (TypeScript clean, 8 static pages generated, `/` listed)
- `bunx vitest run` — PASS (3 test files, 10 tests, 142ms)
