# AI Agents & Integrations

## Context.dev Web Research API

**Endpoint:** `GET /search`

Research the web and get structured answers with sources using Context.dev.

### Parameters

- `q` (required): Research query/task (e.g., "What are good ETFs for investment?")
- `mode` (optional): Research depth
  - `fast` (default): ~10 credits, quick research
  - `ultra`: ~100 credits, deeper research
  - `auto`: Tries `fast` first, falls back to `ultra` on error

### Response

```json
{
  "json_content": {
    "query": "What are good ETFs for investment?",
    "suggestions": [
      {
        "name": "State Street SPDR Portfolio S&P 500 ETF",
        "ticker": "SPYM",
        "description": "Low-cost passive US stock exposure..."
      }
    ]
  },
  "sources": [
    {
      "url": "https://www.morningstar.com/funds/...",
      "title": "3 Top US ETFs for 2026 and Beyond"
    }
  ],
  "key_metadata": {
    "credits_consumed": 10,
    "credits_remaining": 50990
  },
  "request_id": "2619440d-5ca6-45f2-a187-b80447bd1b4a"
}
```

### Examples

**Fast mode (default):**
```bash
curl "http://localhost:3000/search?q=What%20are%20good%20ETFs%20for%20investment"
```

**Ultra mode for deeper research:**
```bash
curl "http://localhost:3000/search?q=Best%20dividend%20ETFs%202026&mode=ultra"
```

**Auto fallback (fast → ultra):**
```bash
curl "http://localhost:3000/search?q=technology%20sector%20ETFs&mode=auto"
```

### Configuration

- **API Key:** `CONTEXT_DEV_API_KEY` environment variable (required, read-only on server-side)
- **Timeout:** 30 seconds
- **Retries:** 1 automatic retry on network errors (no retry on auth/validation errors)
- **Base URL:** `https://api.context.dev/v1`

### Implementation

- **Module:** [contextDev.js](./contextDev.js) — Context.dev wrapper with retry & fallback logic
- **Endpoint:** [index.js](./index.js) — Express `/search` route
- **Fallback:** On `fast` mode error, automatically retries with `ultra` mode when `mode=auto`

### Error Handling

| Status | Meaning |
|--------|---------|
| 400 | Missing `q` parameter |
| 401 | Invalid API key (`CONTEXT_DEV_API_KEY` not set or invalid) |
| 402 | Insufficient credits |
| 500 | Research failed (network error, timeout, etc.) |

All errors include a `detail` field explaining the failure.
