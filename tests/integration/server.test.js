import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';

const BASE_URL = 'http://localhost:3002';
const TEST_PORT = 3002;

// ── SSE parser helper ────────────────────────────────────────────────────
function parseSSEEvents(text) {
  const events = [];
  const blocks = text.split('\n\n').filter(Boolean);
  for (const block of blocks) {
    for (const line of block.split('\n')) {
      if (line.startsWith('data: ')) {
        try { events.push(JSON.parse(line.slice(6))); }
        catch { events.push(line.slice(6)); }
      }
    }
  }
  return events;
}

// ── Suite ───────────────────────────────────────────────────────────────
describe('Server API Integration', () => {
  let serverProcess;

  beforeAll(async () => {
    serverProcess = spawn('node', ['server/index.js'], {
      env: { ...process.env, PORT: String(TEST_PORT), NODE_ENV: 'test' },
      cwd: '/tmp/chatgpt-exporter',
      stdio: 'pipe',
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        serverProcess.kill('SIGTERM');
        reject(new Error('Server start timeout after 15s'));
      }, 15000);

      serverProcess.stdout.on('data', (data) => {
        if (data.toString().includes('ChatGPT Exporter')) {
          clearTimeout(timeout);
          setTimeout(resolve, 800);
        }
      });

      serverProcess.stderr.on('data', (d) => {
        const msg = d.toString();
        if (!msg.includes('Deprecation') && !msg.includes('Warning')
            && !msg.includes('ERR_ERL_KEY_GEN_IPV6') && !msg.includes('Legacy share')
            && !msg.includes('[scraper]') && !msg.includes('[pool]')) {
          console.error('[server]', msg.trim());
        }
      });

      serverProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }, 20000);

  afterAll(() => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
      setTimeout(() => {
        try { if (serverProcess && !serverProcess.killed) serverProcess.kill('SIGKILL'); }
        catch { /* gone */ }
      }, 3000);
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // GET /api/health
  // ══════════════════════════════════════════════════════════════════════
  describe('GET /api/health', () => {
    it('returns 200 with { status: "ok" }, no-store, and json content-type', async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toEqual({ status: 'ok' });

      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('content-type')).toContain('application/json');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // GET /api/stats
  // ══════════════════════════════════════════════════════════════════════
  describe('GET /api/stats', () => {
    it('returns 200 with complete metrics shape', async () => {
      const res = await fetch(`${BASE_URL}/api/stats`);
      expect(res.status).toBe(200);
      const data = await res.json();

      // Top-level keys
      expect(data).toHaveProperty('uptime_seconds');
      expect(data).toHaveProperty('scrapes');
      expect(data).toHaveProperty('cache');
      expect(data).toHaveProperty('queue');
      expect(data).toHaveProperty('memory_mb');

      // uptime is a positive number
      expect(typeof data.uptime_seconds).toBe('number');
      expect(data.uptime_seconds).toBeGreaterThanOrEqual(0);

      // scrapes sub-keys
      expect(data.scrapes).toHaveProperty('total');
      expect(data.scrapes).toHaveProperty('success');
      expect(data.scrapes).toHaveProperty('failed');
      expect(data.scrapes).toHaveProperty('success_rate');
      expect(data.scrapes).toHaveProperty('fastpath_pct');
      expect(data.scrapes).toHaveProperty('playwright_pct');

      // cache sub-keys
      expect(data.cache).toHaveProperty('hits');
      expect(data.cache).toHaveProperty('misses');
      expect(data.cache).toHaveProperty('hit_rate');

      // queue sub-keys
      expect(data.queue).toHaveProperty('enqueued');
      expect(data.queue).toHaveProperty('completed');

      // memory_mb is a numeric string
      expect(typeof data.memory_mb).toBe('string');
      expect(parseFloat(data.memory_mb)).not.toBeNaN();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // GET /og-image.png (NOT under /api rate limiter)
  // ══════════════════════════════════════════════════════════════════════
  describe('GET /og-image.png', () => {
    it('returns 200 with valid PNG image and 1-day cache', async () => {
      const res = await fetch(`${BASE_URL}/og-image.png`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/png');
      expect(res.headers.get('cache-control')).toContain('max-age=86400');

      const buffer = await res.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);

      const bytes = new Uint8Array(buffer);
      // PNG magic: 89 50 4E 47
      expect(bytes[0]).toBe(0x89);
      expect(bytes[1]).toBe(0x50);
      expect(bytes[2]).toBe(0x4E);
      expect(bytes[3]).toBe(0x47);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // POST /api/jobs
  // ══════════════════════════════════════════════════════════════════════
  describe('POST /api/jobs', () => {
    it('rejects empty body {} with 400', async () => {
      const res = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toHaveProperty('error');
    });

    it('rejects non-string URL type with 400', async () => {
      const res = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 12345 }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Valid ChatGPT share URL required.');
    });

    it('rejects invalid URL string "not-a-url" with 400', async () => {
      const res = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'not-a-url' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Valid ChatGPT share URL required.');
    });

    it('rejects non-ChatGPT domain with 400', async () => {
      const res = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://google.com/share/test' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Valid ChatGPT share URL required.');
    });

    it('rejects localhost URL (SSRF) with 400', async () => {
      const res = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'http://localhost/share/test' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects private IP 127.0.0.1 (SSRF) with 400', async () => {
      const res = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'http://127.0.0.1/share/test' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects URL > 2048 chars with "URL too long" error', async () => {
      const longPath = 'a'.repeat(2100);
      const res = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `https://chatgpt.com/share/${longPath}` }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('URL too long');
    });

    it('accepts valid chatgpt.com share URL → jobId + status', async () => {
      const res = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://chatgpt.com/share/test-integration-123' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('jobId');
      expect(typeof data.jobId).toBe('string');
      expect(data.jobId.length).toBeGreaterThan(0);
      expect(data).toHaveProperty('status');
      expect(['queued', 'done']).toContain(data.status);
    });

    it('accepts legacy chat.openai.com share URL', async () => {
      const res = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://chat.openai.com/share/legacy-test-id' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('jobId');
      expect(data).toHaveProperty('status');
    });

    it('assigns unique jobIds for different requests', async () => {
      const a = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://chatgpt.com/share/first-job' }),
      }).then(r => r.json());

      const b = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://chatgpt.com/share/second-job' }),
      }).then(r => r.json());

      expect(a.jobId).not.toBe(b.jobId);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // GET /api/jobs/:jobId
  // ══════════════════════════════════════════════════════════════════════
  describe('GET /api/jobs/:jobId', () => {
    it('returns 404 for non-existent job', async () => {
      const res = await fetch(`${BASE_URL}/api/jobs/nonexistent-job-id-xyz`);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Job not found');
    });

    it('returns created job with correct fields after POST', async () => {
      const created = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://chatgpt.com/share/test-fetch-job' }),
      }).then(r => r.json());

      expect(created).toHaveProperty('jobId');

      const res = await fetch(`${BASE_URL}/api/jobs/${created.jobId}`);
      expect(res.status).toBe(200);

      const job = await res.json();
      expect(job.id).toBe(created.jobId);
      expect(job).toHaveProperty('url');
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('createdAt');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // POST /api/scrape (SSE)
  // ══════════════════════════════════════════════════════════════════════
  describe('POST /api/scrape', () => {
    it('rejects invalid URL with 400', async () => {
      const res = await fetch(`${BASE_URL}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'not-a-url' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Valid ChatGPT share URL required.');
    });

    it('rejects empty body {} with 400', async () => {
      const res = await fetch(`${BASE_URL}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('returns text/event-stream + no-cache + keep-alive for valid URL', async () => {
      const res = await fetch(`${BASE_URL}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://chatgpt.com/share/sse-ct-test' }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      expect(res.headers.get('cache-control')).toContain('no-cache');
      expect(res.headers.get('connection')).toBe('keep-alive');
    });

    it('SSE stream delivers progress events for valid URL', async () => {
      const res = await fetch(`${BASE_URL}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://chatgpt.com/share/sse-stream-test' }),
      });
      expect(res.status).toBe(200);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      try {
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
          const { done, value } = await reader.read();
          if (value) fullText += decoder.decode(value, { stream: !done });
          if (done || fullText.includes('"type":"done"') || fullText.includes('"type":"error"'))
            break;
          await new Promise(r => setTimeout(r, 200));
        }
      } finally {
        try { reader.releaseLock(); } catch { /* ok */ }
      }

      expect(fullText).toMatch(/^data: /m);
      const events = parseSSEEvents(fullText);
      expect(events.length).toBeGreaterThan(0);

      const firstEvent = events[0];
      if (typeof firstEvent === 'object') {
        expect(firstEvent).toHaveProperty('phase');
      }
    }, 20000);
  });

  // ══════════════════════════════════════════════════════════════════════
  // Security Headers (Helmet)
  // ══════════════════════════════════════════════════════════════════════
  describe('Security headers', () => {
    it('sends Content-Security-Policy with default-src and frame-src directives', async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      const csp = res.headers.get('content-security-policy');
      expect(csp).toBeTruthy();
      expect(csp).toContain('default-src');
      expect(csp).toContain('frame-src');
    });

    it('sends X-Content-Type-Options: nosniff', async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    });

    it('sends Referrer-Policy: strict-origin-when-cross-origin', async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    });

    it('sends HSTS and CORS headers', async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      // HSTS
      expect(res.headers.get('strict-transport-security')).toBeTruthy();
      // CORS
      expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
    });

    it('sends rate-limit headers on /api routes', async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      const limit = res.headers.get('ratelimit-limit')
                 || res.headers.get('x-ratelimit-limit');
      expect(limit).toBeTruthy();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // GET / (Root — not under /api rate limiter)
  // ══════════════════════════════════════════════════════════════════════
  describe('GET /', () => {
    it('returns 200 (with OG tags) if dist built, or 404', async () => {
      const res = await fetch(`${BASE_URL}/`);
      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        const html = await res.text();
        expect(html).toContain('og:title');
        expect(html).toContain('og:image');
        expect(html).toContain('twitter:card');
      } else {
        expect(await res.text()).toBe('Not Found');
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Unknown routes (non-/api, bypassing rate limiter)
  // ══════════════════════════════════════════════════════════════════════
  describe('Unknown routes', () => {
    it('returns 404 for unknown GET', async () => {
      const res = await fetch(`${BASE_URL}/zzz-nonexistent-path`);
      expect(res.status).toBe(404);
    });

    it('returns 404 for unknown POST', async () => {
      const res = await fetch(`${BASE_URL}/zzz-nonexistent-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(404);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Known behavior: missing Content-Type on /api/jobs → 500
  // (server destructures undefined req.body — robustness improvement needed)
  // ══════════════════════════════════════════════════════════════════════
  describe('Edge cases', () => {
    it('POST /api/jobs without Content-Type returns 500 (known: body destructuring on undefined)', async () => {
      const res = await fetch(`${BASE_URL}/api/jobs`, {
        method: 'POST',
        body: JSON.stringify({ url: 'https://chatgpt.com/share/x' }),
      });
      // Express json() parser with type:"application/json" skips parsing
      // without Content-Type, leaving req.body undefined
      expect([400, 500]).toContain(res.status);
    });
  });
});
