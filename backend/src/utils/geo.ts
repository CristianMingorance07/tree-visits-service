export interface GeoResult {
  country: string;
  countryCode: string;
  city: string;
}

// Private / non-routable IP ranges — geo lookup would return nothing useful
const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd)/;

export async function lookupGeo(ip: string): Promise<GeoResult | null> {
  if (!ip || PRIVATE_IP.test(ip)) return null;
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,city`,
      { signal: controller.signal },
    );
    clearTimeout(tid);
    if (!res.ok) return null;
    const data = await res.json() as {
      status: string; country: string; countryCode: string; city: string;
    };
    if (data.status !== 'success') return null;
    return { country: data.country, countryCode: data.countryCode, city: data.city };
  } catch {
    return null;
  }
}

export function parseLanguage(acceptLanguage: string): string | null {
  const code = acceptLanguage.split(',')[0]?.split(';')[0]?.trim().slice(0, 2);
  if (!code || !/^[a-z]{2}$/i.test(code)) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code.toLowerCase()) ?? code;
  } catch {
    return code;
  }
}
