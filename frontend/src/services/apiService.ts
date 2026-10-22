type Result<T> = { ok: boolean; status: number; data: T | null };
const apiService = {
  async backendCall<T>(method: string, url: string, body?: unknown): Promise<Result<T>> {
    const response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (response.status === 401 && !url.startsWith('/Auth/')) window.dispatchEvent(new Event('pagebuilder:session-expired'));
    return { ok: response.ok, status: response.status, data };
  },
};
export default apiService;
