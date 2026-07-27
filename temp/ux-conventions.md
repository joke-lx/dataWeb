# dataWeb — Shared UX Conventions

Visual + behavioral spec for every route in the app. Generated after the
home-mockup-A → refined home.html → 5 route mockups cycle. Authoritative
source for downstream React implementation.

---

## 1. Frame (TopBar)

Present on **every** route, identical markup. Sticky to viewport top so the
species toggle stays accessible while scrolling within a route.

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⊙ dataWeb    Hi-C  Δ Hi-C  Tracks  3D  CTCF Motif     [Pig|Chicken] │
└─────────────────────────────────────────────────────────────────────┘
       brand       main nav (5)                  right-aligned species toggle
```

| Slot | Behavior |
|---|---|
| `brand` | 25×25 CSS-only mark + `dataWeb` wordmark. `letter-spacing: -0.03em`. Always links to `/`. |
| `main nav` | 5 links. Active route gets `var(--accent-soft)` background + `var(--accent)` text. Hover (non-active) gets the same accent-soft background. **Do not** add a third style to distinguish active from hover — keep them visually identical. |
| `species toggle` | Pig | Chicken. Single source of truth lives in `useSpeciesStore`. Click writes `?species=pig|chicken` to URL and rewrites suggestions / placeholder / catalogue / all dependent UI. Default = Pig. |

The `CTCF Motif` route is **secondary** (lives in `category: 'trigger'`).
Render it as a muted gray pill, distinct from the 4 primary routes.

---

## 2. Region breadcrumb bar

Sits directly below the TopBar. Appears on every viewer route
(`/hic`, `/differential`, `/tracks`, `/3d`, `/ctcf-motif`). Not on `/`.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Pig › Brain › Brain_BF3 · chr1:1,234,000–1,456,000 · bin 10,000 bp  │
└─────────────────────────────────────────────────────────────────────┘
```

| Segment | Source |
|---|---|
| Species / tissue / sample id | from URL `?species=` + `?sample=` / `?sample_a=` / `?samples=` (first id) |
| Region | URL `?chr=&start=&end=` formatted as `chr{n}:{start.toLocaleString()}–{end.toLocaleString()}` |
| Bin | URL `?bin=` formatted as `{bin.toLocaleString()} bp` (omitted on non-resolution routes) |

Right-aligned action slot:
- `/hic` / `/differential`: "Change sample" (popover with sample list filtered by species)
- `/tracks`: sample picker dropdown trigger ("Brain_BF3 + 2 samples ⌄")
- `/3d`: sample picker dropdown trigger (single id)
- `/ctcf-motif`: population segmented control (Global | Berkshire | Tibetan | F1)

Click any segment → drops into editable input (only sample id is editable
on viewer routes; region edits go through the region navigator).

---

## 3. Page header

Every viewer route has one. 3 lines + right-aligned action row.

```
Title (h2, 23px, letter-spacing -0.035em)
Subtitle (12px muted, mono, region + bin + species metadata)
Action row (right-aligned): Share / Download PNG / Download CSV / etc.
```

Title copy:
- `/hic`: "Hi-C contact map"
- `/differential`: "Differential Hi-C (log₂ A / B)"
- `/tracks`: dynamic from sub-tab (RNA-seq, H3K4me3, …)
- `/3d`: "3D chromatin folding — {Tissue} ({Sample})"
- `/ctcf-motif`: "CTCF motif at active region"

---

## 4. Toolbar

Under page header. Two slots: left (controls) + right (export).

Components reused across routes:
- **Segmented control** — colormap selector, population selector, comparison-mode chips. Active option has accent fill + white text. Non-active = transparent + muted text.
- **Stepper** — bin stepper with `–25` / `+25` buttons + middle readout. Clamps to `[1000, 1_000_000]`.
- **Re-fetch** — primary button (accent fill). Triggers a re-mount of the data query (force new fetch even if cache hit).
- **Export PNG / Export CSV / Share** — secondary buttons (white + line border). Mock with `navigator.clipboard.writeText` for Share.

---

## 5. Viewer area

The "main canvas" of each route.

| Route | Centerpiece | Surroundings |
|---|---|---|
| `/hic` | Square heatmap, 360–520px | Left colormap rail (60px wide, vertical min/max ticks); top edge gene track strip |
| `/differential` | Square heatmap, log₂ divergent color | Left colorbar (60px wide, ticks −3..+3); below = A + B mini-tile row |
| `/tracks` | Vertical lane stack | 120px left gutter per lane (label + sample id) |
| `/3d` | 1–3 organ canvases (360×220 each) | Per-canvas ↻ reset / ⊟ expand; below = PEI table (brain only) |
| `/ctcf-motif` | 60/40 split: motif logo + genotype pie | Below = SNP × position track |

---

## 6. Region navigator (mini-map)

At the bottom of every viewer route. **Same SVG pattern across routes** so
the user learns it once.

```
┌─────────────────────────────────────────────────────────────────────┐
│ REGION NAVIGATOR · chr{n}                              {chr_len} bp  │
│ ╔═══ ideogram banded rectangles (G-band shading) ═════════════╗      │
│ ║                          ┌──────────────┐                   ║      │
│ ║                          │ viewport rect│ (red outline)     ║      │
│ ║                          └──────────────┘                   ║      │
│ ╚══════════════════════════════════════════════════════════════╝      │
└─────────────────────────────────────────────────────────────────────┘
```

~1100px × 60px SVG. Tick marks every 5 Mb. Interactions:
- **Drag viewport rect** → pans region (writes `?start=` + `?end=`).
- **Drag left/right edges** → resizes window.
- **Click outside rect** → recenters on click x with current width.

---

## 7. Status footer

Persistent 24px footer at the bottom of the viewport (single line). Reused
from the current `StatusBar` component.

```
dataWeb · Multi-omics 3D genome browser          Reference: Sscrofa11.1 · Ready
```

Right side carries per-route metadata:
- `/hic` / `/differential`: `Ready · 24,832 contacts · fetched in 142 ms`
- `/tracks`: `Reference: Sscrofa11.1 · Ready`
- `/3d`: `Live · backbone 74 pts · 3 arcs in view`
- `/ctcf-motif`: `PWM length 20 · 5 SNPs · Ready`

States: `Ready` (muted) / `Loading…` (mono with pulse) / `Error` (accent red) / `Empty` (muted grey).

---

## 8. URL state model (single source of truth)

All viewer state lives in the URL. No global mirror state.

| Route | URL params |
|---|---|
| `/` | (none — purely navigation) |
| `/hic` | `species` (pig/chicken), `sample`, `chr`, `start`, `end`, `bin` |
| `/differential` | `species`, `sample_a`, `sample_b`, `chr`, `start`, `end`, `bin`, `mode` (tissue/breed/cross/time) |
| `/tracks` | `species`, `type` (sub-tab id), `sample` + `samples` (csv), `chr`, `start`, `end` |
| `/3d` | `species`, `sample`, `chr`, `start`, `end` |
| `/ctcf-motif` | `species`, `chr`, `start`, `end`, `sample`, `population` |

When switching tabs / routes:
- `setParams` must use **callback form** so other keys are preserved.
- `samples=` is canonical sorted csv; absent → fallback; explicit empty → `samples=`.
- `sample=` for single-sample routes, `samples=` for tracks.

---

## 9. Loading / empty / error states

Every async area must declare all three states. Shared visual vocabulary:

| State | Visual |
|---|---|
| Loading | Mono text "Loading…" with a 1s pulse; small accent dot at left; height reserved (no layout jump) |
| Empty | Italic muted text centered in the area; subtle "— empty —" mono caption above |
| Error | Accent red small `!` icon top-right; tooltip with `error.message` on hover |

Placeholders (skeletons) are NOT used — the routes load fast enough that
explicit text states are clearer than shimmer effects.

---

## 10. Sample picker (multi-sample, /tracks only)

Reuses the existing `SamplePickerButton` + `SamplePicker` + `TrackSampleHeader`
infrastructure. New addition for the home page UX:

- The home page popular-this-week strip uses the same chip pattern.
- The `/differential` sample-pair slot uses the same chip × remove affordance.
- The `/3d` single-sample picker uses a compact variant (single id, no chips).

---

## 11. Responsive behavior

| Breakpoint | Behavior |
|---|---|
| ≥1280px | Full layout as designed |
| 850–1279px | TopBar nav still visible; sub-tab groups may scroll horizontally; species-card grid → 1 column on home |
| 620–849px | TopBar nav collapses (hamburger in v2; for now hide nav entirely); species toggle stays |
| <620px | All multi-column layouts → 1 column; search shell stacks (input / select / button); region breadcrumb wraps |

**Do not** use the same responsive rules across all routes — each route
declares its own. The above is the home page baseline.

---

## 12. Accessibility baseline

Every route ships with:
- `aria-label` on every nav region (`Primary navigation`, `Active species`)
- `aria-selected` on toggle states (species, mode chips, comparison mode)
- `aria-expanded` on popovers (sample picker, mode configurator)
- `aria-live="polite"` on the search preview slot so screen readers announce the search jump target
- Keyboard: Enter / Space activates buttons and chips; Esc closes popovers; Tab order matches visual order
- Color contrast: ink `#181818` on surface `#fafafa` ≥ 13:1; muted `#686868` on surface ≥ 5.4:1 (AA at small text)

---

## 13. Implementation roadmap (after sign-off)

When the user picks `home.html` + the 5 route mockups as the design baseline, implement in this order:

1. **Token migration** — promote `temp/design-system.html` tokens into `apps/web/src/styles/tokens.css` + `apps/web/src/styles/global.css`. Existing `tokens.css` is the source of truth; do not duplicate.
2. **TopBar rebuild** — `apps/web/src/components/shell/TopBar.tsx`. Add brand mark SVG, sticky positioning, route registry nav, species toggle (new component `SpeciesToggle.tsx` reading `useSpeciesStore`).
3. **Region breadcrumb bar** — new `RegionBreadcrumb.tsx`, used by all 5 viewer routes.
4. **`HomeRoute`** — replaces `<Navigate to={DEFAULT_PATH}>` redirect at `/`. Stand-alone, no viewer data dependencies.
5. **`HicRoute` / `DifferentialRoute` / `TracksRoute` / `ThreeDChromatinRoute` / `CtcfMotifRoute`** — refactor each to add RegionBreadcrumb + PageHeader + Toolbar + RegionNavigator + StatusFooter around existing content. Don't rewrite content.
6. **`useSpeciesStore`** — Zustand store mirroring `useSamples`. Single source of truth for `species: 'pig' | 'chicken'`. URL `?species=` is canonical; setter uses callback form.
7. **Design system docs site** — the `temp/design-system.html` itself becomes `/__design` or lives in Storybook later (out of scope for v1).

---

## 14. Open questions for the user

1. **Spacing scale step at 32px / 48px?** `design-system.html` ships with 5 steps (4–24); the hero/section paddings pull from these. If larger gutters (e.g. 64px hero) are needed, add `--space-6: 32px` + `--space-7: 48px`.
2. **Should the TopBar nav collapse to a hamburger below 850px**, or stay full-width and overflow horizontally (current approach)?
3. **CTCF Motif nav position**: secondary nav at the end of the row (current), or moved to a separate "Tools" sub-menu? Mockup A keeps it inline with secondary styling.
4. **3D route panel layout**: 3-column grid at ≥980px (mockup) vs always-stacked-vertical (matches the demo reference). Confirm.
5. **Region navigator**: per-route repetition (mockup current), or a single shared bottom strip across all routes? The shared strip is more discoverable; the per-route repetition matches the demo reference.
6. **Chicken sample id scheme**: the mockup uses `HH10_Brain`, `D7_Heart` style (Hamburger-Hamilton stage + tissue). Confirm against the real chicken dataset's accession convention.
7. **Status bar wording**: right-side status text is per-route. Confirm the example copy in §7.
8. **Auto-save / deep-link**: every viewer route already supports URL deep-linking. Do we want a "Bookmark this view" button on top of that, or is URL enough?

---

## 15. File index

All mockups live under `temp/`:

| File | Size | Lines | Purpose |
|---|---|---|---|
| `temp/home-mockup-A.html` | 14.5 KB | 159 | Original hero-centered variant A |
| `temp/home-mockup-B.html` | 58.6 KB | 1415 | Side-rail browser variant B (not selected) |
| `temp/home-mockup-C.html` | 51.0 KB | — | Species-tab-hub variant C (not selected) |
| `temp/design-system.html` | 72 KB | 1320 | Canonical visual spec (tokens + components) |
| `temp/home.html` | 28 KB | 409 | Home page refined (A baseline) |
| `temp/route-hic.html` | 44 KB | 815 | `/hic` viewer route |
| `temp/route-differential.html` | 41 KB | — | `/differential` viewer route |
| `temp/route-tracks.html` | 12 KB | 20 (single-line) | `/tracks` viewer route |
| `temp/route-3d.html` | 31 KB | — | `/3d` viewer route |
| `temp/route-ctcf-motif.html` | 36 KB | — | `/ctcf-motif` viewer route |
| `temp/ux-conventions.md` | this file | — | Shared conventions spec |

Open in any browser via `file://`. No build step.