import express from 'express';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const aiChatHandler = require('./ai/chat.js');

const app = express();
app.use(express.json({ limit: '1mb' }));

function buildReference(prefix) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

function asText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function sendCors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

app.use('/api', (_req, res, next) => {
  sendCors(res);
  next();
});

app.options('/api/*path', (_req, res) => res.status(200).end());

app.post('/api/bookings/create', (req, res) => {
  const draft = req.body?.draft || {};
  if (!asText(draft.category) || !asText(draft.address)) {
    return res.status(400).json({ error: 'Missing required booking fields: category and address.' });
  }
  return res.json({
    bookingId: buildReference('CLN'),
    status: 'submitted',
    submittedAt: req.body?.submittedAt || new Date().toISOString(),
    mode: 'local-dev-api'
  });
});

app.post('/api/providers/apply', (req, res) => {
  const providerData = req.body?.providerData || {};
  if (!asText(providerData.serviceArea) || !asText(providerData.hourlyRate)) {
    return res.status(400).json({ error: 'Missing required provider fields: service area and hourly rate.' });
  }
  return res.json({
    applicationId: buildReference('PRV'),
    status: 'pending',
    submittedAt: req.body?.submittedAt || new Date().toISOString(),
    mode: 'local-dev-api'
  });
});


app.post('/api/jobs/respond', (req, res) => {
  const response = asText(req.body?.response, 40);
  const jobId = asText(req.body?.jobId, 120);
  if (!jobId || !['accepted', 'declined'].includes(response)) {
    return res.status(400).json({ error: 'Invalid job response.' });
  }
  return res.json({ ok: true, jobId, response, mode: 'local-dev-api' });
});

app.all('/api/ai/chat', (req, res) => aiChatHandler(req, res));

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`[dev-api] listening on http://localhost:${port}`);
});
