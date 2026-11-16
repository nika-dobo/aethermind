# 🧠 AetherMind — AI Multi-Agent Workspace & Knowledge Graph

> **Ultra-Tier Portfolio Flagship** — An interactive multi-agent research & engineering workspace that orchestrates specialized AI agents in real time, indexes knowledge with hybrid vector search, and visualizes reasoning as a live interactive Knowledge Graph.

---

## ✨ Planned Architecture & Core Capabilities

- **Multi-Agent Orchestration Pipeline:** Coordinated 4-stage pipeline (`Planner` → `Researcher` → `Synthesizer` → `Critic`) streaming reasoning steps and latency telemetry over WebSockets.
- **Live Knowledge Graph Canvas:** Interactive pan, zoom, and draggable SVG node-and-edge graph linking objectives, agents, retrieved vector evidence, and synthesized blueprints with a Node Inspector.
- **Hybrid Vector Search Engine:** TF-IDF cosine-similarity retrieval with metadata boosting, matched-term highlights, and live node ingestion.
- **SQLite Persistence & Run Replay:** Persists workspace knowledge nodes and multi-agent execution traces in SQLite with instant run history replay and automatic browser fallback mode.

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
