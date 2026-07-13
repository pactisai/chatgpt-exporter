import { describe, it, expect } from 'vitest';
import { isValidShareUrl, getChatGptShareId } from '../../../core/validate.js';

describe('isValidShareUrl', () => {
  describe('valid URLs', () => {
    it('accepts modern chatgpt.com share URL', () => {
      expect(isValidShareUrl('https://chatgpt.com/share/abc123def456')).toBe(true);
    });

    it('accepts chatgpt.com share URL with hyphenated ID', () => {
      expect(isValidShareUrl('https://chatgpt.com/share/xyz-789')).toBe(true);
    });

    it('accepts legacy chat.openai.com share URL', () => {
      expect(isValidShareUrl('https://chat.openai.com/share/old-format-id')).toBe(true);
    });
  });

  describe('invalid URLs', () => {
    it('rejects empty string', () => {
      expect(isValidShareUrl('')).toBe(false);
    });

    it('rejects null', () => {
      expect(isValidShareUrl(null)).toBe(false);
    });

    it('rejects undefined', () => {
      expect(isValidShareUrl(undefined)).toBe(false);
    });

    it('rejects non-string (number)', () => {
      expect(isValidShareUrl(123)).toBe(false);
    });

    it('rejects non-URL plain text', () => {
      expect(isValidShareUrl('not-a-url')).toBe(false);
    });

    it('rejects non-ChatGPT domain (google.com)', () => {
      expect(isValidShareUrl('https://google.com')).toBe(false);
    });

    it('rejects chatgpt.com homepage (not a share URL)', () => {
      expect(isValidShareUrl('https://chatgpt.com/not-a-share')).toBe(false);
    });

    it('rejects FTP protocol', () => {
      expect(isValidShareUrl('ftp://chatgpt.com/share/test')).toBe(false);
    });

    it('rejects gopher protocol', () => {
      expect(isValidShareUrl('gopher://chatgpt.com/share/test')).toBe(false);
    });
  });

  describe('SSRF protection — blocked hostnames', () => {
    it('blocks localhost', () => {
      expect(isValidShareUrl('http://localhost/share/test')).toBe(false);
    });

    it('blocks 127.0.0.1', () => {
      expect(isValidShareUrl('http://127.0.0.1/share/test')).toBe(false);
    });

    it('blocks 0.0.0.0', () => {
      expect(isValidShareUrl('http://0.0.0.0/share/test')).toBe(false);
    });

    it('blocks IPv6 loopback [::1]', () => {
      expect(isValidShareUrl('http://[::1]/share/test')).toBe(false);
    });

    it('blocks IPv6 unspecified [::]', () => {
      expect(isValidShareUrl('http://[::]/share/test')).toBe(false);
    });

    it('blocks "0" hostname', () => {
      expect(isValidShareUrl('http://0/share/test')).toBe(false);
    });
  });

  describe('SSRF protection — private IP ranges', () => {
    it('blocks 10.0.0.0/8 (10.0.0.1)', () => {
      expect(isValidShareUrl('http://10.0.0.1/share/test')).toBe(false);
    });

    it('blocks 10.255.255.255 (edge of 10.0.0.0/8)', () => {
      expect(isValidShareUrl('http://10.255.255.255/share/test')).toBe(false);
    });

    it('blocks 172.16.0.0/12 (172.16.0.1)', () => {
      expect(isValidShareUrl('http://172.16.0.1/share/test')).toBe(false);
    });

    it('blocks 172.31.255.255 (edge of 172.16.0.0/12)', () => {
      expect(isValidShareUrl('http://172.31.255.254/share/test')).toBe(false);
    });

    it('blocks 192.168.0.0/16 (192.168.1.1)', () => {
      expect(isValidShareUrl('http://192.168.1.1/share/test')).toBe(false);
    });

    it('blocks 127.0.0.0/8 (127.99.99.99)', () => {
      expect(isValidShareUrl('http://127.99.99.99/share/test')).toBe(false);
    });

    it('blocks 169.254.0.0/16 link-local (169.254.169.254)', () => {
      expect(isValidShareUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
    });

    it('blocks 0.0.0.0/8 (0.1.2.3)', () => {
      expect(isValidShareUrl('http://0.1.2.3/share/test')).toBe(false);
    });
  });

  describe('SSRF protection — domain allowlist bypass attempts', () => {
    it('blocks lookalike domain (chatgpt.com.evil.com)', () => {
      expect(isValidShareUrl('https://chatgpt.com.evil.com/share/test')).toBe(false);
    });

    it('blocks subdomain injection (evil.chatgpt.com)', () => {
      // chatgpt-share-parser uses URL.hostname which is evil.chatgpt.com
      // endsWith("chatgpt.com") → true, so domain check passes
      // But the parser checks hostname === "chatgpt.com" or "chat.openai.com"
      // So isChatGptShareUrl should reject it at the parser layer
      expect(isValidShareUrl('https://evil.chatgpt.com/share/test')).toBe(false);
    });
  });
});

describe('getChatGptShareId', () => {
  it('extracts share ID from modern chatgpt.com URL', () => {
    expect(getChatGptShareId('https://chatgpt.com/share/abc123def456')).toBe('abc123def456');
  });

  it('extracts share ID from hyphenated ID', () => {
    expect(getChatGptShareId('https://chatgpt.com/share/xyz-789')).toBe('xyz-789');
  });

  it('extracts share ID from legacy chat.openai.com URL', () => {
    expect(getChatGptShareId('https://chat.openai.com/share/old-format-id')).toBe('old-format-id');
  });

  it('returns null for non-share URL', () => {
    expect(getChatGptShareId('https://chatgpt.com/not-a-share')).toBe(null);
  });

  it('returns null for non-ChatGPT domain', () => {
    expect(getChatGptShareId('https://google.com/share/test')).toBe(null);
  });

  it('returns null for non-URL input', () => {
    expect(getChatGptShareId('not-a-url')).toBe(null);
  });

  it('returns null for empty string', () => {
    expect(getChatGptShareId('')).toBe(null);
  });
});
