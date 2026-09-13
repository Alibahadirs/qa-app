import './env.js';
import cors from 'cors';
import express from 'express';
import { errorHandler } from './lib/errors.js';
import { testCasesRouter } from './routes/testCases.js';
import { testSuitesRouter } from './routes/testSuites.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/test-cases', testCasesRouter);
app.use('/test-suites', testSuitesRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

app.use(errorHandler);

app.listen(port, () => {
  console.log(`[backend] http://localhost:${port} — health: /health`);
});
