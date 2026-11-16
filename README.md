# 🧠 AetherMind — AI Multi-Agent Workspace & Knowledge Graph

> **Ultra-Tier Portfolio Flagship** — An interactive multi-agent research & engineering workspace that orchestrates specialized AI agents in real time, indexes knowledge with hybrid vector search, and visualizes reasoning as a live interactive Knowledge Graph.

---

## ✨ Planned Architecture & Core Capabilities

- **Multi-Agent Orchestration Pipeline:** Coordinated agents (`Researcher` → `Synthesizer` → `Critic`) streaming reasoning steps over WebSockets.
- **Live Knowledge Graph Canvas:** Interactive node-and-edge graph linking concepts, sources, tasks, and agent outputs.
- **Hybrid Vector Search Engine:** Semantic similarity retrieval over workspace documents, notes, and agent memory.
- **Real-Time Collaborative Workspace:** Live run logs, inspectable node provenance, and replayable execution traces.

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
