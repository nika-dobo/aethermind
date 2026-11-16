# 🧠 AetherMind — AI Research & Decision Copilot

> **Turn scattered notes, study materials, and docs into a verified Action Brief and visual Mind-Map.**

---

## ✨ What It Does

1. **Add or Pick Your Notes:** Start with built-in Knowledge Packs (*AI & Data Science Study Notes*, *SaaS Launch Playbook*, *System Design*) or add/upload your own `.md` / `.txt` notes.
2. **Ask a Goal or Question:** Ask what you want to decide, compare, or plan.
3. **4-Agent AI Team Collaborates Live:** `Strategist` → `Researcher` → `Writer` → `Fact-Checker` stream progress over WebSockets, extract grounded evidence, build a visual **Source Mind-Map**, and write a **Verified Action Brief** you can copy or export as Markdown.

---

## 🏗️ Monorepo Structure

```text
aethermind/
├── apps/
│   └── web/                  # Next.js 15 + React 19 + TypeScript + Tailwind CSS UI
├── services/
│   └── api/                  # Python FastAPI + WebSocket engine + Vector Store + Agents
├── .github/
│   └── workflows/ci.yml      # Automated CI checks (Pytest + Next.js typecheck/build)
├── docker-compose.yml        # Local multi-service development stack
└── .env.example              # Required environment variables template
```

---

## 🚀 Quick Start (Local Development)

### 1. Backend (`services/api`)

```bash
cd services/api
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Run backend tests:

```bash
pytest
```

### 2. Frontend (`apps/web`)

```bash
cd apps/web
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS v4 |
| **Backend & Real-Time** | Python 3.12, FastAPI, WebSockets, Pydantic |
| **Search & AI Engine** | Vector Similarity Indexing, Multi-Agent DAG Pipeline |
| **Testing & CI** | Pytest, ESLint / TypeScript, GitHub Actions |

---

## 📌 Roadmap

- [x] Monorepo scaffold, FastAPI + WebSocket core, local vector store, and initial Next.js shell
- [ ] Interactive Knowledge Graph canvas (pan, zoom, force layout, node inspection)
- [ ] Streaming multi-agent execution UI with live WebSocket trace timeline
- [ ] Document ingestion & persistent embeddings store (SQLite + vector index)
- [ ] Production deployment (Vercel + Render/Railway) & listing in [`myProjects`](https://nika-dobo.github.io/myProjects/)
