// El access token solo vive en memoria. El refresh token permanece en una Cookie HttpOnly del servidor.
let csrfToken = null,
  accessToken = null,
  refreshing = null;
export function setCsrf(value) {
  csrfToken = value;
  if (!value) accessToken = null;
}
export function setSession(value) {
  csrfToken = value?.csrfToken || null;
  accessToken = value?.accessToken || null;
}

async function send(path, { body, method = "GET", signal } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (csrfToken && method !== "GET") headers["X-CSRF-Token"] = csrfToken;
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: "same-origin",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("No pudimos conectar con el servidor. Intenta nuevamente.");
  }
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function api(path, options = {}) {
  let result = await send(path, options);
  if (
    result.response.status === 401 &&
    ![
      "/auth/login",
      "/auth/logout",
      "/auth/refresh",
      "/setup/administrador",
    ].includes(path)
  ) {
    // Las peticiones que vencen juntas comparten UNA rotación, para no reutilizar un refresh ya consumido.
    if (!refreshing)
      refreshing = send("/auth/refresh", { method: "POST", body: {} })
        .then(({ response, payload }) => {
          if (!response.ok) {
            setSession(null);
            window.dispatchEvent(new Event("campus:unauthenticated"));
            throw Object.assign(
              new Error(payload.error?.message || "Inicia sesión nuevamente."),
              { status: 401 },
            );
          }
          setSession(payload.data);
        })
        .finally(() => {
          refreshing = null;
        });
    await refreshing;
    result = await send(path, options); // La petición original se reintenta una sola vez.
  }
  const { response, payload } = result;
  if (!response.ok)
    throw Object.assign(
      new Error(payload.error?.message || "No se pudo completar la solicitud."),
      { status: response.status, code: payload.error?.code },
    );
  return payload.data;
}
