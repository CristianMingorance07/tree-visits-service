import { describe, expect, it } from 'vitest';
import {
  isValidCustomerId,
  isHoneypotId,
  isBotUserAgent,
} from '../src/utils/customerValidation';

describe('isValidCustomerId', () => {
  it('accepts alphanumeric IDs', () => {
    expect(isValidCustomerId('device123')).toBe(true);
  });

  it('accepts IDs with allowed special chars (- _ .)', () => {
    expect(isValidCustomerId('device-store-01')).toBe(true);
    expect(isValidCustomerId('user_abc.v2')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidCustomerId('')).toBe(false);
  });

  it('rejects IDs longer than 100 characters', () => {
    expect(isValidCustomerId('a'.repeat(101))).toBe(false);
  });

  it('rejects IDs with spaces', () => {
    expect(isValidCustomerId('device 01')).toBe(false);
  });

  it('rejects IDs with special chars (@, /, #)', () => {
    expect(isValidCustomerId('device@01')).toBe(false);
    expect(isValidCustomerId('../etc/passwd')).toBe(false);
    expect(isValidCustomerId('id#1')).toBe(false);
  });
});

describe('isHoneypotId', () => {
  it.each([
    'bot', 'BOT', 'mybot', 'crawler', 'spider',
    'googlebot', 'scan', 'scanner', 'test', 'admin',
    'root', 'tmp', 'temp', 'TempDevice',
  ])('flags honeypot ID: %s', (id) => {
    expect(isHoneypotId(id)).toBe(true);
  });

  it.each([
    'device-store-01', 'user123', 'iPhone-cristian',
    'visitor-42', 'store.pos.A',
  ])('does not flag legitimate ID: %s', (id) => {
    expect(isHoneypotId(id)).toBe(false);
  });
});

describe('isBotUserAgent', () => {
  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1)',
    'Mozilla/5.0 (compatible; Googlebot-Image/1.0)',
    'Mozilla/5.0 (compatible; Bingbot/2.0)',
    'Mozilla/5.0 (Slurp)',
    'DuckDuckBot/1.0',
    'Mozilla/5.0 (compatible; YandexBot/3.0)',
    'Baiduspider/2.0',
    'Mozilla/5.0 (compatible; Exabot)',
    'facebookexternalhit/1.1',
    'Twitterbot/1.0',
    'LinkedInBot/1.0',
    'curl/7.88.1',
    'Wget/1.21.4',
    'python-requests/2.28.0',
    'python/3.11',
    'Go-http-client/1.1',
    'node-fetch/3.3.2',
  ])('flags bot UA: %s', (ua) => {
    expect(isBotUserAgent(ua)).toBe(true);
  });

  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/125.0',
  ])('does not flag real browser UA: %s', (ua) => {
    expect(isBotUserAgent(ua)).toBe(false);
  });

  it('does not flag empty user-agent', () => {
    expect(isBotUserAgent('')).toBe(false);
  });
});
