import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('Security Configuration', () => {
  it('Helmet CSP should be enabled', () => {
    const content = fs.readFileSync('server/index.js', 'utf8');
    expect(content).not.toContain('contentSecurityPolicy: false');
  });

  it('Rate limit trust proxy should be set', () => {
    const content = fs.readFileSync('server/index.js', 'utf8');
    expect(content).toContain('trust proxy');
  });

  it('CSP should include defaultSrc self directive', () => {
    const content = fs.readFileSync('server/index.js', 'utf8');
    expect(content).toContain("defaultSrc: [\"'self'\"]");
  });

  it('Input validation should block long URLs', () => {
    const content = fs.readFileSync('server/index.js', 'utf8');
    expect(content).toContain('url.length > 2048');
  });
});
