<div align="center">

# Applivo

### Distributed Opportunity Application Orchestration System

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7+-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Celery](https://img.shields.io/badge/Celery-5.4-37814A?style=for-the-badge&logo=celery&logoColor=white)](https://docs.celeryq.dev)
[![Next.js](https://img.shields.io/badge/Next.js-18+-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

A personal, single-user AI career automation platform. Scrapes job boards, scores each opportunity against your career profile via a dual-model LLM pipeline, generates ATS-optimised resumes and cover letters, submits applications via a Playwright browser agent, and delivers real-time notifications through Telegram and email — all autonomously on a 6-hour cycle.

[Overview](#overview) · [Architecture](#system-architecture) · [Agent Pipeline](#agent-pipeline) · [Setup](#prerequisites) · [Configuration](#configuration-reference) · [API Reference](#api-reference) · [Known Issues](#known-issues) · [Roadmap](#roadmap)

</div>

---

## Overview

Applivo is built around three core principles:

**Autonomy** — The platform runs on a self-scheduling Celery Beat loop. Every decision point (scrape, score, generate, submit) is fully automated and logged as an auditable `AgentTask` record with exponential-backoff retry on failure.

**Intelligence** — Two LLM models operate in tandem via the Groq API (OpenAI-compatible interface). The light model handles high-volume, low-cost operations: batch job filtering, match scoring, and chat responses. The heavy model is reserved for high-value work: full job description analysis, resume tailoring, cover letter generation, and interview preparation. A ChromaDB vector store holds semantic embeddings of your profile, past applications, and recruiter interactions, enabling RAG-based personalisation across all AI calls.

**Safety** — Auto-apply is disabled by default. When enabled, every application first passes through a configurable human-in-the-loop gate: a Telegram notification is dispatched and the bot waits for explicit approval before submitting. A daily application limit and a minimum match-score threshold provide additional safeguards.

---

## System Architecture

```
╔══════════════════════════════════════════════════════════════════════╗
║                        PRESENTATION LAYER                            ║
║              Next.js 18 · TailwindCSS · App Router                   ║
║   Dashboard · Jobs · Applications · Resumes · Chat · Analytics       ║
╚══════════════════════════╤═══════════════════════════════════════════╝
                           │  HTTPS / JWT Bearer (HS256)
╔══════════════════════════▼═══════════════════════════════════════════╗
║                       APPLICATION LAYER                              ║
║         FastAPI 0.111 · Uvicorn · SQLAlchemy (asyncpg)               ║
║                                                                      ║
║  /auth   /jobs   /applications   /resumes   /agent                   ║
║  /chat   /analytics   /security   /onboarding   /profile             ║
╚══════════╤══════════════════════════════╤════════════════════════════╝
 async ORM │                              │ Celery .apply_async()
╔══════════▼════════════════╗   ╔═════════▼═════════════════════════╗
║       DATA LAYER          ║   ║         WORKER LAYER              ║
║                           ║   ║                                   ║
║  PostgreSQL 15+           ║   ║  Queue: scraping                  ║
║  ┌─────────────────────┐  ║   ║  ├─ LinkedInScraper   10 req/min  ║
║  │ users               │  ║   ║  ├─ IndeedScraper      20 req/min ║
║  │ user_profiles       │  ║   ║  ├─ IntershalaScraper  default    ║
║  │ jobs + analyses     │◄─╫───╫─ └─ WellfoundScraper   default    ║
║  │ applications        │  ║   ║                                   ║
║  │ resumes             │  ║   ║  Queue: ai                        ║
║  │ cover_letters       │  ║   ║  ├─ analyze_job_task              ║
║  │ interviews          │  ║   ║  ├─ generate_resume_task          ║
║  │ agent_tasks (audit) │  ║   ║  └─ generate_cover_letter_task    ║
║  │ audit_logs          │  ║   ║                                   ║
║  │ credential_vaults   │  ║   ║  Queue: automation                ║
║  │ user_consents       │  ║   ║  └─ auto_apply_task  (Playwright) ║
║  └─────────────────────┘  ║   ║                                   ║
║                           ║   ║  Queue: notifications             ║
║  ChromaDB 0.5             ║   ║  ├─ send_telegram_notification    ║
║  ┌─────────────────────┐  ║   ║  └─ send_email_notification       ║
║  │ user_profile embeds │  ║   ║                                   ║
║  │ job embeddings      │  ║   ║  Celery Beat (cron scheduler)     ║
║  │ resume embeddings   │  ║   ║  ├─ run_main_agent_cycle  / 6h    ║
║  │ RAG retrieval       │  ║   ║  ├─ check_follow_ups      / 1h    ║
║  └─────────────────────┘  ║   ║  ├─ take_market_snapshot  / 24h   ║
║                           ║   ║  └─ update_resume_perf    / 6h    ║
║  Redis 7                  ║   ║                                   ║
║  db0 → Celery broker      ║   ║  Flower monitoring UI             ║
║  db1 → result backend     ║   ║  localhost:5555                   ║
╚═══════════════════════════╝   ╚═══════════════════════════════════╝
╔══════════════════════════════════════════════════════════════════════╗
║                       EXTERNAL SERVICES                              ║
║  Groq API (llama3-70b-8192 · llama3-8b-8192 · text-embedding-*)      ║
║  Telegram Bot API · Gmail SMTP (aiosmtplib)                          ║
║  LinkedIn · Indeed · Internshala · Wellfound (Playwright/aiohttp)    ║
╚══════════════════════════════════════════════════════════════════════╝
```

### Data Flow — One Automation Cycle

```
Celery Beat (every 6h)
       │
       ▼
run_main_agent_cycle
       │
       ├──▶ scrape_linkedin_task  ─┐
       ├──▶ scrape_indeed_task    ─┤  parallel  ─▶  PostgreSQL (status=NEW)
       ├──▶ scrape_internshala_task─┤
       └──▶ scrape_wellfound_task ─┘
                                   │
                                   ▼
                    analyze_new_jobs_batch_task
                    │                         │
                    ▼ skill_match < 30%        ▼ skill_match ≥ 30%
               rule-based score          heavy LLM analysis
               (skip tokens)            (match_score 0–100)
                                         │
                    ┌────────────────────┘ match ≥ threshold
                    ▼
       generate_resume_task  ──┐
       generate_cover_letter_task│  parallel (queue: ai)
                               ─┘
                                │
                                ▼
            AUTO_APPLY_REQUIRE_APPROVAL?
                    │
              Yes   ├──▶ Telegram notification → user approves
              No    └──▶ directly queue
                                │
                                ▼
                       auto_apply_task (Playwright)
                       ATS detection → form fill → submit
                                │
                                ▼
                   ApplicationEvent logged + notifications sent
```

### Security Architecture

```
Client Request
      │
      ▼
JWT Validation (HS256 · 24h expiry)
      │
      ▼
FastAPI Route Handler
      │
      ├──▶ Credential access?
      │         │
      │         ▼
      │    CredentialVault (AES-256-GCM)
      │    Key derived via PBKDF2-HMAC-SHA256
      │    (100,000 iterations · static salt)
      │         │
      │         ▼
      │    Plaintext in memory only
      │    (never persisted)
      │
      └──▶ Sensitive operation?
                │
                ▼
           AuditLog (append-only, immutable)
           UserConsent check (GDPR Art. 7)
```

---

## Agent Pipeline

The central automation cycle runs every 6 hours via `run_main_agent_cycle`. Each stage is a discrete Celery task with full `AgentTask` audit logging and exponential-backoff retry on failure.

### Stage 1 — Job Discovery (`queue: scraping`)

Four scrapers run in parallel. Each extends `BaseScraper`, which handles polite rate limiting (2–6 s random delay between requests), deduplication by `source_job_id`, HTML cleaning via BeautifulSoup, and batch persistence to PostgreSQL.

| Scraper | Module | Auth mechanism | Rate limit |
|---|---|---|---|
| `LinkedInScraper` | `scrapers/linkedin.py` | Saved Playwright session (`linkedin_session.json`) | 10 req/min |
| `IndeedScraper` | `scrapers/indeed.py` | Optional credentials | 20 req/min |
| `IntershalaScraper` | `scrapers/internshala.py` | Email/password login | default |
| `WellfoundScraper` | `scrapers/wellfound.py` | Unauthenticated | default |

All new jobs are stored with `status = NEW`. Duplicates (same `source` + `source_job_id`) are silently skipped via `INSERT ... ON CONFLICT DO NOTHING`.

### Stage 2 — AI Analysis (`queue: ai`)

A two-tier pipeline in `services/job_analyzer.py` runs on every `NEW` job.

**Tier 1 — Light model** (`llama3-8b-8192`) — fast, cheap, runs on all jobs

Extracts structured JSON: `required_skills`, `preferred_skills`, `tech_stack`, `ats_keywords`, `key_responsibilities`, `role_category`, `seniority_detected`, `is_internship`, `job_difficulty`, and a 2-sentence `ai_summary`.

**Tier 2 — Heavy model** (`llama3-70b-8192`) — deep match scoring, runs only when `skill_match ≥ 30%`

Computes: `match_score` (0–100), `skill_match_score`, `experience_match_score`, `matching_skills`, `missing_skills`, `skill_gap_count`, `competition_level`, `interview_probability`, `priority_score`, and a personalised `ai_recommendation` string. Falls back to rule-based scoring for weak matches to avoid wasting tokens.

Job status advances to `ANALYZED`. Jobs below `AUTO_APPLY_MATCH_THRESHOLD` are not queued.

### Stage 3 — Material Generation (`queue: ai`)

For every job with `match_score >= AUTO_APPLY_MATCH_THRESHOLD`, two tasks fire in parallel:

- **`generate_resume_task`** (`services/resume_service.py`) — GPT-4o rewrites bullet points, injects ATS keywords, estimates an ATS score, and generates a PDF via WeasyPrint (ReportLab fallback). Saved as a `TAILORED` resume with version tracking.
- **`generate_cover_letter_task`** (`services/cover_letter_service.py`) — Writes a company-specific cover letter with configurable tone. Saved as a `CoverLetter` record linked to the job.

### Stage 4 — Auto-Apply (`queue: automation`)

If `AUTO_APPLY_REQUIRE_APPROVAL = true` (the default):

1. A Telegram notification is dispatched with job title, company, and match score.
2. Application status is set to `PENDING_APPROVAL`.
3. The bot waits for user approval via the Telegram inline keyboard.
4. On approval, status advances to `QUEUED` and `auto_apply_task` is dispatched.

`ApplyBot` (`agents/apply_bot.py`) detects the ATS platform from the job URL and dispatches to the appropriate handler:

| ATS | Detection pattern | Strategy |
|---|---|---|
| LinkedIn Easy Apply | `linkedin.com/jobs` | Multi-step form fill via Playwright |
| Greenhouse | `greenhouse.io` | File upload + submit |
| Lever | `lever.co` | File upload + submit |
| Indeed | `indeed.com` | No-login first; falls back to credential login |
| Internshala | `internshala.com` | Email/password login flow |
| Wellfound | `wellfound.com` | File upload + submit |
| Workday | `myworkdayjobs.com` | **Returns failure** — stub only (see Known Issues) |
| Generic | Any other URL | Pattern-match common form field selectors |

CAPTCHA detection resets status to `QUEUED` and sends a Telegram escalation alert.

### Stage 5 — Tracking & Notifications (`queue: notifications`)

- Updates `Application.status` in PostgreSQL.
- Logs an immutable `ApplicationEvent` (timestamp, trigger source, metadata).
- Sends Telegram notification and email digest of cycle results.

---

## Application Lifecycle (FSM)

Every application passes through a well-defined finite state machine. Every transition is recorded as an immutable `ApplicationEvent` in PostgreSQL.

```
NEW JOB MATCHED
      │
      ▼
PENDING_APPROVAL ────── user skips ────────────────────────► SKIPPED
      │ user approves / auto-queue
      ▼
   QUEUED ◄──────────────────────── Celery automation queue
      │ bot picks up
      ▼
  APPLYING ─────── error / CAPTCHA ──────────────────────► FAILED
      │                                                    (retry ×3, expback)
      │ submitted
      ▼
  APPLIED
      │ recruiter opens
      ▼
  VIEWED ──────── no progression ────────────────────────► REJECTED
      │ shortlisted
      ▼
SHORTLISTED
      │ interview scheduled
      ▼
INTERVIEW_SCHEDULED
      │ interview held
      ▼
INTERVIEW_COMPLETED
      ├─ offer extended ─────────────────────────────────► OFFER_RECEIVED
      │                                                         │
      │                                                    ├── accept ──► OFFER_ACCEPTED
      │                                                    └── decline ─► OFFER_DECLINED
      └─ rejected post-interview ──────────────────────► REJECTED

(any state) ── user action ──────────────────────────────────────────► WITHDRAWN
```

`ApplicationMethod` enum values: `AUTO_BOT` · `EASY_APPLY` · `MANUAL` · `EMAIL`

---

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── apply_bot.py              # Playwright ATS detection + form fill
│   │   │   ├── tasks.py                  # Celery task definitions, Beat schedule, queue routing
│   │   │   └── scrapers/
│   │   │       ├── base.py               # Rate limiting, dedup, DB persistence
│   │   │       ├── linkedin.py           # Session-authenticated scraper
│   │   │       ├── indeed.py
│   │   │       ├── internshala.py
│   │   │       └── wellfound.py
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── auth.py               # JWT register / login / me
│   │   │       ├── jobs.py               # Job feed: list, filter, get, trigger analysis
│   │   │       ├── profile.py            # Profile CRUD + skill management
│   │   │       ├── security.py           # Credentials, consents, data export/delete, audit
│   │   │       ├── onboarding.py         # 8-step onboarding flow
│   │   │       └── routes.py             # Applications, resumes, cover letters, agent, analytics, chat
│   │   ├── core/
│   │   │   ├── config.py                 # Pydantic Settings — .env loading, JSON list parsing
│   │   │   └── database.py               # Async engine, session factory, get_db dependency
│   │   ├── models/
│   │   │   ├── base.py                   # UUIDMixin, TimestampMixin, SoftDeleteMixin
│   │   │   ├── user.py                   # User, UserProfile, UserSkill
│   │   │   ├── job.py                    # Job, JobAnalysis, all job enums
│   │   │   ├── application.py            # Application FSM, ApplicationEvent, ApplicationMethod
│   │   │   ├── resume.py                 # Resume, CoverLetter
│   │   │   ├── interview.py              # Interview, MockInterviewSession, AgentTask,
│   │   │   │                             #   Notification, SkillGap, MarketSnapshot,
│   │   │   │                             #   LearningPlan, GeneratedProject, Recruiter
│   │   │   ├── credential.py             # CredentialVault (AES-256-GCM), CredentialUseLog
│   │   │   ├── audit.py                  # AuditLog (immutable, append-only)
│   │   │   └── consent.py                # UserConsent, ConsentVersion (GDPR Article 7)
│   │   ├── services/
│   │   │   ├── ai_assistant.py           # Chat: context builder, intent detection, action dispatch
│   │   │   ├── application_service.py    # Application CRUD, status transitions, batch queue
│   │   │   ├── cover_letter_service.py   # GPT-4o cover letter generation
│   │   │   ├── encryption.py             # AES-256-GCM via PBKDF2-HMAC-SHA256
│   │   │   ├── follow_up_service.py      # Scheduled 7-day recruiter follow-up emails
│   │   │   ├── interview_service.py      # Company report, Q&A bank, mock sessions, Whisper analysis
│   │   │   ├── job_analyzer.py           # Dual-model LLM pipeline, match scoring, skill gap
│   │   │   ├── market_service.py         # Skill demand, salary trends, hiring velocity snapshots
│   │   │   ├── notification_service.py   # Telegram Bot API + aiosmtplib SMTP dispatch
│   │   │   ├── onboarding_service.py     # 8-step profile population workflow
│   │   │   ├── overleaf_service.py       # LaTeX resume generation
│   │   │   ├── resume_service.py         # GPT-4o tailoring, ATS keyword injection, PDF (WeasyPrint)
│   │   │   └── screening_question_service.py  # AI-answered application screening questions
│   │   ├── schemas/
│   │   │   └── __init__.py               # ⚠ Pydantic v2 schemas (currently empty — see Known Issues)
│   │   ├── utils/
│   │   │   └── helpers.py
│   │   └── main.py                       # FastAPI app factory, router registration, lifespan
│   ├── alembic/
│   │   └── versions/
│   │       ├── 6df4ff846734_initial.py   # Full schema baseline
│   │       └── security_models_001.py    # Credential vault + consent + audit tables
│   ├── storage/                          # Local file storage (resumes, cover letters, recordings)
│   ├── session.py                        # LinkedIn one-time session saver
│   ├── .env.example
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── setup.bat                         # Windows: first-time setup
│   └── start_platform.bat                # Windows: service launcher
├── frontend/
│   ├── src/
│   │   ├── app/                          # Next.js App Router pages
│   │   │   ├── dashboard/ · jobs/ · applications/ · resumes/
│   │   │   ├── cover-letters/ · interviews/ · analytics/
│   │   │   ├── agent/ · chat/ · settings/ · login/ · register/
│   │   ├── components/
│   │   │   ├── layout/                   # DashboardLayout, Sidebar, TopNavbar, Logo
│   │   │   └── ui/                       # StatsCard, Button, Card, Badge, Input, etc.
│   │   ├── hooks/
│   │   │   └── useApi.ts
│   │   ├── services/
│   │   │   └── api.ts                    # Axios clients for all backend endpoints
│   │   ├── types/
│   │   │   └── index.ts                  # TypeScript domain interfaces
│   │   └── lib/
│   │       ├── utils.ts
│   │       └── sampleData.ts
│   ├── package.json
│   ├── tailwind.config.ts
│   └── tsconfig.json
└── docs/
    ├── RENDER_DEPLOYMENT.md
    └── SECURITY_ONBOARDING_PLAN.md
```

---

## Prerequisites

| Dependency | Minimum version | Role |
|---|---|---|
| Python | 3.11 | Backend runtime |
| PostgreSQL | 15 | Primary relational datastore |
| Redis | 7 | Celery broker (`db0`) and result backend (`db1`) |
| Node.js | 18 | Next.js frontend |
| Playwright / Chromium | 1.44 | Browser automation for auto-apply and LinkedIn scraping |

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/Sudharsanselvaraj/Distributed-Autonomous-Opportunity-Intelligence-and-Strategic-Application-Orchestration-System.git
cd Distributed-Autonomous-Opportunity-Intelligence-and-Strategic-Application-Orchestration-System
```

### 2. Backend — Python virtual environment

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate          # Linux / macOS
# venv\Scripts\activate           # Windows

# Install Python dependencies
pip install -r requirements.txt

# Install Playwright browser
playwright install chromium
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and set the following **required** values at minimum:

```env
# Security (generate with: openssl rand -hex 32)
SECRET_KEY=<32-char-minimum-random-hex>
JWT_SECRET_KEY=<32-char-minimum-random-hex>
ENCRYPTION_KEY=<32-char-minimum-random-hex>

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/applivo
DATABASE_URL_SYNC=postgresql://user:pass@localhost:5432/applivo

# Groq API key (OpenAI-compatible — used as OPENAI_API_KEY)
OPENAI_API_KEY=gsk-...
OPENAI_MODEL_HEAVY=llama3-70b-8192
OPENAI_MODEL_LIGHT=llama3-8b-8192

# Your career profile (directly injected into every AI prompt)
USER_NAME="Your Name"
USER_EMAIL=your@email.com
USER_DESIRED_ROLES=["ML Engineer","Computer Vision Engineer"]
```

See [Configuration Reference](#configuration-reference) for all available variables.

### 4. Provision and migrate the database

```bash
# Create database
psql -U postgres -c "CREATE DATABASE applivo;"

# Run all Alembic migrations
alembic upgrade head
```

### 5. LinkedIn session setup (optional but recommended)

LinkedIn scraping works best with an authenticated Playwright session. Run the one-time session saver, which opens a browser window — log in manually, then close it:

```bash
python session.py
# Writes linkedin_session.json to backend/ root
```

The scraper loads cookies from this file on every run. If the file is absent, scraping falls back to unauthenticated (public) access with reduced rate limits.

### 6. Start all services

**Linux / macOS — four terminal sessions:**

```bash
# Terminal 1 — FastAPI application server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Celery workers (all 4 queues, 4 concurrent processes)
celery -A app.agents.tasks.celery_app worker \
  --loglevel=info \
  -Q scraping,ai,automation,notifications \
  --concurrency=4

# Terminal 3 — Celery Beat periodic scheduler
celery -A app.agents.tasks.celery_app beat --loglevel=info

# Terminal 4 — Flower monitoring dashboard (optional)
celery -A app.agents.tasks.celery_app flower --port=5555
```

**Windows — automated scripts:**

```bat
setup.bat           # First-time: install deps, create directories, run migrations
start_platform.bat  # Start all services in sequence
```

### 7. Frontend

```bash
cd frontend
npm install
npm run dev       # Development server → http://localhost:3000
```

### 8. Register your account and obtain a JWT

```bash
# Create account
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "yourpassword", "full_name": "Your Name"}'

# Authenticate and retrieve token
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "yourpassword"}'
# → { "access_token": "<JWT>", "token_type": "bearer" }

# Store token for subsequent requests
export TOKEN="<JWT>"
```

### 9. Service endpoints

| Service | URL | Notes |
|---|---|---|
| Next.js dashboard | `http://localhost:3000` | Main UI |
| Swagger UI | `http://localhost:8000/api/docs` | Interactive API docs |
| ReDoc | `http://localhost:8000/api/redoc` | API reference |
| Health check | `http://localhost:8000/health` | Liveness probe |
| Celery Flower | `http://localhost:5555` | Queue and worker monitor |

---

## Configuration Reference

All configuration is loaded from `backend/.env` via Pydantic Settings. Copy `backend/.env.example` as a starting point. All values without defaults are **required**.

### Application

```env
APP_NAME="AI Career Platform"
APP_ENV=development          # development | staging | production
APP_HOST=0.0.0.0
APP_PORT=8000
DEBUG=true
SECRET_KEY=<min-32-chars>    # ⚠ In production, also add ALLOWED_ORIGINS (see Known Issues)
```

### Database

```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/applivo
DATABASE_URL_SYNC=postgresql://user:pass@localhost:5432/applivo
```

### Task queue (Redis)

```env
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1   # Separate DB to avoid key collision
```

### AI layer (Groq)

> **Important:** The service clients in `job_analyzer.py` and `resume_service.py` hard-code `base_url="https://api.groq.com/openai/v1"`. Model names must be valid **Groq** identifiers, not OpenAI model names.

```env
OPENAI_API_KEY=gsk-...                        # Groq API key
OPENAI_MODEL_HEAVY=llama3-70b-8192            # Deep analysis, resume/cover letter generation
OPENAI_MODEL_LIGHT=llama3-8b-8192             # Fast batch scoring, chat
OPENAI_EMBEDDING_MODEL=text-embedding-3-small # Profile/job semantic vectorisation
OPENAI_MAX_TOKENS=4096
OPENAI_TEMPERATURE=0.3
```

### Vector store (ChromaDB)

```env
CHROMA_HOST=localhost
CHROMA_PORT=8001
CHROMA_COLLECTION_USER_PROFILE=user_profile
CHROMA_COLLECTION_JOBS=jobs
CHROMA_COLLECTION_RESUMES=resumes
```

### Notifications

```bash
# Telegram: create a bot via @BotFather; get your chat ID via @userinfobot
TELEGRAM_BOT_TOKEN=<your-bot-token>
TELEGRAM_CHAT_ID=<your-chat-id>

# Gmail App Password (not your account password — generate at myaccount.google.com/apppasswords)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your@gmail.com
SMTP_PASSWORD=<app-specific-password>
SMTP_FROM_EMAIL=your@gmail.com
SMTP_FROM_NAME="AI Career Agent"
```

### User profile

This profile is injected verbatim into every AI prompt. Accuracy directly determines match quality.

```env
USER_NAME="Your Name"
USER_EMAIL=your@email.com
USER_PHONE=+91-XXXXXXXXXX
USER_LOCATION="Chennai, India"
USER_DESIRED_ROLES=["ML Engineer","Computer Vision Engineer","AI Research Intern"]
USER_DESIRED_LOCATIONS=["Remote","Bangalore","Hyderabad","Europe","USA"]
USER_EXPERIENCE_LEVEL=entry     # entry | mid | senior
USER_OPEN_TO_REMOTE=true
USER_MIN_SALARY=0
```

### Job scraping

```env
SCRAPE_INTERVAL_HOURS=6         # How often the main agent cycle fires
MAX_JOBS_PER_CYCLE=200
SCRAPE_DELAY_MIN_SECONDS=2.0    # Polite rate limiting between requests
SCRAPE_DELAY_MAX_SECONDS=6.0

LINKEDIN_EMAIL=your-linkedin@email.com
LINKEDIN_PASSWORD=your-linkedin-password
INTERNSHALA_EMAIL=your-internshala@email.com
INTERNSHALA_PASSWORD=your-internshala-password
INDEED_EMAIL=your-indeed@email.com
INDEED_PASSWORD=your-indeed-password
```

### Auto-apply

> **Auto-apply is disabled by default.** Review all settings carefully before enabling.

```env
AUTO_APPLY_ENABLED=false
AUTO_APPLY_MATCH_THRESHOLD=75     # Only queue jobs with match_score ≥ this value (0–100)
AUTO_APPLY_DAILY_LIMIT=10         # Hard daily ceiling on automated submissions
AUTO_APPLY_REQUIRE_APPROVAL=true  # Telegram approval gate before every submission (recommended)
```

### Storage

```env
STORAGE_BACKEND=local
LOCAL_STORAGE_PATH=./storage

# Optional S3-compatible (leave blank to use local)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET_NAME=applivo-files
AWS_REGION=us-east-1
```

### Security keys

```env
JWT_SECRET_KEY=<min-32-chars>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440   # 24 hours

ENCRYPTION_KEY=<min-32-chars>          # Master key for AES-256-GCM credential vault
```

Generate cryptographically secure values:

```bash
openssl rand -hex 32
```

---

## API Reference

Full interactive documentation is served at `/api/docs` (Swagger UI) and `/api/redoc`. All endpoints require `Authorization: Bearer <token>` except `/api/auth/register` and `/api/auth/login`.

### Router overview

| Router | Prefix | Key endpoints |
|---|---|---|
| Auth | `/api/auth` | `POST /register`, `POST /login`, `GET /me` |
| Jobs | `/api/jobs` | `GET /`, `GET /{id}`, `POST /{id}/analyze`, `POST /{id}/skip` |
| Applications | `/api/applications` | `GET /`, `POST /`, `GET /stats`, `PATCH /{id}/status`, `POST /{id}/approve` |
| Resumes | `/api/resumes` | `GET /`, `POST /upload`, `POST /generate`, `PATCH /{id}/set-default` |
| Cover Letters | `/api/cover-letters` | `GET /`, `POST /generate` |
| Agent | `/api/agent` | `GET /status`, `GET /tasks`, `POST /run`, `POST /pause` |
| Analytics | `/api/analytics` | `GET /dashboard`, `GET /market`, `GET /skill-gaps`, `GET /resume-performance` |
| Chat | `/api/chat` | `POST /` |
| Profile | `/api/profile` | `GET /`, `PATCH /`, `/skills` CRUD |
| Security | `/api/security` | `/credentials`, `/consents`, `/data/export`, `/data/delete`, `/audit` |
| Onboarding | `/api/onboarding` | `GET /status`, `POST /complete`, `POST /profile` |

### Job filtering (`GET /api/jobs`)

| Parameter | Type | Values |
|---|---|---|
| `source` | string | `linkedin` · `indeed` · `internshala` · `wellfound` · `manual` |
| `job_type` | string | `full_time` · `internship` · `contract` · `part_time` |
| `work_mode` | string | `remote` · `onsite` · `hybrid` |
| `min_match_score` | float | 0–100 |
| `keyword` | string | Full-text search across title, company, description |
| `status` | string | `new` · `analyzed` · `queued` · `applied` · `skipped` |
| `sort_by` | string | `match_score` · `priority_score` · `posted_at` · `created_at` |
| `page` | int | Default: 1 |
| `page_size` | int | Default: 20, max: 100 |

### Usage examples

```bash
export TOKEN="your-jwt-token"

# Trigger a manual scrape-and-analyze cycle
curl -X POST http://localhost:8000/api/agent/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task_type": "scrape_jobs"}'

# List top-matched remote jobs (score ≥ 80)
curl "http://localhost:8000/api/jobs?min_match_score=80&work_mode=remote&sort_by=match_score" \
  -H "Authorization: Bearer $TOKEN"

# Generate a tailored resume for a specific job
curl -X POST http://localhost:8000/api/resumes/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"job_id": "<uuid>", "base_resume_id": "<uuid>"}'

# Approve a pending application (triggers auto_apply_task)
curl -X POST http://localhost:8000/api/applications/<uuid>/approve \
  -H "Authorization: Bearer $TOKEN"

# Chat with the AI assistant
curl -X POST http://localhost:8000/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Find AI internships in Europe and apply to the top 3 matches", "conversation_history": []}'

# Fetch dashboard analytics
curl http://localhost:8000/api/analytics/dashboard \
  -H "Authorization: Bearer $TOKEN"

# Export all personal data (GDPR)
curl -X POST http://localhost:8000/api/security/data/export \
  -H "Authorization: Bearer $TOKEN"
```

---

## Automation Schedule

All periodic tasks are registered in Celery Beat via `beat_schedule` in `app/agents/tasks.py`. No external cron daemon is required.

| Task | Interval | Queue | Description |
|---|---|---|---|
| `run_main_agent_cycle` | Every 6 hours | scraping → ai → automation | Full pipeline: discover → analyse → generate → apply → notify |
| `check_follow_ups` | Every 1 hour | notifications | 7-day recruiter follow-ups; post-interview thank-you emails |
| `take_market_snapshot` | Daily | ai | Aggregate skill demand, salary trends, hiring velocity |
| `update_resume_performance` | Every 6 hours | ai | Recalculate response rates per resume version |

### Queue configuration and rate limits

| Task pattern | Queue | Rate limit |
|---|---|---|
| `scrape_linkedin_task` | scraping | 10 / min |
| `scrape_indeed_task` | scraping | 20 / min |
| `scrape_internshala_task`, `scrape_wellfound_task` | scraping | default |
| `analyze_*`, `generate_*` | ai | default |
| `auto_apply_task` | automation | 5 / min |
| `send_*`, `check_follow_ups` | notifications | default |

**Retry policy (all tasks):** `max_retries = 3`, exponential backoff (`countdown = 60 * (retries + 1)`), `task_acks_late = true`, `task_reject_on_worker_lost = true`, `result_expires = 86400 s`.

---

## Security

### Authentication

All API endpoints require a JWT Bearer token signed with HS256. Tokens expire after 24 hours. Passwords are hashed with bcrypt (inputs truncated to 72 bytes per bcrypt specification).

### Credential encryption

Platform credentials (LinkedIn password, API keys, etc.) are encrypted at rest using **AES-256-GCM** with a key derived via **PBKDF2-HMAC-SHA256** (100,000 iterations). The encrypted blob is stored in the `credential_vaults` table. Plaintext credentials are never persisted to disk.

### GDPR compliance

- `UserConsent` tracks granted and revoked consents with policy version, IP address, and user-agent at time of consent, per GDPR Article 7.
- Users can export their full data as JSON via `POST /api/security/data/export`.
- Deletion requests are accepted via `POST /api/security/data/delete` and processed within a 30-day window.

### Audit logging

All sensitive operations are appended to the immutable `audit_logs` table: credential stored/deleted, consent granted/revoked, data export/delete requested, login success/failure, and rate limiting events.

### Auto-apply safeguards

Three independent controls limit exposure when auto-apply is enabled:

1. **Human-in-the-loop gate** — Telegram approval required before each submission (`AUTO_APPLY_REQUIRE_APPROVAL=true`)
2. **Daily hard limit** — Hard ceiling on submissions per calendar day (`AUTO_APPLY_DAILY_LIMIT`)
3. **Match threshold gate** — Only jobs scoring above the threshold are queued (`AUTO_APPLY_MATCH_THRESHOLD`)

---

## Known Issues

The following are active bugs or limitations. PRs addressing these are welcome — see [Roadmap](#roadmap) for prioritisation.

### Schemas module is empty — **critical, blocks startup**

`app/schemas/__init__.py` does not define any Pydantic v2 models, but routes import many from it (`ApplicationCreate`, `UserOut`, `ChatMessage`, etc.). These must be defined before the application will start. **This is the highest-priority fix for new contributors.**

### API client hard-coded to Groq

`job_analyzer.py` and `resume_service.py` hard-code `base_url="https://api.groq.com/openai/v1"` in the OpenAI client constructor. Model names in `.env` must be valid Groq identifiers (e.g. `llama3-70b-8192`). Using OpenAI model names will cause `404` API errors.

### Attribute name mismatches in `ai_assistant.py`

The context builder references `Application.job_title` and `Application.company_name`, but the model defines these as `job_title_snapshot` and `company_snapshot`. It also references `Resume.filename`, which does not exist (the actual field is `file_path`). Both raise `AttributeError` at runtime.

### CORS origin extraction in production

In non-development environments, allowed CORS origins are parsed by splitting `SECRET_KEY` on commas — a misuse of the secret key field. Add a dedicated `ALLOWED_ORIGINS` environment variable and update the CORS middleware logic in `app/main.py` before deploying.

### Workday ATS support is a stub

`ApplyBot._apply_workday()` returns an immediate failure. Workday is among the most common enterprise ATS platforms and requires account pre-creation. A stored Workday credential + login flow is required to support these jobs.

### Frontend/backend contract gaps

Several API calls in `frontend/src/services/api.ts` target endpoints that do not exist in the backend (`/api/analytics/stats`, `/api/analytics/activity`, `/api/agent/logs`, `/api/chat/conversations`, `/api/settings`). Application creation also sends camelCase field names where the backend expects snake_case.

### Static PBKDF2 salt

`EncryptionService._derive_key()` uses a fixed salt (`b"career_platform_v1"`). This is acceptable for a single-user deployment but important to understand — all instances on the same machine with the same `ENCRYPTION_KEY` derive the same encryption key.

---

## Tech Stack

| Layer | Technology | Version | Role |
|---|---|---|---|
| Web framework | FastAPI | 0.111.0 | REST API, async request handling |
| ASGI server | Uvicorn | 0.30.1 | High-performance async server |
| ORM | SQLAlchemy (async) | 2.0.30 | Async database access via asyncpg |
| Database | PostgreSQL | 15+ | Primary relational datastore |
| Migrations | Alembic | 1.13.1 | Schema version control |
| Task queue | Celery | 5.4.0 | Distributed task execution |
| Message broker | Redis | 5.0.4 | Celery broker (db0) and result backend (db1) |
| Queue monitor | Flower | 2.0.1 | Celery monitoring dashboard |
| LLM API | Groq (OpenAI-compatible) | openai 1.30.1 | Job analysis, resume/cover letter gen, chat |
| Embeddings | text-embedding-3-small | openai 1.30.1 | Semantic profile/job vectorisation |
| Audio transcription | OpenAI Whisper | 20231117 | Interview recording transcription |
| LLM orchestration | LangChain | 0.2.1 | Prompt chaining, RAG retrieval |
| Vector store | ChromaDB | 0.5.0 | Semantic memory for profile, jobs, resumes |
| Browser automation | Playwright | 1.44.0 | Chromium-based auto-apply bot + LinkedIn session |
| Async HTTP | httpx | 0.27.0 | Non-blocking HTTP requests |
| Scraping | aiohttp + BeautifulSoup4 + lxml | — | HTML parsing and concurrent requests |
| Telegram | python-telegram-bot | 21.2 | Bot API, inline keyboards for approval gate |
| Email | aiosmtplib | 3.0.1 | Async SMTP dispatch |
| Email templates | Jinja2 | 3.1.4 | HTML email rendering |
| PDF generation | WeasyPrint | 62.1 | CSS-to-PDF resume rendering |
| PDF fallback | ReportLab | 4.2.0 | Programmatic PDF construction |
| JWT | python-jose | 3.3.0 | JWT signing and verification |
| Password hashing | passlib + bcrypt | 1.7.4 / 3.2.2 | Secure password storage |
| Encryption | cryptography | 42.0.8 | AES-256-GCM for credential vault |
| Schema validation | Pydantic v2 | 2.7.1 | Request/response validation |
| Settings | pydantic-settings | 2.3.0 | `.env` loading with type coercion |
| Structured logging | structlog | 24.1.0 | JSON-structured log output |
| Retry logic | tenacity | 8.3.0 | Exponential backoff on transient failures |
| User agent rotation | fake-useragent | 1.5.1 | Scraper bot detection avoidance |
| Frontend | Next.js | 18+ | Dashboard UI (App Router) |
| Styling | TailwindCSS | 3+ | Utility-first CSS framework |

---

## Roadmap

**Critical (blocks production use):**
- [ ] Define all Pydantic v2 schemas in `app/schemas/__init__.py`
- [ ] Fix `ai_assistant.py` attribute name mismatches (`job_title_snapshot`, `company_snapshot`, `file_path`)
- [ ] Add dedicated `ALLOWED_ORIGINS` config variable and update CORS middleware for production

**High priority:**
- [ ] Implement Workday ATS support (credential-based login flow)
- [ ] Align frontend API client field names with backend snake_case contract
- [ ] Fix missing frontend endpoints (`/api/analytics/stats`, `/api/agent/logs`, etc.)

**Medium priority:**
- [ ] Docker Compose deployment configuration
- [ ] Test suite coverage for agent pipeline and service layer
- [ ] S3 storage backend for resume and recording artefacts
- [ ] Glassdoor scraper integration
- [ ] Webhook support for ATS status callbacks (Greenhouse, Lever)

**Low priority / future:**
- [ ] LangSmith tracing integration for LLM observability
- [ ] Salary negotiation assistant powered by market snapshot data
- [ ] Multi-user support with per-user agent isolation
- [ ] Per-user PBKDF2 salt (replace static salt in `EncryptionService`)

---

## Contributing

Contributions are welcome. Please open an issue to discuss proposed changes before submitting a pull request. Ensure all new code includes type annotations, follows the existing async patterns (use `async def` for all I/O-bound operations), and passes the existing test suite.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

Built by [Sudharsan Selvaraj](https://github.com/Sudharsanselvaraj)
