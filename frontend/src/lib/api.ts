const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    let message = `${res.status}`;
    try {
      const body = await res.json() as { error?: string; message?: string };
      if (body.message || body.error) message = body.message ?? body.error ?? message;
    } catch { /* non-JSON body */ }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}
