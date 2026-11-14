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

app.post('/v1/chat/completions', async (req, res) => {
  const key = process.env.FEATHERLESS_API_KEY;
  if (!key) return res.status(500).json({ error: 'FEATHERLESS_API_KEY not set' });

  try {
    const upstream = await fetch('https://api.featherless.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(req.body),
    });

    res.status(upstream.status);
    upstream.headers.forEach((v, k) => {
      if (!['transfer-encoding', 'connection'].includes(k)) res.setHeader(k, v);
    });
    const data = await upstream.arrayBuffer();
    res.end(Buffer.from(data));
  } catch (err) {
    res.status(502).json({ error: 'upstream error', detail: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`proxy listening on ${port}`));
