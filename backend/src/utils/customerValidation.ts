const VALID_ID_RE = /^[a-zA-Z0-9_\-.]{1,100}$/;

const HONEYPOT_WORDS = [
  'bot', 'crawler', 'spider', 'googlebot',
  'scan', 'test', 'admin', 'root', 'tmp', 'temp',
];

const BOT_UA_PATTERNS = [
  /Googlebot/i,
  /Googlebot-Image/i,
  /Bingbot/i,
  /\bSlurp\b/,
  /DuckDuckBot/i,
  /YandexBot/i,
  /Baiduspider/i,
  /Sogou\s+spider/i,
  /Exabot/i,
  /facebookexternalhit/i,
  /Twitterbot/i,
  /LinkedInBot/i,
  /\bcurl\b/i,
  /\bwget\b/i,
  /python-requests/i,
  /\bpython\//i,
  /Go-http-client/i,
  /node-fetch/i,
];

export function isValidCustomerId(id: string): boolean {
  return VALID_ID_RE.test(id);
}

export function isHoneypotId(id: string): boolean {
  const lower = id.toLowerCase();
  return HONEYPOT_WORDS.some(w => lower.includes(w));
}

export function isBotUserAgent(ua: string): boolean {
  return ua.length > 0 && BOT_UA_PATTERNS.some(re => re.test(ua));
}
