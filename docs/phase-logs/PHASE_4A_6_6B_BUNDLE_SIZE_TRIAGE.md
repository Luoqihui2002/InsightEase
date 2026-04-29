# Phase 4A-6-6B: Bundle Size Triage

## Objective
Reduce the frontend production bundle's largest single chunk by adding a conservative `manualChunks` strategy in Vite. No page code, business logic, or dependencies were modified.

## Baseline Build Output

**Before any changes:**

```
dist/assets/index-k7ljI5p_.js   3,396.60 kB │ gzip: 1,015.79 kB
dist/assets/index-o9xHGVtx.css   114.30 kB │ gzip:  18.93 kB
```

- Total JS: **3,396.60 kB**
- Largest single chunk: **3,396.60 kB**
- Number of JS chunks: **1**
- Vite chunk warning: **yes** (single chunk > 500 kB)
- Build time: **20.15s**

## ManualChunks Strategy Added

Added to `app/vite.config.ts` under `build.rollupOptions.output.manualChunks`:

```ts
manualChunks(id) {
  if (id.includes("node_modules")) {
    if (id.includes("echarts") || id.includes("zrender")) {
      return "vendor-echarts";
    }
    if (id.includes("@radix-ui")) {
      return "vendor-radix";
    }
    if (id.includes("xlsx")) {
      return "vendor-export";
    }
    if (id.includes("framer-motion") || id.includes("gsap")) {
      return "vendor-animation";
    }
  }
},
```

**Strategy rationale:**
- `vendor-echarts`: ECharts + ZRender are the largest dependency (~1.5 MB). Isolating them removes the heaviest vendor code from the main chunk.
- `vendor-radix`: All `@radix-ui/*` primitives (~130 KB). These are stable UI primitives that rarely change, good for caching.
- `vendor-export`: `xlsx` (~414 KB). Used only in export/download flows, lazy-loadable in future if desired.
- `vendor-animation`: `framer-motion` + `gsap` (~197 KB). Animation libraries are self-contained.
- **No catch-all `vendor` chunk** was used to avoid circular chunk dependencies observed in earlier attempts.
- **React core** (`react`, `react-dom`, `react-router-dom`) was intentionally kept in the main chunk to avoid circular dependency warnings with charting libraries that depend on React.

## After-Build Output

```
dist/assets/index-DvGmbzdk.js            1,061.24 kB │ gzip: 260.40 kB
dist/assets/vendor-echarts-CCtHzgZF.js   1,561.26 kB │ gzip: 489.29 kB
dist/assets/vendor-export-BojT3SgY.js      424.38 kB │ gzip: 141.60 kB
dist/assets/vendor-animation-BdWN6qfT.js   201.57 kB │ gzip:  70.92 kB
dist/assets/vendor-radix-C_FcIVE_.js       132.65 kB │ gzip:  41.79 kB
dist/assets/index-o9xHGVtx.css             114.30 kB │ gzip:  18.93 kB
```

- Total JS: **3,381.10 kB** (≈ -0.5% — manualChunks does not reduce total size)
- Largest single chunk: **1,561.26 kB** (vendor-echarts) — **54% reduction** from baseline 3,396.60 kB
- Main app chunk: **1,061.24 kB** — **69% reduction** from baseline
- Number of JS chunks: **5**
- Vite chunk warning: **yes** (2 chunks > 500 kB: vendor-echarts + main)
- Build time: **19.12s**
- Circular chunk warnings: **none**

## Before/After Chunk Size Comparison

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Largest JS chunk | 3,396.60 kB | 1,561.26 kB | **-54%** |
| Main app chunk | 3,396.60 kB | 1,061.24 kB | **-69%** |
| ECharts chunk | — (in main) | 1,561.26 kB | split out |
| Radix chunk | — (in main) | 132.65 kB | split out |
| Export chunk | — (in main) | 424.38 kB | split out |
| Animation chunk | — (in main) | 201.57 kB | split out |
| Total JS size | 3,396.60 kB | 3,381.10 kB | -0.5% |
| Gzip total | ~1,015.79 kB | ~1,003.20 kB | -1.2% |
| Vite chunk warning | 1 chunk | 2 chunks | partially resolved |
| Build time | 20.15s | 19.12s | -5% |

## What Was Intentionally Not Changed

- **No dynamic `import()` for pages** — deferred to a future architecture phase (would change routing behavior and require lazy-loading orchestration).
- **No ECharts tree-shaking** — ECharts still imports the full bundle. Reducing to specific chart modules would require changing page imports and is a code change, not a build config change.
- **No `vendor` catch-all chunk** — abandoned after producing circular chunk warnings (`vendor-react -> vendor-charts -> vendor-react`).
- **No React core split** — kept in main chunk to avoid circular dependencies with charting libraries.
- **No page files modified** — zero changes to `app/src/pages/*`.
- **No package files modified** — `package.json` and `package-lock.json` untouched.

## Known Issues / TODO

1. **ECharts chunk is still > 500 kB** (~1.56 MB). Future optimization: migrate from full `echarts` import to tree-shaken imports (`echarts/core` + specific chart/render/component modules). This requires code changes across Visualization, Dashboard, PathAnalysis, Attribution, Forecast.
2. **Main app chunk is still > 500 kB** (~1.06 MB). Future optimization: route-based code splitting with React.lazy() + Suspense. This requires architectural review of routing and loading states.
3. **Vite chunk warning persists** for 2 chunks. This is expected — the warning threshold is 500 kB and we have 2 chunks above it. Further reduction requires code changes, not just build config.

## Runtime Verification

**Status**: Pending user manual verification

Recommended manual checks:
- [ ] App opens normally
- [ ] Dashboard opens normally
- [ ] Visualization opens normally
- [ ] Forecast or PathAnalysis page opens normally
- [ ] No blank page after refresh
- [ ] No dynamic import / chunk loading errors in console
- [ ] Console has no new errors

## Validation

- `npx tsc --noEmit`: ✅ 0 errors
- `npm run build`: ✅ success (19.12s)
- SelectItem empty value check: ✅ no violations
- Circular chunk warnings: ✅ none

## Modified Files

- `app/vite.config.ts` — added `build.rollupOptions.output.manualChunks`

## Git Information

### Pre-commit Status
```
On branch master
Your branch is up to date with 'origin/master'.
nothing to commit, working tree clean
```

### Commit
- **Hash**: `b018171`
- **Message**: `build: split frontend vendor chunks`
- **Files changed**: 5 files changed, 208 insertions(+), 6 deletions(-)
  - `app/vite.config.ts`
  - `docs/phase-logs/PHASE_4A_6_6B_BUNDLE_SIZE_TRIAGE.md`
  - `docs/CURRENT_PROGRESS.md`
  - `docs/CHANGELOG.md`
  - `docs/ROADMAP.md`

### Push Result
- ✅ Pushed to `origin/master` (`35e633e..b018171`)
- First attempt failed with `schannel: failed to receive handshake` (transient SSL error)
- Second attempt succeeded

### Package Files Modified
- **None** — no `package.json`, `package-lock.json` changes.

## Next Phase

**Phase 4A-6-7: ResultTable Design Document** — ready to begin.

Pure research document phase. No code changes expected.
