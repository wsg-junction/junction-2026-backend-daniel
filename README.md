# junction-2026-backend-daniel

AI proxy server for Pockets finance coach, MetaSchool, and more — Junction 2026 hackathon.

Sits between frontend clients and upstream AI/search providers. All routes are behind a 2 req/s global rate limit.

---

## Tools & Integrations

### 1. Nemotron — Primary AI (Verda / DataCrunch)

| | |
|---|---|
| **Route** | `POST /nemotron/v1/chat/completions` |
| **Upstream** | `https://containers.datacrunch.io/nemotron-3-5-super-vl-b300/v1/chat/completions` |
| **Model** | `nemotron-3.5-super-vl` |
| **Env var** | `VERDA_INFERENCE_KEY` |

Vision-capable model with financial domain training, self-hosted on DataCrunch (Verda). First model the frontend tries for every AI coach question.

---

### 2. Gemma — Fallback AI (Featherless)

| | |
|---|---|
| **Route** | `POST /v1/chat/completions` |
| **Upstream** | `https://api.featherless.ai/v1/chat/completions` |
| **Model** | `google/gemma-4-31B-it` |
| **Env var** | `FEATHERLESS_API_KEY` |

Open-weights general-purpose model hosted on Featherless. Only called when Nemotron fails or returns empty content.

#### Fallback pipeline

The frontend (`src/agent.ts → callAgent`) iterates an ordered endpoint list and moves to the next on any error, non-200, or empty response:

```
User question
    │
    ▼
POST /nemotron/v1/chat/completions   ← try first
    │ error / non-200 / empty
    ▼
POST /v1/chat/completions            ← Gemma fallback
    │ error / non-200 / empty
    ▼
throw "All AI endpoints failed"      ← coach shows friendly error
```

Each call uses `temperature: 0.7`, `max_tokens: 3000`, OpenAI-compatible body. Fail fast — no retry on the same endpoint. The optional `liveOnly` flag skips the fallback and forces Nemotron only.

---

### 3. Context.dev — Web Research

| | |
|---|---|
| **Route** | `GET /search?q=<query>&mode=<fast\|ultra\|auto>` |
| **Upstream** | `https://api.context.dev/v1/web/answers` |
| **Env var** | `CONTEXT_DEV_API_KEY` |

Fetches structured, sourced answers from the web. Used in two places in the frontend:

- **AI coach** (`searchWebContext`) — injects up to 1 500 chars of live financial context (ETF info, savings rates, etc.) into the LLM system prompt before sending the user's question.
- **Stock ticker** (`searchStockPrices`) — fetches recent headlines for Nordic stocks (Nokia, Nordea, Neste, Sampo, Fortum) to populate the ticker on the Investments tab.

**Modes:**

| Mode | Credits | Behaviour |
|------|---------|-----------|
| `fast` | ~10 | Quick research (default) |
| `ultra` | ~100 | Deeper research |
| `auto` | 10–100 | Tries `fast`, falls back to `ultra` on error |

Both functions return an empty value silently on any error — the coach and ticker degrade gracefully.

---

## Infrastructure

| Concern | Detail |
|---------|--------|
| Rate limit | 2 req/s global; upgrade to per-IP if abuse becomes an issue |
| CORS | Open (`*`) — demo only |
| Health check | `GET /health` → 200 |
| Logging | Every request: method, path, status, latency |
| Deploy | Dockerised; CI/CD via Craci |

## Local dev

```bash
npm install
node index.js
```

Set env vars: `VERDA_INFERENCE_KEY`, `FEATHERLESS_API_KEY`, `CONTEXT_DEV_API_KEY`.
