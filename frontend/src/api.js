let csrfToken = null;

export function setCsrf(value) { csrfToken = value; }

export async function api(path, options = {}) {
  const { body, method = 'GET', signal } = options;
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (csrfToken && method !== 'GET') headers['X-CSRF-Token'] = csrfToken;
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method, headers, credentials: 'same-origin',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('No pudimos conectar con el servidor. Intenta nuevamente.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || 'No se pudo completar la solicitud.');
    error.status = response.status;
    error.code = payload.error?.code;
    throw error;
  }
  return payload.data;
}
