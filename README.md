<div align="center">

# Applivo-Distributed-Opportunity-Application-Orchestration-System

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7+-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)
[![Celery](https://img.shields.io/badge/Celery-5.4-37814A?style=for-the-badge&logo=celery&logoColor=white)](https://docs.celeryq.dev)
[![Playwright](https://img.shields.io/badge/Playwright-1.44-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-0.5-FF6F00?style=for-the-badge)](https://trychroma.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

**A personal AI career automation platform that autonomously discovers job opportunities, generates tailored application materials, submits applications through browser automation, tracks the full application lifecycle, and orchestrates interview preparation — all through a distributed background agent system.**

[Overview](#overview) · [Architecture](#system-architecture) · [Agent Pipeline](#agent-pipeline) · [Application Lifecycle](#application-lifecycle) · [Database Schema](#database-schema) · [Core Modules](#core-modules) · [Quick Start](#quick-start) · [Configuration](#configuration) · [API Reference](#api-reference) · [Automation Schedule](#automation-schedule) · [Security](#security) · [Tech Stack](#tech-stack) · [Roadmap](#roadmap)

</div>

---

## Overview

D.A.O.I.S.A.O.S is a **distributed, AI-powered career automation platform** designed for single-user personal deployment. Once configured, it operates entirely in the background — continuously scraping job boards across multiple platforms, scoring each opportunity against your career profile through a dual-model LLM pipeline, generating ATS-optimised resumes and cover letters, submitting applications via a Playwright browser agent, and delivering real-time notifications through Telegram and email.

The platform is built around three core principles:

**Autonomy** — The platform runs on a self-scheduling Celery Beat loop. Every decision point (scrape, score, generate, submit) is fully automated and logged as an auditable `AgentTask` record with exponential-backoff retry on failure.

**Intelligence** — Two OpenAI models operate in tandem. `GPT-4o-mini` handles high-volume, low-cost operations: batch job filtering, match scoring, and chat responses. `GPT-4o` is reserved for deep, high-value work: full job description analysis, resume tailoring, cover letter generation, and interview preparation. A ChromaDB vector store holds semantic embeddings of your profile, past applications, and recruiter interactions, enabling RAG-based personalisation across all AI calls.

**Safety** — Auto-apply is disabled by default. When enabled, every application first passes through a configurable human-in-the-loop gate: a Telegram notification is dispatched to the user, and the bot waits for explicit approval before submitting. A daily application limit and a minimum match-score threshold provide additional safeguards.

---

## System Architecture

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                          PRESENTATION LAYER                                 │
 │                       Next.js · TailwindCSS                                 │
 │  ┌───────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────┐  ┌────────┐  │
 │  │ Job Feed  │  │ Resumes  │  │  Tracker  │  │ Interview    │  │  Chat  │  │
 │  │           │  │          │  │           │  │ Prep         │  │        │  │
 │  └───────────┘  └──────────┘  └───────────┘  └──────────────┘  └────────┘  │
 └──────────────────────────────────┬──────────────────────────────────────────┘
                                    │  HTTPS / JWT Bearer
 ┌──────────────────────────────────▼──────────────────────────────────────────┐
 │                          APPLICATION LAYER                                  │
 │                   FastAPI · Uvicorn · SQLAlchemy asyncpg                    │
 │  ┌────────┐ ┌───────┐ ┌──────────────┐ ┌──────────┐ ┌─────────┐ ┌───────┐  │
 │  │ /auth  │ │ /jobs │ │ /applications│ │ /resumes │ │ /agent  │ │ /chat │  │
 │  └────────┘ └───────┘ └──────────────┘ └──────────┘ └─────────┘ └───────┘  │
 └──────────────────┬───────────────────────────────┬────────────────────────--┘
       SQLAlchemy   │                               │  Celery .delay()
 ┌─────────────────-▼──────────────┐   ┌────────────▼──────────────────────────┐
 │           DATA LAYER            │   │            WORKER LAYER               │
 │                                 │   │                                       │
 │  ┌──────────────────────────┐   │   │   ┌───────────────────────────────┐   │
 │  │      PostgreSQL 15+      │   │   │   │        Celery Workers         │   │
 │  │                          │   │   │   │                               │   │
 │  │  users · user_profiles   │   │   │   │  queue: scraping              │   │
 │  │  user_skills · jobs      │   │   │   │    LinkedIn · Indeed          │   │
 │  │  job_analyses · resumes  │   │◄──┤   │    Internshala · Wellfound    │   │
 │  │  applications · events   │   │   │   │                               │   │
 │  │  interviews · agent_tasks│   │   │   │  queue: ai                    │   │
 │  │  credential_vaults       │   │   │   │    Analysis · Resume gen      │   │
 │  └──────────────────────────┘   │   │   │    Cover letters              │   │
 │                                 │   │   │                               │   │
 │  ┌──────────────────────────┐   │   │   │  queue: automation            │   │
 │  │    ChromaDB 0.5          │   │   │   │    Playwright ApplyBot        │   │
 │  │                          │   │   │   │                               │   │
 │  │  user_profile embeddings │   │   │   │  queue: notifications         │   │
 │  │  jobs · resumes          │   │   │   │    Telegram · SMTP email      │   │
 │  │  recruiter interactions  │   │   │   │                               │   │
 │  │  RAG retrieval           │   │   │   │  ┌─────────────────────────┐  │   │
 │  └──────────────────────────┘   │   │   │  │       Redis 7           │  │   │
 └─────────────────────────────────┘   │   │  │  broker db0 · result db1│  │   │
                                       │   │  └─────────────────────────┘  │   │
                                       │   └───────────────────────────────────┘
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                          EXTERNAL SERVICES                                  │
 │  ┌─────────────────────────┐  ┌──────────────────────┐  ┌────────────────┐  │
 │  │       OpenAI API        │  │    Notifications     │  │ Job Platforms  │  │
 │  │  GPT-4o  deep analysis  │  │  Telegram Bot API    │  │ LinkedIn       │  │
 │  │  GPT-4o-mini  scoring   │  │  Inline keyboards    │  │ Indeed         │  │
 │  │  text-embed-3s vectors  │  │  SMTP (Gmail)        │  │ Internshala    │  │
 │  │  Whisper transcription  │  │  Jinja2 templates    │  │ Wellfound      │  │
 │  │  LangChain · RAG        │  │  Follow-up dispatch  │  │ Glassdoor      │  │
 │  └─────────────────────────┘  └──────────────────────┘  └────────────────┘  │
 └─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Pipeline

The central automation cycle runs every 6 hours via `run_main_agent_cycle`. Each stage is a discrete Celery task with full `AgentTask` audit logging and exponential-backoff retry on failure.

```
                    ┌─────────────────────────────┐
                    │  Celery Beat — every 6 hours │
                    └──────────────┬──────────────┘
                                   │
 ──────────────────────────────────▼──────────────────────────────────────────
  STAGE 1 · JOB DISCOVERY                              queue: scraping
 ──────────────────────────────────────────────────────────────────────────────
  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌─────────────┐
  │   LinkedIn     │  │    Indeed      │  │  Internshala   │  │  Wellfound  │
  │  Session auth  │  │  Optional cred │  │  Internships   │  │  Startups   │
  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘  └──────┬──────┘
          └───────────────────┴───────────────────┴──────────────────┘
                                          │
                              Dedup by source_job_id
                              Save NEW jobs → PostgreSQL (status = NEW)
                                          │
 ──────────────────────────────────────────────────────────────────────────────
  STAGE 2 · AI ANALYSIS & SCORING                      queue: ai
 ──────────────────────────────────────────────────────────────────────────────
  ┌─────────────────────────────────────┐
  │  Pass 1 — GPT-4o-mini  (~$0.001/job)│
  │  Input:  title · description        │
  │          USER_DESIRED_ROLES         │
  │  Output: preliminary_score (0–100)  │
  │          is_relevant (bool)         │
  │  Below threshold → SKIPPED ──────────────────────────────────────► EXIT
  └──────────────────┬──────────────────┘
                     │  score >= threshold
  ┌──────────────────▼──────────────────────────────────────────────┐
  │  Pass 2 — GPT-4o  (structured JSON output)                      │
  │  Extracts:  required_skills  preferred_skills  tech_stack        │
  │             ats_keywords  seniority  salary range  difficulty    │
  │  Computes:  match_score (0–100)  priority_score  skill_gaps      │
  │  → Persist JobAnalysis · status = ANALYZED                      │
  └──────────────────┬──────────────────────────────────────────────┘
                     │  match_score >= AUTO_APPLY_MATCH_THRESHOLD
 ──────────────────────────────────────────────────────────────────────────────
  STAGE 3 · MATERIAL GENERATION                        queue: ai  (parallel)
 ──────────────────────────────────────────────────────────────────────────────
  ┌──────────────────────────────┐   ┌──────────────────────────────────────┐
  │  Resume Engine (GPT-4o)      │   │  Cover Letter Generator (GPT-4o)     │
  │                              │   │                                      │
  │  Load base resume            │   │  Load company context                │
  │  Rewrite: summary · bullets  │   │  Generate: opening · alignment body  │
  │  Inject ATS keywords         │   │            company-specific closing  │
  │  Estimate ATS score          │   │  Configurable tone                   │
  │  Render to PDF (WeasyPrint)  │   │  Version-tracked record              │
  │  Version-tracked record      │   │  Attached to Application             │
  └──────────────────────────────┘   └──────────────────────────────────────┘
                                          │
 ──────────────────────────────────────────────────────────────────────────────
  STAGE 4 · AUTO-APPLY                                 queue: automation
 ──────────────────────────────────────────────────────────────────────────────
  ┌──────────────────────────────────────────────────────────────────┐
  │  if AUTO_APPLY_REQUIRE_APPROVAL = true                           │
  │                                                                  │
  │  → Send Telegram notification (job · company · match score)      │
  │  → status = PENDING_APPROVAL                                     │
  │  → Wait for inline Approve / Skip response                       │
  │  → On approve: status = QUEUED → Playwright bot runs            │
  └──────────────────────────────────────────────────────────────────┘

  Playwright ApplyBot — ATS detection from URL:
  ┌───────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────────┐
  │  Workday  │  │Greenhouse │  │  Lever   │  │LinkedIn EasyApply│
  └───────────┘  └───────────┘  └──────────┘  └──────────────────┘
  ┌───────────┐  ┌───────────┐
  │  Indeed   │  │Internshala│
  └───────────┘  └───────────┘

  Fill form → Upload resume PDF → Attach cover letter
  → Answer standard questions → Submit → Capture confirmation
  → CAPTCHA detected? → Pause → Telegram escalation → Await resolution
                                          │
 ──────────────────────────────────────────────────────────────────────────────
  STAGE 5 · TRACKING & NOTIFICATIONS                   queue: notifications
 ──────────────────────────────────────────────────────────────────────────────
  Update application status in PostgreSQL
  Log ApplicationEvent (timestamp · trigger source · metadata)
  Send Telegram + email digest of cycle results
```

---

## Application Lifecycle

Every application passes through a well-defined finite state machine. Every transition is recorded as an `ApplicationEvent` with a timestamp, trigger source (`agent` or `user`), and optional metadata.

```
  Job matched by AI
        │
        ▼
  ┌─────────────────────┐        User skips
  │   PENDING_APPROVAL  │──────────────────────────────────► SKIPPED
  │  Awaiting Telegram  │
  └──────────┬──────────┘
   User approves│
        ▼
  ┌─────────────────────┐
  │       QUEUED        │  ◄── Added to Celery automation queue
  └──────────┬──────────┘
   Bot picks up│
        ▼
  ┌─────────────────────┐        Error / CAPTCHA
  │      APPLYING       │──────────────────────────────────► FAILED
  └──────────┬──────────┘                                  (retry ×3)
   Submitted │
        ▼
  ┌─────────────────────┐
  │       APPLIED       │
  └──────────┬──────────┘
   Recruiter opens│
        ▼
  ┌─────────────────────┐        Not progressed
  │       VIEWED        │──────────────────────────────────► REJECTED
  └──────────┬──────────┘
   Shortlisted│
        ▼
  ┌─────────────────────┐
  │     SHORTLISTED     │
  └──────────┬──────────┘
   Interview scheduled│
        ▼
  ┌─────────────────────┐
  │ INTERVIEW_SCHEDULED │
  └──────────┬──────────┘
   Interview held│
        ▼
  ┌─────────────────────┐
  │ INTERVIEW_COMPLETED │
  └──────────┬──────────┘
             ├── Offer extended ──────────────────────────► OFFER_RECEIVED
             │                                                   │
             └── Rejected post-interview ──────────────► REJECTED  ├── Accept ──► OFFER_ACCEPTED
                                                                    └── Decline ─► OFFER_DECLINED

  (any state) ── User action ──────────────────────────────────────► WITHDRAWN

  ApplicationMethod:  AUTO_BOT  |  EASY_APPLY  |  MANUAL  |  EMAIL
```

---

## Database Schema

```
  ┌───────────────────┐         ┌─────────────────────┐
  │       users       │──1:1───►│    user_profiles    │
  │                   │         │                     │
  │  id  uuid  PK     │         │  experience_level   │
  │  email            │         │  open_to_remote     │
  │  hashed_password  │         │  min_salary         │
  │  is_active        │         │  desired_roles[]    │
  │  created_at       │         │  desired_locations[]│
  └────────┬──────────┘         └─────────────────────┘
           │
           ├──1:N──► user_skills (skill_name · proficiency · is_verified)
           │
           ├──1:N──► resumes
           │         │  resume_type · target_role
           │         │  ats_score · pdf_path · is_base
           │         └──────────────────────┐
           │                                │
  ┌────────▼──────────┐                     │
  │       jobs        │                     │
  │                   │                     │
  │  source           │                     │
  │  source_job_id    │                     │
  │  title            │                     │
  │  company_name     │                     │
  │  job_type         │                     │
  │  work_mode        │                     │
  │  salary_min/max   │                     │
  │  status           │                     │
  │  posted_at        │                     │
  └────────┬──────────┘                     │
           │                                │
           ├──1:1──►  job_analyses           │
           │          match_score           │
           │          priority_score        │
           │          skill_gaps[]          │
           │          ats_keywords[]        │
           │          seniority_detected    │
           │          ai_recommendation     │
           │          job_difficulty        │
           │                                │
           └──1:N──► applications ◄─────────┘
                     │  status (FSM)
                     │  method
                     │  applied_at · is_starred
                     │  follow_up_sent
                     │
                     ├──1:N──► application_events
                     │         from_status · to_status
                     │         triggered_by · event_type
                     │         timestamp
                     │
                     └──1:N──► interviews
                               interview_type · scheduled_at
                               company_report · tech_questions
                               behav_questions · outcome
                               │
                               └──1:N──► mock_interview_sessions
                                         overall_score
                                         technical_depth_score
                                         communication_score
                                         confidence_score
                                         improvements[]
```

### Job taxonomy

```
JobSource:    linkedin | indeed | internshala | wellfound | glassdoor | company_site | manual
JobType:      full_time | part_time | internship | contract | freelance
WorkMode:     remote | onsite | hybrid | unknown
JobStatus:    new | analyzed | queued | applied | skipped | expired
Seniority:    entry | mid | senior | lead | unknown
RoleCategory: computer_vision | nlp | mlops | data_science | software_engineering | other
Difficulty:   easy | medium | hard
```

---

## Core Modules

| # | Module | Source File | Description |
|---|--------|-------------|-------------|
| 1 | Job Discovery | `agents/scrapers/` | Multi-platform scrapers with polite rate limiting, `fake-useragent` rotation, and deduplication by `source_job_id` |
| 2 | Job Analyzer | `services/job_analyzer.py` | Dual-model LLM pipeline: GPT-4o-mini batch filter + GPT-4o deep analysis with structured JSON output |
| 3 | Resume Engine | `services/resume_service.py` | ATS-optimised resume tailoring, keyword injection, ATS score estimation, WeasyPrint/ReportLab PDF rendering, version tracking |
| 4 | Cover Letter Generator | `services/cover_letter_service.py` | GPT-4o per-job cover letter with company context loading, role alignment, and configurable tone |
| 5 | Auto Apply Bot | `agents/apply_bot.py` | Playwright Chromium automation: ATS detection (Workday, Greenhouse, Lever, LinkedIn Easy Apply, Indeed, Internshala), form fill, CAPTCHA escalation |
| 6 | Application Tracker | `models/application.py` | 14-state lifecycle FSM with full `ApplicationEvent` audit log and `ApplicationMethod` classification |
| 7 | Follow-up Automation | `services/follow_up_service.py` | Scheduled 7-day follow-up emails, interview confirmations, post-interview thank-you dispatch |
| 8 | Notification Service | `services/notification_service.py` | Telegram bot with inline keyboards and Jinja2-templated SMTP email digests |
| 9 | AI Chat Assistant | `services/ai_assistant.py` | Conversational interface with RAG context from user profile, application history, and job data |
| 10 | Market Intelligence | `services/market_service.py` | Periodic snapshots: top skill demand, emerging roles, salary band aggregation, hiring velocity |
| 11 | Interview Engine | `services/interview_service.py` | Company report generation, technical and behavioural Q&A bank, mock sessions, Whisper recording analysis |
| 12 | Background Agent | `agents/tasks.py` | Celery task definitions, Beat schedule, 4-queue routing with per-queue rate limits, retry policies, `AgentTask` logging |

---

## Quick Start

### Prerequisites

| Dependency | Minimum version | Purpose |
|---|---|---|
| Python | 3.11 | Runtime |
| PostgreSQL | 15 | Primary datastore |
| Redis | 7 | Celery broker and result backend |
| Node.js | 18 | Next.js frontend |
| Playwright / Chromium | 1.44 | Browser automation |

### 1. Clone the repository

```bash
git clone https://github.com/Sudharsanselvaraj/Distributed-Autonomous-Opportunity-Intelligence-and-Strategic-Application-Orchestration-System.git
cd Distributed-Autonomous-Opportunity-Intelligence-and-Strategic-Application-Orchestration-System
```

### 2. Python environment

```bash
python -m venv venv
source venv/bin/activate          # Linux / macOS
# venv\Scripts\activate           # Windows

pip install -r requirements.txt
playwright install chromium
```

### 3. Environment configuration

```bash
cp career_platform/.env.example career_platform/.env
# Edit .env — see the Configuration section for all variables
```

### 4. Database initialisation

```bash
psql -U postgres -c "CREATE DATABASE career_platform;"
cd career_platform
alembic upgrade head
```

### 5. Start services

**Windows (automated):**
```bat
setup.bat           # First-time: install deps, create directories, run migrations
start_platform.bat  # Start all services
```

**Linux / macOS — four separate terminals:**

```bash
# Terminal 1 — FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Celery workers (all four queues)
celery -A app.agents.tasks.celery_app worker --loglevel=info \
  -Q scraping,ai,automation,notifications --concurrency=4

# Terminal 3 — Celery Beat scheduler
celery -A app.agents.tasks.celery_app beat --loglevel=info

# Terminal 4 — Flower monitoring dashboard (optional)
celery -A app.agents.tasks.celery_app flower --port=5555
```

### 6. Register and authenticate

```bash
# Create an account
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "yourpassword", "full_name": "Your Name"}'

# Obtain a JWT token
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "yourpassword"}'
```

### 7. Service endpoints

| Service | URL | Notes |
|---|---|---|
| Swagger UI | `http://localhost:8000/api/docs` | Full interactive API reference |
| ReDoc | `http://localhost:8000/api/redoc` | Clean reference layout |
| Health check | `http://localhost:8000/health` | DB connectivity status |
| Celery Flower | `http://localhost:5555` | Task monitoring dashboard |

---

## Configuration

All configuration is managed via `career_platform/.env`. The full template is provided in `.env.example`.

### Application

```env
APP_NAME="AI Career Platform"
APP_ENV=development              # development | staging | production
APP_HOST=0.0.0.0
APP_PORT=8000
DEBUG=true
SECRET_KEY=your-secret-key-minimum-32-characters
```

### Database

```env
DATABASE_URL=postgresql+asyncpg://career_user:career_pass@localhost:5432/career_platform
DATABASE_URL_SYNC=postgresql://career_user:career_pass@localhost:5432/career_platform
```

### Task queue

```env
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
```

### AI layer

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL_HEAVY=gpt-4o           # Deep analysis, resume/cover letter gen, interview prep
OPENAI_MODEL_LIGHT=gpt-4o-mini      # Batch scoring, quick filtering, chat responses
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
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

```env
# Telegram — create a bot via @BotFather, obtain your chat ID via @userinfobot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-personal-chat-id

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password   # Gmail App Password — not your account password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME="AI Career Agent"
```

### User profile

The profile is injected into every AI prompt. Accuracy here directly determines match quality and generation relevance.

```env
USER_NAME="Your Name"
USER_EMAIL=your-email@gmail.com
USER_PHONE=+91-XXXXXXXXXX
USER_LOCATION="Chennai, India"
USER_DESIRED_ROLES=["Computer Vision Engineer","ML Engineer","AI Research Intern","Data Scientist"]
USER_DESIRED_LOCATIONS=["Remote","Bangalore","Hyderabad","Chennai","Europe","USA"]
USER_EXPERIENCE_LEVEL=entry          # entry | mid | senior
USER_OPEN_TO_REMOTE=true
USER_MIN_SALARY=0                    # 0 = no minimum constraint
```

### Job scraping

```env
SCRAPE_INTERVAL_HOURS=6              # Master agent cycle interval
MAX_JOBS_PER_CYCLE=200               # Cap on new jobs stored per cycle
SCRAPE_DELAY_MIN_SECONDS=2.0         # Polite random delay between HTTP requests
SCRAPE_DELAY_MAX_SECONDS=6.0

# Platform credentials (required for authenticated scraping)
LINKEDIN_EMAIL=your-linkedin@email.com
LINKEDIN_PASSWORD=your-linkedin-password
```

### Auto-apply

> **Auto-apply is disabled by default.** Review each setting carefully before enabling.

```env
AUTO_APPLY_ENABLED=false
AUTO_APPLY_MATCH_THRESHOLD=75        # Only queue jobs with match_score >= this value
AUTO_APPLY_DAILY_LIMIT=10            # Hard ceiling on submissions per calendar day
AUTO_APPLY_REQUIRE_APPROVAL=true     # Human-in-the-loop: Telegram approval before each submission
```

### File storage

```env
STORAGE_BACKEND=local                # local | s3
LOCAL_STORAGE_PATH=./storage

# Optional S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET_NAME=career-platform-files
AWS_REGION=us-east-1
```

### Authentication

```env
JWT_SECRET_KEY=your-jwt-secret-minimum-32-characters
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440   # 24 hours
```

---

## API Reference

Full interactive documentation is available at `/api/docs` (Swagger UI) and `/api/redoc` (ReDoc). All endpoints require a JWT Bearer token in the `Authorization` header.

### Router overview

| Router | Prefix | Key endpoints |
|---|---|---|
| Auth | `/api/auth` | `POST /register`, `POST /login`, `GET /me` |
| Jobs | `/api/jobs` | `GET /`, `GET /{id}`, `POST /`, `POST /{id}/analyze`, `POST /{id}/skip` |
| Applications | `/api/applications` | `GET /`, `GET /{id}`, `POST /`, `PATCH /{id}/status`, `GET /stats` |
| Resumes | `/api/resumes` | `GET /`, `POST /upload`, `POST /generate`, `GET /{id}/download`, `DELETE /{id}` |
| Cover Letters | `/api/cover-letters` | `GET /`, `POST /generate`, `GET /{id}`, `DELETE /{id}` |
| Agent | `/api/agent` | `POST /run`, `GET /tasks`, `GET /tasks/{id}`, `POST /cycle/trigger` |
| Analytics | `/api/analytics` | `GET /dashboard`, `GET /market`, `GET /resume-performance`, `GET /skill-gaps` |
| Chat | `/api/chat` | `POST /message`, `GET /history`, `DELETE /history` |
| Profile | `/api/profile` | `GET /`, `PATCH /`, `/skills` CRUD |
| Security | `/api/security` | `/credentials`, `/consents`, `/data/export`, `/data/delete`, `/audit` |
| Onboarding | `/api/onboarding` | `GET /status`, `POST /complete`, `POST /profile` |

### Job filtering parameters (`GET /api/jobs`)

| Parameter | Type | Description |
|---|---|---|
| `source` | string | `linkedin` \| `indeed` \| `internshala` \| `wellfound` \| `manual` |
| `job_type` | string | `full_time` \| `internship` \| `contract` \| `part_time` |
| `work_mode` | string | `remote` \| `onsite` \| `hybrid` |
| `min_match_score` | float | Minimum match score (0–100) |
| `keyword` | string | Full-text search across title, company, and description |
| `status` | string | `new` \| `analyzed` \| `queued` \| `applied` \| `skipped` |
| `sort_by` | string | `match_score` \| `priority_score` \| `posted_at` \| `created_at` |
| `page` | int | Default: 1 |
| `page_size` | int | Default: 20, max: 100 |

### Usage examples

**Trigger a manual scrape cycle:**
```bash
curl -X POST http://localhost:8000/api/agent/run \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"task": "scrape_jobs", "params": {"platforms": ["linkedin", "indeed"]}}'
```

**List top-matched remote jobs:**
```bash
curl "http://localhost:8000/api/jobs?min_match_score=80&work_mode=remote&sort_by=match_score" \
  -H "Authorization: Bearer <token>"
```

**Generate a tailored resume for a specific job:**
```bash
curl -X POST http://localhost:8000/api/resumes/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"job_id": "<uuid>", "base_resume_id": "<uuid>"}'
```

**Natural language command to the AI assistant:**
```bash
curl -X POST http://localhost:8000/api/chat/message \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Find AI internships in Europe and apply to the top 3 matches"}'
```

**Fetch dashboard analytics:**
```bash
curl http://localhost:8000/api/analytics/dashboard \
  -H "Authorization: Bearer <token>"
```

---

## Automation Schedule

All periodic tasks are registered in Celery Beat via `beat_schedule` in `agents/tasks.py`. No external cron configuration is required.

| Task | Interval | Queue | Description |
|---|---|---|---|
| `run_main_agent_cycle` | Every 6 hours | scraping / ai / automation | Full pipeline: discover → analyse → generate → apply → notify |
| `check_follow_ups` | Every 1 hour | notifications | Dispatch follow-up emails; automatic 7-day recruiter follow-up |
| `take_market_snapshot` | Daily | ai | Aggregate skill demand, salary trends, and hiring velocity |
| `update_resume_performance` | Every 6 hours | ai | Recalculate response rates per resume version from application outcomes |

### Queue architecture and rate limits

| Task pattern | Queue | Rate limit |
|---|---|---|
| `scrape_linkedin_task` | scraping | 10 / min |
| `scrape_indeed_task` | scraping | 20 / min |
| `scrape_internshala_task` / `scrape_wellfound_task` | scraping | default |
| `analyze_job_task` / `generate_resume_task` / `generate_cover_letter_task` | ai | default |
| `auto_apply_task` | automation | 5 / min |
| `send_telegram_notification` / `send_email_notification` / `check_follow_ups` | notifications | default |

**Retry policy (all tasks):** `max_retries = 3`, exponential backoff, `task_acks_late = true`, `task_reject_on_worker_lost = true`, `result_expires = 86400 s`.

---

## Interview Preparation Engine

When an application advances to `INTERVIEW_SCHEDULED`, the system automatically generates a full preparation package via `interview_service.py`.

**Company intelligence report** (GPT-4o + web search) — products and services, recent news, known tech stack, culture signals, Glassdoor rating, estimated interview difficulty, and known interview format.

**Question bank** (GPT-4o, based on role and JD) — technical questions with expected answers and difficulty ratings, behavioural questions with STAR-framework hints, and a ranked study-topics list.

**Mock interview sessions** (AI interviewer — GPT-4o) — full transcript with timestamped `{role, content}` turns, and a scored debrief covering `overall_score`, `technical_depth_score`, `communication_score`, `confidence_score`, and `improvement_suggestions[]`.

**Recording analysis** (OpenAI Whisper + GPT-4o) — transcription of audio recordings with analysis of filler word count, speech clarity, confidence level, technical depth, and pacing.

`InterviewType` values: `phone_screen` | `technical` | `behavioral` | `system_design` | `hr` | `final` | `take_home`

---

## Project Structure

```
career_platform/
├── app/
│   ├── agents/
│   │   ├── apply_bot.py           # Playwright auto-apply bot; ATS detection and form fill
│   │   ├── tasks.py               # Celery task definitions, Beat schedule, queue routing
│   │   └── scrapers/
│   │       ├── base.py            # Abstract base: rate limiting, dedup, DB persistence
│   │       ├── linkedin.py        # LinkedIn scraper (authenticated)
│   │       ├── indeed.py          # Indeed scraper
│   │       ├── internshala.py     # Internshala scraper
│   │       └── wellfound.py       # Wellfound scraper
│   ├── api/
│   │   └── routes/
│   │       ├── auth.py            # JWT registration, login, /me
│   │       ├── jobs.py            # Job feed: list, filter, get, manual add, trigger analysis
│   │       └── routes.py          # Applications, resumes, cover letters, agent, analytics, chat
│   ├── core/
│   │   ├── config.py              # Pydantic Settings — .env loading, JSON list parsing
│   │   └── database.py            # SQLAlchemy async engine, session factory, get_db dependency
│   ├── models/
│   │   ├── application.py         # Application FSM, ApplicationEvent, ApplicationMethod
│   │   ├── interview.py           # Interview, MockInterviewSession, AgentTask, MarketSnapshot
│   │   ├── job.py                 # Job, JobAnalysis, all job enums
│   │   ├── resume.py              # Resume versions, ResumeType
│   │   └── user.py                # User, UserProfile, UserSkill, ExperienceLevel
│   ├── services/
│   │   ├── ai_assistant.py        # Chat service: intent detection, agent action dispatch
│   │   ├── application_service.py # Application CRUD, status transitions
│   │   ├── cover_letter_service.py# GPT-4o cover letter generation
│   │   ├── follow_up_service.py   # Follow-up scheduling and email dispatch
│   │   ├── interview_service.py   # Interview prep, mock sessions, Whisper analysis
│   │   ├── job_analyzer.py        # Two-pass LLM pipeline, match scoring, skill gap extraction
│   │   ├── market_service.py      # Market snapshots, skill demand, salary aggregation
│   │   ├── notification_service.py# Telegram bot + SMTP email dispatch
│   │   └── resume_service.py      # GPT-4o tailoring, ATS keyword injection, PDF rendering
│   ├── schemas/
│   │   └── __init__.py            # All Pydantic v2 request/response schemas
│   ├── utils/
│   │   └── helpers.py             # Shared utility functions
│   └── main.py                    # FastAPI app factory, router registration, lifespan
├── alembic/                        # Database migration scripts
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
├── tests/
├── .env.example                    # Full configuration template
├── alembic.ini
├── requirements.txt                # 40+ pinned dependencies
├── setup.bat                       # Windows first-time setup
└── start_platform.bat              # Windows service launcher
```

---

## Security

### Authentication

All API endpoints require a JWT Bearer token. Register via `POST /api/auth/register`, authenticate via `POST /api/auth/login`. Tokens expire after 24 hours (`JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 1440`). Passwords are hashed with bcrypt via `passlib`.

### Credential encryption

Platform credentials are encrypted at rest using AES-256-GCM with a key derived via PBKDF2-HMAC-SHA256 (100,000 iterations) and stored as encrypted blobs in the `credential_vaults` table.

### GDPR compliance

A `UserConsent` model tracks granted and revoked consents. Users can request a full data export as JSON (`POST /api/security/data/export`) or submit a deletion request processed within a 30-day window (`POST /api/security/data/delete`).

### Audit logging

All sensitive operations are written to the `AuditLog` table: credential stored/deleted, consent granted/revoked, data export/delete requested, login success/failure, and rate limiting events.

### Secrets management

`SECRET_KEY` and `JWT_SECRET_KEY` must be cryptographically random strings of at least 32 characters. Generate them with:

```bash
openssl rand -hex 32
```

### Auto-apply safeguards

Auto-apply defaults to `disabled`. When enabled, three independent controls limit exposure: the human-in-the-loop Telegram approval gate, a hard daily application limit (`AUTO_APPLY_DAILY_LIMIT`), and a minimum match-score threshold (`AUTO_APPLY_MATCH_THRESHOLD`).

---

## Tech Stack

| Layer | Technology | Version | Role |
|---|---|---|---|
| Web framework | FastAPI | 0.111.0 | REST API, dependency injection, async request handling |
| ASGI server | Uvicorn | 0.30.1 | High-performance async server |
| ORM | SQLAlchemy (async) | 2.0.30 | Async database access, relationship loading |
| Database | PostgreSQL | 15+ | Primary relational datastore |
| Migrations | Alembic | 1.13.1 | Schema version control |
| Task queue | Celery | 5.4.0 | Distributed task execution across four queues |
| Message broker | Redis | 5.0.4 (py) | Celery broker and result backend |
| Scheduler | APScheduler | 3.10.4 | In-process scheduling fallback |
| Queue monitor | Flower | 2.0.1 | Celery task monitoring dashboard |
| LLM (heavy) | OpenAI GPT-4o | openai 1.30.1 | Deep analysis, resume/cover letter generation, interview prep |
| LLM (light) | OpenAI GPT-4o-mini | openai 1.30.1 | Batch scoring, filtering, chat responses |
| Embeddings | text-embedding-3-small | openai 1.30.1 | Semantic profile and job vectorisation |
| Audio transcription | OpenAI Whisper | openai-whisper 20231117 | Interview recording transcription |
| LLM orchestration | LangChain / LangChain-OpenAI | 0.2.1 / 0.1.7 | Prompt chaining, RAG retrieval |
| Vector store | ChromaDB | 0.5.0 | Semantic memory: profile, jobs, resumes |
| Browser automation | Playwright | 1.44.0 | Chromium-based auto-apply bot |
| Async HTTP | httpx | 0.27.0 | Async HTTP requests |
| Concurrent scraping | aiohttp | 3.9.5 | Concurrent async scraping |
| HTML parsing | BeautifulSoup4 + lxml | 4.12.3 / 5.2.2 | Job description extraction |
| Telegram | python-telegram-bot | 21.2 | Bot API, inline keyboards |
| Email | aiosmtplib | 3.0.1 | Async SMTP dispatch |
| Email templates | Jinja2 | 3.1.4 | HTML email rendering |
| PDF generation | WeasyPrint | 62.1 | CSS-to-PDF resume rendering |
| PDF generation | ReportLab | 4.2.0 | Programmatic PDF construction |
| JWT | python-jose | 3.3.0 | JWT signing and verification |
| Password hashing | passlib + bcrypt | 1.7.4 / 4.1.3 | Secure password storage |
| Schema validation | Pydantic v2 | 2.7.1 | Request/response validation |
| Settings | pydantic-settings | 2.3.0 | `.env` loading with type coercion |
| File storage | boto3 (S3) | 1.34.113 | Optional cloud file storage |
| Async file I/O | aiofiles | 23.2.1 | Non-blocking file operations |
| Structured logging | structlog | 24.1.0 | JSON-structured log output |
| Retry logic | tenacity | 8.3.0 | Exponential backoff on transient failures |
| User agent rotation | fake-useragent | 1.5.1 | Scraper bot detection avoidance |
| Frontend | Next.js | 18+ | Dashboard UI |
| Styling | TailwindCSS | 3+ | Utility-first CSS framework |

---

## Roadmap

- [ ] Glassdoor scraper integration
- [ ] S3 storage backend for resume and recording artefacts
- [ ] Frontend Next.js dashboard (job feed, application tracker, interview prep)
- [ ] Salary negotiation assistant powered by market snapshot data
- [ ] Multi-user support with per-user agent isolation
- [ ] Docker Compose deployment configuration
- [ ] Test suite coverage for agent pipeline and service layer
- [ ] Webhook support for ATS status callbacks (Greenhouse, Lever)
- [ ] LangSmith tracing integration for LLM observability

---

## Contributing

Contributions are welcome. Please open an issue to discuss proposed changes before submitting a pull request. Ensure all new code includes type annotations and passes the existing test suite.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

Built by [Sudharsan Selvaraj](https://github.com/Sudharsanselvaraj)

</div>
