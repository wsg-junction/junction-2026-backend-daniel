import express from 'express';
import rateLimit from 'express-rate-limit';

const app = express();
app.use(express.json());

// ponytail: global 2/s limit; per-IP if abuse becomes an issue
const limiter = rateLimit({
  windowMs: 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

function proxyTo(upstream, keyEnv) {
  return async (req, res) => {
    const key = process.env[keyEnv];
    if (!key) return res.status(500).json({ error: `${keyEnv} not set` });

    try {
      const upstreamRes = await fetch(upstream, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify(req.body),
      });

      res.status(upstreamRes.status);
      upstreamRes.headers.forEach((v, k) => {
        if (!['transfer-encoding', 'connection'].includes(k)) res.setHeader(k, v);
      });
      res.end(Buffer.from(await upstreamRes.arrayBuffer()));
    } catch (err) {
      res.status(502).json({ error: 'upstream error', detail: err.message });
    }
  };
}

app.get('/health', (_, res) => res.sendStatus(200));

app.post('/v1/chat/completions', proxyTo('https://api.featherless.ai/v1/chat/completions', 'FEATHERLESS_API_KEY'));
app.post('/nvidia/v1/chat/completions', proxyTo('https://integrate.api.nvidia.com/v1/chat/completions', 'NVIDIA_API_KEY'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`proxy listening on ${port}`));
