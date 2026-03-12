<div align="center">

# 🤖 D.A.O.I.S.A.O.S
### Distributed Autonomous Opportunity Intelligence and Strategic Application Orchestration System

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7+-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)
[![Celery](https://img.shields.io/badge/Celery-5.4-37814A?style=for-the-badge&logo=celery&logoColor=white)](https://docs.celeryq.dev)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

**A Personal AI Career Operating System that autonomously discovers jobs, crafts tailored applications, and orchestrates your entire job search — while you focus on what matters.**

[Features](#-features) • [Architecture](#-architecture) • [Modules](#-core-modules) • [Quick Start](#-quick-start) • [Configuration](#-configuration) • [API Docs](#-api-reference) • [Roadmap](#-roadmap)

---

</div>

## 🌟 What is D.A.O.I.S.A.O.S?

D.A.O.I.S.A.O.S is a **fully autonomous, AI-powered career automation platform** designed to act as your personal career operating system. It runs 24/7 in the background — scraping job boards, scoring job matches with AI, generating ATS-optimised resumes, submitting applications, tracking every interaction, and sending you real-time notifications.

This is not a job board. It is an **orchestration engine** — a distributed system of intelligent agents that handles every stage of the job search lifecycle, end-to-end.

```
Job Discovery  →  AI Analysis  →  Resume Tailoring  →  Auto Apply  →  Track & Follow-up  →  Interview Prep
```

---

## ✨ Features

### 🔍 Intelligent Job Discovery
- Multi-platform scraping: **LinkedIn**, **Indeed**, **Internshala**, **Wellfound**, **Glassdoor**
- Runs every 6 hours automatically via Celery Beat
- Remote job detection, salary estimation, location and role filtering
- Real-time new job alerts via Telegram and Email

### 🧠 AI-Powered Job Analysis
- GPT-4o-mini for fast batch filtering, GPT-4o for deep job analysis
- Extracts required skills, preferred skills, tech stack, ATS keywords, experience requirements
- Generates a match score (0–100) against your personal profile
- Detects skill gaps, estimates application difficulty, classifies role category

### 📄 Resume Optimization Engine
- Auto-generates ATS-optimised resume variants per job role
- Keyword injection, bullet point rewrites, formatting improvements
- Version control — maintains `resume_ai.pdf`, `resume_cv_engineer.pdf`, `resume_ml.pdf`, etc.
- Tracks which resume version performs best across applications

### ✉️ Cover Letter Generator
- GPT-4o powered per-job cover letter generation
- Tailors tone (formal / technical), highlights matching skills, references company culture
- Auto-attaches correct cover letter during application submission

### 🤖 Auto Apply Bot
- Playwright-based browser automation
- Supports **Workday**, **Greenhouse**, **Lever**, **LinkedIn Easy Apply**, **Internshala**, **Indeed**
- Fills forms, uploads documents, answers standard questions, submits applications
- CAPTCHA detection with human-in-the-loop pause + Telegram notification
- Mass apply mode with daily limit enforcement and match-score thresholds

### 📊 Application Tracking System
- Full lifecycle tracking: `Applied → Viewed → Shortlisted → Interview → Offer / Rejected`
- Per-application timeline, recruiter contact tracking, follow-up scheduling
- Dashboard metrics: Applications Sent, Responses, Interviews Scheduled, Offers Received

### 🔔 Multi-Channel Notifications
- **Telegram Bot** — inline job cards with Apply / Ignore buttons
- **Email (SMTP)** — rich HTML digests, follow-up reminders, interview confirmations
- Desktop-style alerts for match score thresholds

### 🎤 Interview Preparation Engine
- Auto-generates company analysis, technical question bank, and behavioral Q&A
- AI mock interviewer with answer scoring and improvement suggestions
- Interview recording analyser (speech clarity, filler words, confidence, technical depth via Whisper)

### 📈 Career Intelligence
- Skill gap analyser across thousands of job descriptions
- Job market intelligence — trending roles, top demanded skills, salary trends
- Application success predictor — estimates interview probability per company/role
- Career timeline prediction — current stage → target role trajectory

### 💬 Conversational AI Assistant
- Chat interface in the dashboard + Telegram bot
- Natural language commands: *"Find AI internships in Europe"*, *"Apply to top 3 matches"*, *"What skills should I learn next?"*

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
│   Dashboard · Job Feed · Resume Manager · Interview Prep · Chat  │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API
┌────────────────────────────▼────────────────────────────────────┐
│                      FASTAPI BACKEND                             │
│  /auth  /jobs  /applications  /resumes  /agent  /analytics /chat│
└──────┬──────────────────────────────────────┬───────────────────┘
       │ SQLAlchemy (async)                    │ Celery tasks
┌──────▼──────┐   ┌───────────┐   ┌──────────▼──────────────────┐
│ PostgreSQL  │   │ ChromaDB  │   │      CELERY WORKERS          │
│  (primary   │   │  (vector  │   │  Queue: scraping             │
│   store)    │   │   memory) │   │  Queue: ai                   │
└─────────────┘   └───────────┘   │  Queue: automation           │
                                   │  Queue: notifications        │
                  ┌────────────┐   └──────────────────────────────┘
                  │   Redis    │◄── Celery Broker + Result Backend
                  └────────────┘
                                   ┌──────────────────────────────┐
                                   │      AI SERVICES             │
                                   │  OpenAI GPT-4o (analysis)    │
                                   │  GPT-4o-mini (scoring/chat)  │
                                   │  text-embedding-3-small      │
                                   │  Whisper (interview audio)   │
                                   └──────────────────────────────┘
                                   ┌──────────────────────────────┐
                                   │   NOTIFICATION CHANNELS      │
                                   │  Telegram Bot                │
                                   │  SMTP Email (Gmail)          │
                                   └──────────────────────────────┘
```

---

## 🧩 Core Modules

| # | Module | File | Description |
|---|--------|------|-------------|
| 1 | Job Discovery | `agents/scrapers/` | Multi-platform job scraper (LinkedIn, Indeed, Internshala, Wellfound) |
| 2 | Job Analyzer | `services/job_analyzer.py` | LLM-powered JD analysis, skill extraction, match scoring |
| 3 | Resume Engine | `services/resume_service.py` | ATS-optimised resume generation & version control |
| 4 | Cover Letter Generator | `services/cover_letter_service.py` | Per-job cover letter tailored to company and role |
| 5 | Auto Apply Bot | `agents/apply_bot.py` | Playwright browser automation for application submission |
| 6 | Application Tracker | `models/application.py` | Full lifecycle tracking with status events |
| 7 | Follow-up Automation | `services/follow_up_service.py` | Automated follow-up emails and recruiter reminders |
| 8 | Notification Service | `services/notification_service.py` | Telegram + Email notifications |
| 9 | AI Assistant | `services/ai_assistant.py` | Conversational career assistant (chat interface) |
| 10 | Market Intelligence | `services/market_service.py` | Job market trends, skill demand analytics |
| 11 | Interview Engine | `services/interview_service.py` | Interview prep, mock interviewer, answer scoring |
| 12 | Background Agent | `agents/tasks.py` | Celery task orchestration — the automation backbone |

---

## 🚀 Quick Start

### Prerequisites

| Dependency | Version | Notes |
|---|---|---|
| Python | 3.11+ | |
| PostgreSQL | 15+ | Database |
| Redis | 7+ | Task queue broker |
| Node.js | 18+ | Frontend (Next.js) |
| Playwright | 1.44 | Browser automation |

### 1. Clone the Repository

```bash
git clone https://github.com/Sudharsanselvaraj/Distributed-Autonomous-Opportunity-Intelligence-and-Strategic-Application-Orchestration-System.git
cd Distributed-Autonomous-Opportunity-Intelligence-and-Strategic-Application-Orchestration-System
```

### 2. Backend Setup

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Linux / macOS
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium
```

### 3. Environment Configuration

```bash
cp career_platform/.env.example career_platform/.env
# Edit .env with your actual values (see Configuration section below)
```

### 4. Database Setup

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE career_platform;"

# Run migrations
cd career_platform
alembic upgrade head
```

### 5. Start All Services

**Windows — one command:**
```bat
start_platform.bat
```

**Linux / macOS — four terminals:**
```bash
# Terminal 1 — FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Celery worker (all queues)
celery -A app.agents.tasks.celery_app worker --loglevel=info \
  -Q scraping,ai,automation,notifications

# Terminal 3 — Celery Beat scheduler
celery -A app.agents.tasks.celery_app beat --loglevel=info

# Terminal 4 — Flower monitoring UI (optional)
celery -A app.agents.tasks.celery_app flower --port=5555
```

### 6. Access the Platform

| Service | URL |
|---|---|
| API Docs (Swagger) | http://localhost:8000/api/docs |
| API Docs (ReDoc) | http://localhost:8000/api/redoc |
| Health Check | http://localhost:8000/health |
| Celery Flower | http://localhost:5555 |

---

## ⚙️ Configuration

All configuration lives in `career_platform/.env`. Copy from `.env.example` and fill in your values.

### Core Settings

```env
APP_NAME="AI Career Platform"
APP_ENV=development
SECRET_KEY=your-super-secret-key-min-32-chars
```

### Database & Queue

```env
DATABASE_URL=postgresql+asyncpg://career_user:career_pass@localhost:5432/career_platform
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
```

### AI (Required)

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL_HEAVY=gpt-4o          # Deep analysis, resume gen, cover letters
OPENAI_MODEL_LIGHT=gpt-4o-mini     # Quick scoring, filtering, chat
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### Notifications

```env
# Telegram — create a bot via @BotFather
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-personal-chat-id

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
```

### Your Profile (drives job matching)

```env
USER_NAME="Your Name"
USER_EMAIL=your-email@gmail.com
USER_LOCATION="Chennai, India"
USER_DESIRED_ROLES=["Computer Vision Engineer","ML Engineer","AI Research Intern"]
USER_DESIRED_LOCATIONS=["Remote","Bangalore","Europe","USA"]
USER_EXPERIENCE_LEVEL=entry        # entry | mid | senior
USER_OPEN_TO_REMOTE=true
```

### Job Scraping & Auto-Apply

```env
SCRAPE_INTERVAL_HOURS=6            # How often to search for new jobs
MAX_JOBS_PER_CYCLE=200

# Auto-apply (disabled by default for safety)
AUTO_APPLY_ENABLED=false
AUTO_APPLY_MATCH_THRESHOLD=75      # Only apply if AI match score >= 75%
AUTO_APPLY_DAILY_LIMIT=10          # Max applications per day
AUTO_APPLY_REQUIRE_APPROVAL=true   # Send Telegram alert and wait for approval
```

### Platform Credentials (for authenticated scraping)

```env
LINKEDIN_EMAIL=your-linkedin@email.com
LINKEDIN_PASSWORD=your-linkedin-password
```

> ⚠️ **Safety Note:** `AUTO_APPLY_ENABLED` defaults to `false`. Enable only after reviewing the match threshold and daily limit settings. `AUTO_APPLY_REQUIRE_APPROVAL=true` sends a Telegram notification and waits for your explicit approval before submitting any application.

---

## 📡 API Reference

The full interactive API is available at `/api/docs` when the server is running. Core endpoint groups:

| Router | Prefix | Responsibility |
|---|---|---|
| Auth | `/api/auth` | Register, login, JWT token management |
| Jobs | `/api/jobs` | Job feed, search, filtering, AI analysis |
| Applications | `/api/applications` | Track applications, update statuses |
| Resumes | `/api/resumes` | Upload, version, generate optimised resumes |
| Cover Letters | `/api/cover-letters` | Generate and manage cover letters |
| Agent | `/api/agent` | Trigger automation tasks manually |
| Analytics | `/api/analytics` | Dashboard stats, market intelligence |
| Chat | `/api/chat` | Conversational AI assistant |

### Example: Trigger a Manual Job Search

```bash
curl -X POST http://localhost:8000/api/agent/run \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{"task": "scrape_jobs", "params": {"platforms": ["linkedin", "indeed"]}}'
```

### Example: Chat with the AI Assistant

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Find AI internships in Europe and apply to the top 3"}'
```

---

## 🔄 Automation Schedule

The background agent runs on a fixed schedule via Celery Beat:

| Task | Schedule | Description |
|---|---|---|
| `run_main_agent_cycle` | Every 6 hours | Full cycle: scrape → analyze → generate → apply → notify |
| `check_follow_ups` | Every 1 hour | Send follow-up emails, recruiter reminders |
| `take_market_snapshot` | Daily | Capture job market trends and skill demand |
| `update_resume_performance` | Every 6 hours | Recalculate which resume versions drive responses |

### Task Queue Architecture

```
scraping    →  LinkedIn, Indeed, Internshala, Wellfound scrapers
ai          →  Job analysis, resume generation, cover letters, scoring
automation  →  Auto apply bot (rate-limited to 5/min)
notifications → Telegram, email dispatch
```

---

## 📁 Project Structure

```
career_platform/
├── app/
│   ├── agents/
│   │   ├── apply_bot.py          # Playwright auto-apply bot
│   │   ├── tasks.py              # Celery task definitions & beat schedule
│   │   └── scrapers/
│   │       ├── base.py           # Scraper base class
│   │       ├── linkedin.py       # LinkedIn scraper
│   │       ├── indeed.py         # Indeed scraper
│   │       ├── internshala.py    # Internshala scraper
│   │       └── wellfound.py      # Wellfound scraper
│   ├── api/
│   │   └── routes/
│   │       ├── auth.py           # Authentication endpoints
│   │       ├── jobs.py           # Job feed endpoints
│   │       └── routes.py         # Applications, resumes, agent, analytics, chat
│   ├── core/
│   │   ├── config.py             # Pydantic settings (reads from .env)
│   │   └── database.py           # SQLAlchemy async engine & session
│   ├── models/
│   │   ├── application.py        # Application & ApplicationEvent models
│   │   ├── interview.py          # Interview prep & simulation models
│   │   ├── job.py                # Job & JobAnalysis models
│   │   ├── resume.py             # Resume version models
│   │   └── user.py               # User, UserProfile, UserSkill models
│   ├── services/
│   │   ├── ai_assistant.py       # Chat assistant service
│   │   ├── application_service.py
│   │   ├── cover_letter_service.py
│   │   ├── follow_up_service.py
│   │   ├── interview_service.py
│   │   ├── job_analyzer.py       # GPT-4o JD analysis & match scoring
│   │   ├── market_service.py     # Job market intelligence
│   │   ├── notification_service.py # Telegram + SMTP
│   │   └── resume_service.py     # ATS resume generation & versioning
│   ├── schemas/
│   │   └── __init__.py           # Pydantic request/response schemas
│   ├── utils/
│   │   └── helpers.py
│   └── main.py                   # FastAPI app factory
├── alembic/                       # Database migrations
├── tests/
├── .env.example                   # Configuration template
├── requirements.txt
├── setup.bat                      # Windows first-time setup
└── start_platform.bat             # Windows service launcher
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Web Framework** | FastAPI 0.111, Uvicorn |
| **Database** | PostgreSQL 15+, SQLAlchemy 2.0 (async), Alembic |
| **Task Queue** | Celery 5.4, Redis 7, APScheduler, Flower |
| **AI / LLM** | OpenAI GPT-4o, GPT-4o-mini, text-embedding-3-small, Whisper |
| **Vector Memory** | ChromaDB 0.5 |
| **Browser Automation** | Playwright 1.44 |
| **Scraping** | httpx, aiohttp, BeautifulSoup4, lxml |
| **Notifications** | python-telegram-bot 21, aiosmtplib, Jinja2 templates |
| **Auth** | JWT (python-jose), passlib + bcrypt |
| **PDF Generation** | WeasyPrint, ReportLab |
| **Audio** | OpenAI Whisper (interview recording analysis) |
| **File Storage** | Local filesystem / AWS S3 (boto3) |
| **Logging** | structlog |
| **Resilience** | tenacity (exponential backoff retry) |
| **Frontend** | Next.js (React), TailwindCSS |

---

## 🔐 Security Notes

- All API endpoints are protected by JWT Bearer authentication
- `SECRET_KEY` and `JWT_SECRET_KEY` must be changed before any deployment — minimum 32 characters
- LinkedIn/platform credentials are stored locally in `.env` — never commit this file
- Auto-apply is **disabled by default** and requires explicit opt-in
- `AUTO_APPLY_REQUIRE_APPROVAL=true` adds a human-in-the-loop gate before any application is submitted
- Rate limiting is enforced at the Celery task level to avoid platform bans

---

## 🗺 Roadmap

- [ ] Next.js frontend dashboard (Job Feed, Resume Manager, Analytics, Chat)
- [ ] Glassdoor scraper integration
- [ ] LangChain RAG memory for full career knowledge base
- [ ] WhatsApp notification channel
- [ ] Skill gap analyser with auto learning roadmap generation
- [ ] GitHub profile and LinkedIn auto-optimiser
- [ ] Networking assistant (hiring manager outreach)
- [ ] Docker Compose full-stack deployment
- [ ] Application success probability predictor
- [ ] Offer comparison engine

---

## 🤝 Contributing

Contributions are welcome! Please open an issue before submitting a pull request so we can discuss the change.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with 🤖 by [Sudharsan Selvaraj](https://github.com/Sudharsanselvaraj)

*"Automate the grind. Amplify the human."*

</div>
