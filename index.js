import express from 'express';
import rateLimit from 'express-rate-limit';
import { researchWebWithFallback } from './contextDev.js';

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  next();
});
app.options('/{*path}', (_, res) => res.sendStatus(204));

// ponytail: global 2/s limit; per-IP if abuse becomes an issue
const limiter = rateLimit({ windowMs: 1000, max: 2, standardHeaders: true, legacyHeaders: false });
app.use(limiter);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`));
  next();
});

function proxyTo(upstream, keyEnv) {
  return async (req, res) => {
    const key = process.env[keyEnv];
    if (!key) return res.status(500).json({ error: `${keyEnv} not set` });

    console.log(`→ ${upstream} model=${req.body?.model}`);
    try {
      const upstreamRes = await fetch(upstream, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify(req.body),
      });

      console.log(`← ${upstream} ${upstreamRes.status}`);
      res.status(upstreamRes.status);
      upstreamRes.headers.forEach((v, k) => {
        if (!['transfer-encoding', 'connection', 'content-encoding'].includes(k)) res.setHeader(k, v);
      });
      res.end(Buffer.from(await upstreamRes.arrayBuffer()));
    } catch (err) {
      console.error(`upstream error ${upstream}: ${err.message}`);
      res.status(502).json({ error: 'upstream error', detail: err.message });
    }
  };
}

app.get('/health', (_, res) => res.sendStatus(200));

app.get('/search', async (req, res) => {
  try {
    const { q, mode } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Missing required query parameter: q' });
    }

    const jsonFormat = {
      query: q,
      suggestions: Array(5).fill({ name: '', description: '' }),
      sources: [{ url: '', title: '' }],
    };

    console.log(`→ Context.dev /web/answers query="${q}" mode=${mode || 'auto'}`);

    const result = await researchWebWithFallback(q, jsonFormat, {
      mode: mode || 'auto',
      timeout: 30000,
    });

    console.log(`← Context.dev /web/answers success`);
    res.json(result);
  } catch (error) {
    console.error(`Context.dev error: ${error.message}`);
    res.status(error.message.includes('401') ? 401 : error.message.includes('402') ? 402 : 500).json({
      error: 'Research failed',
      detail: error.message,
    });
  }
});



app.post('/v1/chat/completions', proxyTo('https://api.featherless.ai/v1/chat/completions', 'FEATHERLESS_API_KEY'));
app.post('/nvidia/v1/chat/completions', proxyTo('https://integrate.api.nvidia.com/v1/chat/completions', 'NVIDIA_API_KEY'));
app.post('/nemotron/v1/chat/completions', proxyTo('https://containers.datacrunch.io/nemotron-3-5-super-vl-b300/v1/chat/completions', 'VERDA_INFERENCE_KEY'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`proxy listening on ${port}`));
