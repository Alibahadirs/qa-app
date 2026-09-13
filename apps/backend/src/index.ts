import './env.js';
import cors from 'cors';
import express from 'express';
import { errorHandler } from './lib/errors.js';
import { UPLOAD_DIR, UPLOAD_ROUTE } from './lib/uploads.js';
import { testCasesRouter } from './routes/testCases.js';
import { statsRouter } from './routes/stats.js';
import { testRunsRouter } from './routes/testRuns.js';
import { testSuitesRouter } from './routes/testSuites.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(UPLOAD_ROUTE, express.static(UPLOAD_DIR, { index: false, maxAge: '1h' }));

app.use('/test-cases', testCasesRouter);
app.use('/test-suites', testSuitesRouter);
app.use('/test-runs', testRunsRouter);
app.use('/stats', statsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

app.use(errorHandler);

app.listen(port, () => {
  console.log(`[backend] http://localhost:${port} — health: /health`);
});
