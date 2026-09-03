# InsightEase

> AI-assisted statistics and analytics platform for dataset understanding, relationship-aware analysis planning, structured result rendering, and safe AI result follow-up.

![InsightEase Landing](docs/assets/interview/hero-landing.png)

## Overview

**InsightEase** is an AI-assisted data analysis platform designed for business analytics, experimentation, forecasting, attribution, path analysis, and statistical exploration.

The platform helps users move from raw uploaded datasets to structured analytical insights through an end-to-end workflow:

```text
Upload datasets
→ Understand dataset structure
→ Classify and organize datasets
→ Infer relationships between tables
→ Generate AI-assisted analysis plans
→ Execute statistical / business analysis
→ Render structured results
→ Bring results back to AI Workbench for explanation and next-step suggestions
```

Unlike a simple AI chat interface, InsightEase uses a bounded, metadata-first assistant architecture. The AI Workbench does not blindly consume raw data or automatically execute analysis. It works with dataset metadata, confirmed relationship context, safe result summaries, and explicit user actions.

---

## Product Preview

### Dashboard

The dashboard provides a high-level overview of uploaded datasets, analysis tasks, storage distribution, recent activity, and analysis type distribution.

![Dashboard Overview](docs/assets/interview/dashboard-overview.png)

### Dataset Upload

Users can upload CSV / Excel files. The backend parses schema information, stores metadata, and makes datasets available for downstream analysis.

![Upload Data](docs/assets/interview/upload-data.png)

### Dataset Catalog

The Dataset Catalog supports dataset search, grouped views, business-topic classification, data-type labels, analysis-use tags, and quality scores.

![Dataset Catalog](docs/assets/interview/dataset-catalog.png)

### Dataset Preview

Users can expand datasets to inspect bounded previews and schema-level information before running analysis.

![Dataset Preview](docs/assets/interview/dataset-preview.png)

---

## Core Features

### 1. Dataset Upload and Management

InsightEase supports the full dataset lifecycle from upload to downstream analysis.

Key capabilities:

- CSV / Excel upload
- Dataset metadata extraction
- Dataset list and preview
- Search and grouped dataset views
- Business-category and analysis-use labels
- Quality score display
- Dataset download and deletion

The Dataset Catalog is designed as a deterministic metadata layer. It can classify datasets by business topic, data type, and likely analysis usage using filename, schema fields, row/column counts, and exposed metadata.

---

### 2. Data Preprocessing

The DataWorkshop / preprocessing module supports common data cleaning workflows before analysis.

![DataWorkshop Preview](docs/assets/interview/data-workshop-preview.png)

Supported operations include:

- Missing value handling
- Duplicate handling
- Outlier handling
- Standardization options
- Preview-before-save workflow
- Save processed result as a new dataset

The design follows a backend-processing-first model: preprocessing is previewed and saved through backend APIs rather than being silently executed in the browser.

---

### 3. Statistical and Business Analysis Modules

InsightEase provides multiple analysis modules for different business and statistical use cases.

Current modules include:

- Descriptive statistics
- Visualization analysis
- Forecasting
- Attribution analysis
- Path analysis
- Data overview and field profiling
- Data preprocessing
- Analysis history management

#### Statistics ResultView

![Statistics ResultView](docs/assets/interview/statistics-resultview.png)

#### Forecast Analysis

![Forecast Result](docs/assets/interview/forecast-result.png)

#### Attribution Analysis

![Attribution Result](docs/assets/interview/attribution-result.png)

#### Path Analysis

![Path Analysis Result](docs/assets/interview/path-analysis-result.png)

---

## AI Workbench

AI Workbench is the main assistant shell of InsightEase.

It connects dataset context, relationship context, analysis history, structured planning, and result follow-up into a unified interface.

### Relationship-aware Context

Users can create and manage **Relationship Sets**, which represent topic-scoped dataset graphs.

A Relationship Set may include:

- connected dataset nodes
- confirmed relationship edges
- isolated / reference tables
- high-risk relationship warnings

![AI Workbench Relationship Set](docs/assets/interview/ai-workbench-relationship-set.png)

Relationship Sets are used as **allowed context** for planning. They do not automatically join datasets or execute analysis.

---

### AI-assisted Analysis Planning

Users can ask natural-language business questions, and AI Workbench converts them into structured analysis plans.

With the live runtime enabled, bounded metadata is sent through the InsightEase backend to Hermes and the returned plan is validated against the exact dataset, field, and Relationship Set context. Invalid or unavailable live responses fall back to the deterministic planner.

![AI Workbench Analysis Plan](docs/assets/interview/ai-workbench-analysis-plan.png)

The generated plan distinguishes:

- required datasets
- candidate datasets
- suggested fields
- assumptions
- warnings
- recommended target analysis module

The assistant can prefill target analysis pages, but the user must still review the configuration and manually start the analysis.

**Hermes live planning is advisory. Plans require user confirmation. Multi-table execution is not yet implemented. Relationship Sets are context graphs, not executed joins.**

---

### Safe Result Follow-up

Analysis results can be brought back into AI Workbench for explanation, risk identification, next-step suggestions, and report drafting.

![AI Workbench Result Follow-up](docs/assets/interview/ai-workbench-result-followup.png)

The result follow-up flow is based on `SafeResultSummary`, a bounded summary contract. It avoids sending full raw result tables or raw dataset rows into the assistant context.

---

## End-to-End Product Workflow

```mermaid
flowchart TD
    A[Upload CSV / Excel] --> B[Backend Parse & Store]
    B --> C[Dataset Catalog]
    C --> C1[Search / Group / Classify]
    C --> C2[Dataset Understanding]

    C --> D[DataWorkshop]
    D --> D1[Transform Preview]
    D1 --> D2[Save as New Dataset]

    C --> E[Relationship Inference]
    E --> E1[Review / Confirm / Reject]
    E1 --> E2[Relationship Set Topic Graph]

    C --> F[AI Workbench]
    E2 --> F
    D2 --> F

    F --> F1[Context Panel]
    F1 --> F1A[Dataset Context]
    F1 --> F1B[Relationship Set Context]
    F1 --> F1C[Analysis History Context]

    F --> G[Generate Analysis Plan]
    G --> G1[Required Datasets]
    G --> G2[Candidate Datasets]
    G --> G3[Suggested Fields]
    G --> G4[Warnings / Assumptions]

    G --> H{Analysis Type}

    H -->|Single-table| I[Prefill Analysis Page]
    I --> J[Statistics / Forecast / Attribution / Path / Data Overview]
    J --> K[Manual Start Analysis]
    K --> L[Backend Analysis Execution]
    L --> M[ResultView / Charts / Tables]

    H -->|Multi-table| N[Join Builder - Future Phase]
    N --> N1[Join Preview]
    N1 --> N2[Temporary / Saved Derived Dataset]
    N2 --> I

    M --> O[Safe Result Summary]
    O --> P[Bring to AI Workbench]
    P --> Q[Result Follow-up / Explanation]
    Q --> R[Next Steps / Report Draft / Business Suggestions]
```

---

## System Architecture

```mermaid
flowchart TB
    subgraph FE[Frontend]
        FE1[Dataset Catalog]
        FE2[DataWorkshop]
        FE3[Analysis Pages]
        FE4[AI Workbench]
        FE5[History / Dashboard]
        FE6[ResultView & ResultChartRenderer]
    end

    subgraph STATE[Frontend State]
        S1[React Hooks]
        S2[Assistant Context Store]
        S3[Session Storage]
        S4[Local UI Preferences]
    end

    subgraph API[Backend API - FastAPI]
        A1[Auth API]
        A2[Dataset API]
        A3[Transform API]
        A4[Analysis API]
        A5[Assistant API]
        A6[Hermes Assistant API]
        A7[Future Join Builder API]
    end

    subgraph ASSISTANT[Assistant Layer]
        B1[Dataset Profiler]
        B2[Table Classifier]
        B3[Relationship Inference Engine]
        B4[Analysis Planner]
        B5[Safe Result Summary Builder]
        B6[Result Explainer]
        B7[Assistant Runtime Adapter]
        B8[Safe Tool Registry]
    end

    subgraph RUNTIME[Runtime Providers]
        R1[Rule-based Runtime - Default / Fallback]
        R2[Hermes Dry-run Runtime - Opt-in]
        R3[Hermes Live Result Explainer]
        R4[Hermes Live Plan Adapter - Opt-in]
    end

    subgraph EXEC[Execution Layer]
        E1[pandas Transform Executor]
        E2[Background Analysis Tasks]
        E3[Statistics / Forecast / Attribution / Path / Data Overview Services]
        E4[Future Join Preview / Derived Dataset Builder]
    end

    subgraph DATA[Data Layer]
        D1[MySQL Metadata]
        D2[Local Disk / OSS Storage]
        D3[Analysis History]
        D4[Derived Dataset Metadata]
    end

    FE1 --> A2
    FE2 --> A3
    FE3 --> A4
    FE4 --> A5
    FE4 --> A6
    FE5 --> A4
    FE6 --> FE3

    FE4 --> STATE
    FE3 --> STATE

    A2 --> D1
    A2 --> D2

    A3 --> E1
    E1 --> D1
    E1 --> D2

    A4 --> E2
    E2 --> E3
    E3 --> D3

    A5 --> ASSISTANT
    A6 --> RUNTIME
    B7 --> R1
    B7 --> R2
    B7 --> R3
    B7 --> R4
    RUNTIME --> B8

    A7 --> E4
    E4 --> D4
    E4 --> D2
```

---

## AI Analysis Pipeline

```mermaid
flowchart TD
    A[User Question in AI Workbench] --> B[Context Assembly]

    B --> B1[Selected Dataset]
    B --> B2[Dataset Catalog Metadata]
    B --> B3[Dataset Profile]
    B --> B4[Active Relationship Set]
    B --> B5[Analysis History Summary]
    B --> B6[Safe Result Summary]

    B1 --> C[Assistant Runtime Adapter]
    B2 --> C
    B3 --> C
    B4 --> C
    B5 --> C
    B6 --> C

    C --> D{Runtime Mode}

    D -->|Default| E[Rule-based Runtime]
    D -->|Dry-run| F[Hermes Dry-run Runtime]
    D -->|Live Result Explain| G[Hermes Result Explainer]
    D -->|Live Planning| H[Hermes Plan Analysis Runtime]

    E --> I[Structured Analysis Plan]
    F --> I
    H --> I

    G --> J[Bounded Result Explanation]

    I --> K[Required Datasets]
    I --> L[Candidate Datasets]
    I --> M[Suggested Fields]
    I --> N[Warnings / Assumptions]
    I --> O[Next Actions]

    O --> P{Navigation Target}
    P -->|Single-table page| Q[Prefill Analysis Page]
    P -->|Multi-table question| R[Stop at needs_join - P0C Handoff]
    P -->|Need clarification| S[Ask User to Confirm Dataset / Relationship]

    Q --> T[User Reviews Prefill]
    T --> U[Manual Start Analysis]

    R --> V[User-confirmed Join Plan]
    V --> W[Join Preview / Derived Dataset]
    W --> Q

    U --> X[Backend Analysis Task]
    X --> Y[Structured Analysis Result]
    Y --> Z[ResultView]

    Z --> AA[Safe Result Summary]
    AA --> AB[Bring Result Back to AI Workbench]
    AB --> AC[Explain / Risks / Next Steps / Report Draft]
```

---

## Relationship Sets and Multi-table Context

```mermaid
flowchart LR
    subgraph CATALOG[Dataset Catalog]
        U[Users Table]
        O[Orders Table]
        P[Products Table]
        E[Event Log Table]
        M[Marketing Touchpoints]
        F[Forecast Metrics Table]
    end

    subgraph PROFILE[Deterministic Metadata Layer]
        P1[Column Role Detection]
        P2[Field Type and Role Detection]
        P3[Table Classification]
        P4[Quality Warnings]
    end

    U --> PROFILE
    O --> PROFILE
    P --> PROFILE
    E --> PROFILE
    M --> PROFILE
    F --> PROFILE

    PROFILE --> R[Relationship Inference Engine]

    R --> R1[orders.user_id -> users.user_id]
    R --> R2[orders.product_id -> products.product_id]
    R --> R3[event_log.user_id -> users.user_id]
    R --> R4[touchpoints.user_id -> users.user_id]
    R --> R5[touchpoints.order_id -> orders.order_id]

    R1 --> REVIEW[Relationship Review UI]
    R2 --> REVIEW
    R3 --> REVIEW
    R4 --> REVIEW
    R5 --> REVIEW

    REVIEW --> C1[Confirm]
    REVIEW --> C2[Reject]
    REVIEW --> C3[High-risk Warning]

    C1 --> SET[Relationship Set]
    SET --> SET1[Connected Dataset Nodes]
    SET --> SET2[Confirmed Relationship Edges]
    SET --> SET3[Isolated / Reference Tables]
    SET --> SET4[Risk Metadata]

    SET --> PLAN[AI Workbench Planner]
    PLAN --> PLAN1[Single-table Analysis Plan]
    PLAN --> PLAN2[Multi-table Analysis Plan]

    PLAN2 --> JOIN[Future Join Builder]
    JOIN --> JOIN1[Join Preview]
    JOIN --> JOIN2[Temporary / Saved Derived Dataset]
    JOIN2 --> TARGET[Target Analysis Module]
```

---

## Safety Boundaries

InsightEase is designed around safe AI-assisted analysis rather than uncontrolled agent execution.

Current boundaries:

- No silent joins
- No automatic analysis execution
- No arbitrary SQL execution from AI
- No source dataset mutation
- No raw dataset rows sent to AI by default
- Relationship Sets are context graphs, not execution plans
- Result follow-up uses bounded `SafeResultSummary`
- Execute/write actions require explicit user confirmation

---

## Tech Stack

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Radix UI
- ECharts
- Axios
- React hooks + local/session storage for UI state

### Backend

- FastAPI
- Python 3.11
- pandas
- SQLAlchemy
- MySQL
- Local disk / OSS storage
- BackgroundTasks for analysis execution

### AI / Assistant Layer

- Assistant Runtime Adapter
- Rule-based runtime by default
- Hermes dry-run runtime opt-in
- Hermes live structured planning opt-in with deterministic fallback
- Hermes live result explanation boundary
- Safe Tool Registry
- Safe Result Summary
- Metadata-first planning context

---

## Project Status

This project is under active development.

Completed capabilities include:

- Dataset upload and management
- Dataset Catalog search and grouped views
- Data preprocessing preview and save workflow
- Multiple analysis modules
- Unified ResultView rollout
- ResultChartRenderer for basic chart rendering
- Analysis History Catalog
- AI Workbench shell
- Relationship Set management
- Relationship-aware analysis planning
- Prefill navigation to analysis pages
- Safe result handoff to AI Workbench
- Deterministic result follow-up
- Hermes dry-run / live-planning / live-result-explainer safety boundary
- Validated single-table prefill and multi-table `needs_join` handoff

Planned next-stage capabilities:

- AI error explainer
- Multi-table Join Builder
- Backend join preview
- Temporary / saved derived analysis datasets
- Productization, permissions, audit logs, and large-dataset handling
- Dashboard builder and report generation

---

## Demo Scenarios

### 1. Dataset Catalog to Forecast Plan

```text
Datasets
→ Group by analysis usage
→ Find forecast dataset
→ Open AI Workbench
→ Ask: "预测未来销售额趋势"
→ Generate forecast plan
→ Navigate to Forecast page with prefilled dataset
```

### 2. Relationship Set to Channel Conversion Plan

```text
AI Workbench
→ Create Relationship Set from users / orders / event log / marketing touchpoints
→ Ask: "分析各渠道转化率"
→ Review required datasets and candidate datasets
→ Navigate to Attribution or Statistics only after required datasets are confirmed
```

### 3. Result to AI Workbench Follow-up

```text
Run Statistics / Forecast / Attribution / PathAnalysis
→ Click "带到 AI 工作台"
→ AI Workbench receives SafeResultSummary
→ Ask: "帮我解释这个结果"
→ Ask: "有哪些异常或风险？"
→ Ask: "整理成报告文字"
```

---

## More Screenshots

### History Catalog

![History Catalog](docs/assets/interview/history-catalog.png)

### Visualization Analysis

![Visualization Analysis](docs/assets/interview/visualization-analysis.png)

### Settings and Backend Processing Mode

![Settings](docs/assets/interview/settings-architecture-status.png)

---

## Local Development

> The exact local startup command may vary depending on frontend/backend environment configuration.

### Frontend

```bash
cd app
npm install
# Optional: set VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_live in an uncommitted local env file.
npm run dev
```

### Backend

```bash
cd insightease-backend
pip install -r requirements.txt
# Copy .env.example to an uncommitted local env file and inject Hermes secrets there.
uvicorn app.main:app --reload
```

Live planning requires `HERMES_ASSISTANT_ENABLED=true`, `HERMES_ASSISTANT_MODE=live`, a backend-only provider URL/token, and the explicit frontend runtime setting above. Without those settings, planning remains deterministic.

### Build Check

```bash
cd app
npx tsc --noEmit
npm run build
```

---

## Screenshot File Checklist

Place interview/demo screenshots under:

```text
docs/assets/interview/
```

Recommended file names:

```text
hero-landing.png
dashboard-overview.png
upload-data.png
dataset-catalog.png
dataset-preview.png
history-catalog.png
visualization-analysis.png
data-workshop-preview.png
statistics-resultview.png
attribution-result.png
forecast-result.png
path-analysis-result.png
settings-architecture-status.png
ai-workbench-relationship-set.png
ai-workbench-analysis-plan.png
ai-workbench-result-followup.png
```

---

## Repository Structure

```text
InsightEase/
  app/                         # Frontend application
  insightease-backend/          # Backend API and analysis services
  docs/                         # Architecture, roadmap, design docs, phase logs
  docs/assets/interview/        # README screenshots
  manual-test-data/             # Demo and QA datasets
```

---

## Notes

This repository includes both product code and detailed development documentation.

- Root `README.md`: project showcase for visitors and interviewers.
- `docs/README.md`: internal documentation index for developers and AI coding assistants.
- `docs/design/`: architecture and product design contracts.
- `docs/phase-logs/`: phase-by-phase development records.
- `docs/qa/`: reusable QA recipes and demo scenarios.
