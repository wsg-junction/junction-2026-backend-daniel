---
name: ai-proxy-endpoints
description: AI proxy endpoints, models, and fallback logic for the Junction2026 backend
metadata:
  type: project
---

Proxy base URL: `https://api.danielkalisch.de`

## Endpoints

| Path | Provider | Model |
|------|----------|-------|
| `/nemotron/v1/chat/completions` | Verda Nemotron | `nemotron-3.5-super-vl` |
| `/v1/chat/completions` | Featherless | any (e.g. `google/gemma-4-31B-it`) |
| `/nvidia/v1/chat/completions` | NVIDIA | any NVIDIA model |

## Fallback logic (frontend, ask.ts)

Try nemotron first, fall back to gemma on any error:

```ts
let res = await callProxy('/nemotron/v1/chat/completions', 'nemotron-3.5-super-vl', messages).catch(() => null);
if (!res?.ok) res = await callProxy('/v1/chat/completions', 'google/gemma-4-31B-it', messages).catch(() => null);
```

## Required env vars on server (/opt/ai-proxy/app.env)

- `FEATHERLESS_API_KEY`
- `VERDA_INFERENCE_KEY`
- `NVIDIA_API_KEY`

**Why:** `app.env` is separate from `.env` (which compose uses for `APP_IMAGE` variable substitution) to avoid docker compose stripping vars before passing them to the container.
