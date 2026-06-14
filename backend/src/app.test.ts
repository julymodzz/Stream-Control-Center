import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Minimal integration test for health endpoint pattern
describe('API health', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.get('/api/health', (_req, res) => {
      res.json({ success: true, data: { status: 'ok', version: '2.0.0' } });
    });
  });

  it('returns health status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });
});
