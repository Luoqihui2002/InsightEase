# Phase 4B-3C Log: AI Assistant Workbench UX Audit

**Phase ID**: 4B-3C  
**Date**: 2026-04-28  
**Owner**: Code Agent  
**Status**: ✅ Completed (audit-only, no code changes)

---

## Objective

Inspect the current AI assistant / AI Workbench interaction design, identify UX problems before refactoring, and deliver:
1. A comprehensive audit report
2. A documented state model
3. A recommended implementation direction

---

## Scope

All assistant-related frontend components, services, API clients, and corresponding backend endpoints. Excluded: general page UI outside assistant context.

### Files reviewed (15)

| File | Lines | Category |
|------|-------|----------|
| `app/src/pages/AIWorkspace.tsx` | 953 | Primary assistant surface |
| `app/src/components/AIAssistant.tsx` | 251 | Dead chat panel |
| `app/src/components/AICompanion.tsx` | 221 | Floating avatar |
| `app/src/services/companion-service.ts` | 409 | Proactive messaging |
| `app/src/services/intent-recognition.service.ts` | 459 | NL intent parsing |
| `app/src/services/analysis-execution.service.ts` | 648 | Task execution |
| `app/src/components/assistant/DatasetUnderstandingCard.tsx` | 497 | Dataset profile UI |
| `app/src/pages/SmartAnalysis.tsx` | 903 | Wizard page |
| `app/src/components/KimiAvatar.tsx` | 105 | Avatar |
| `app/src/components/AppLayout.tsx` | 49 | Layout orchestration |
| `app/src/components/AppSidebar.tsx` | 143 | Sidebar entry point |
| `app/src/api/ai.ts` | 64 | API client |
| `app/src/App.tsx` | 157 | Routing |
| `insightease-backend/app/api/v1/endpoints/ai.py` | 170 | Backend AI endpoints |
| `insightease-backend/app/services/ai_service.py` | 358 | AI service wrapper |

---

## Findings Summary

### 7 Critical Issues
1. `AIAssistant.tsx` is dead code (0 imports)
2. `SmartAnalysis.tsx` uses mock data for diagnosis, preprocessing, and most analyses
3. Three uncoordinated assistant surfaces (Workbench, Wizard, Companion) with no shared state
4. 4 of 5 backend `/ai/*` endpoints are unreachable from frontend
5. Companion uses `window.location.href` causing full page reloads
6. AIWorkspace general chat is completely commented out
7. No pre-fill navigation despite design doc requirement

### 6 High Issues
- Intent recognition wastes LLM calls on every message
- JSON parsing from LLM is brittle (no schema validation)
- DatasetUnderstandingCard is buried in dataset dialog
- AIWorkspace closes on backdrop click without guard
- Kimi branding hardcoded throughout
- localStorage chat history unbounded

### 5 Medium Issues
- No cancel button during analysis
- Dataset preview static (5 rows only)
- Capability cards not schema-aware
- Companion event listener leak
- Duplicate welcome message

### Design Doc Gap
Out of 11 design doc requirements (4B-1), 6 are partially implemented and 5 are entirely missing.

---

## Deliverables

1. **`docs/PHASE4B3C_AI_ASSISTANT_UX_AUDIT.md`** — Full audit report with flow maps, state model, ranked issues, and recommended direction.
2. **This phase log** — Compact record of work performed.

---

## Recommended Next Phase (4B-3D)

1. Remove dead code (`AIAssistant.tsx`)
2. Fix companion navigation (React Router)
3. Add backdrop click guard to AIWorkspace
4. Optimize intent recognition (skip LLM when quickMatch is confident)
5. Begin pre-fill navigation support on analysis pages

---

## Build Gate

Not applicable (audit-only, no code changes).
