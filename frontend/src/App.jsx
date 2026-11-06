import { useEffect, useRef, useState } from "react";
import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react";
import { api, setCsrf, setSession as configureSession } from "./api.js";
import { Brand } from "./components/ui/Brand.jsx";
import { LoginPage } from "./features/auth/LoginPage.jsx";
import { Workspace } from "./features/layout/Workspace.jsx";
// App restaura la sesión; las pantallas y formularios viven en módulos independientes.
export default function App() {
  const [session, setSession] = useState(null);
  const [setup, setSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    async function load() {
      try {
        const status = await api("/setup/status");
        if (!active) return;
        setSetup(status.needsSetup);
        try {
          const current = await api("/auth/me");
          if (active) {
            configureSession(current);
            setSession(current);
          }
        } catch (err) {
          if (err.status !== 401) throw err;
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [retry]);
  function authenticated(current) {
    configureSession(current);
    setSession(current);
    setSetup(false);
  }
  // Una referencia estable evita reiniciar la consulta del directorio en cada render.
  const loggedOut = useRef(() => {
    setCsrf(null);
    setSession(null);
  }).current;
  useEffect(() => {
    window.addEventListener("campus:unauthenticated", loggedOut);
    return () =>
      window.removeEventListener("campus:unauthenticated", loggedOut);
  }, [loggedOut]);
  if (loading)
    return (
      <main className="start-screen">
        <Brand />
        <LoaderCircle className="spin" size={29} />
        <p>Preparando tu espacio…</p>
      </main>
    );
  if (error)
    return (
      <main className="start-screen">
        <Brand />
        <div className="connection-card">
          <AlertCircle size={29} />
          <h1>No pudimos conectar</h1>
          <p>{error}</p>
          <button
            className="button button-primary"
            onClick={() => setRetry((value) => value + 1)}
          >
            <RefreshCw size={17} />
            Volver a intentar
          </button>
        </div>
      </main>
    );
  return session ? (
    <Workspace
      user={session.user}
      onLogout={loggedOut}
      onUserChanged={authenticated}
    />
  ) : (
    <LoginPage setup={setup} onAuthenticated={authenticated} />
  );
}
