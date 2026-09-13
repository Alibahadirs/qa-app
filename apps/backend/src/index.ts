import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API route'ları Faz 1'de buraya eklenecek (/test-cases, /test-suites)

app.listen(port, () => {
  console.log(`[backend] http://localhost:${port} — health: /health`);
});
