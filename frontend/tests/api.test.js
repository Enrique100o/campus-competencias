import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const originalFetch = globalThis.fetch,
  originalWindow = globalThis.window;
afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
});
async function client() {
  const source = await readFile(
    new URL("../src/api.js", import.meta.url),
    "utf8",
  );
  globalThis.window = new EventTarget();
  return import(
    "data:text/javascript;base64," +
      Buffer.from(source).toString("base64") +
      "#" +
      Math.random()
  );
}
const response = (status, payload) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => payload,
});

describe("Cliente HTTP y recuperación de sesión", () => {
  it("comparte una sola rotación entre peticiones simultáneas y reintenta sus cuerpos", async () => {
    const { api, setSession } = await client();
    setSession({ accessToken: "vencido", csrfToken: "csrf-viejo" });
    let refreshes = 0;
    const bodies = [];
    globalThis.fetch = async (url, options) => {
      if (url === "/api/auth/refresh") {
        refreshes++;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return response(200, {
          data: { accessToken: "nuevo", csrfToken: "csrf-nuevo" },
        });
      }
      if (options.headers.Authorization === "Bearer vencido")
        return response(401, { error: { message: "Vencido" } });
      assert.equal(options.headers.Authorization, "Bearer nuevo");
      assert.equal(options.headers["X-CSRF-Token"], "csrf-nuevo");
      bodies.push(JSON.parse(options.body));
      return response(201, { data: { guardado: true } });
    };
    const results = await Promise.all(
      [1, 2, 3].map((numero) =>
        api("/proyectos", { method: "POST", body: { numero } }),
      ),
    );
    assert.equal(refreshes, 1);
    assert.equal(results.length, 3);
    assert.deepEqual(bodies.map((b) => b.numero).sort(), [1, 2, 3]);
  });
  it("un refresh rechazado vuelve al acceso y no repite una escritura", async () => {
    const { api, setSession } = await client();
    setSession({ accessToken: "viejo", csrfToken: "csrf" });
    let writes = 0,
      notifications = 0;
    window.addEventListener("campus:unauthenticated", () => notifications++);
    globalThis.fetch = async (url) => {
      if (url !== "/api/auth/refresh") writes++;
      return response(401, { error: { message: "Inicia sesión" } });
    };
    await assert.rejects(
      api("/proyectos", { method: "POST", body: { nombre: "Prueba" } }),
      (e) => e.status === 401,
    );
    assert.equal(writes, 1);
    assert.equal(notifications, 1);
  });
  it("no intenta renovar un login con contraseña incorrecta", async () => {
    const { api } = await client();
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return response(401, { error: { message: "Credenciales inválidas" } });
    };
    await assert.rejects(
      api("/auth/login", {
        method: "POST",
        body: { correo: "x@example.test", password: "ficticia" },
      }),
      (e) => e.status === 401,
    );
    assert.equal(calls, 1);
  });
  it("reintenta la petición original una sola vez aunque continúe en 401", async () => {
    const { api } = await client();
    let requests = 0,
      refreshes = 0;
    globalThis.fetch = async (url) => {
      if (url === "/api/auth/refresh") {
        refreshes++;
        return response(200, {
          data: { accessToken: "nuevo", csrfToken: "nuevo" },
        });
      }
      requests++;
      return response(401, { error: { message: "Sin acceso" } });
    };
    await assert.rejects(api("/torneos"), (e) => e.status === 401);
    assert.equal(refreshes, 1);
    assert.equal(requests, 2);
  });
});
