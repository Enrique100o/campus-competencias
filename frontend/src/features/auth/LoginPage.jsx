import { useState } from "react";
import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { api } from "../../api.js";
import { Notice as ErrorNotice } from "../../components/ui/Fields.jsx";
import { Brand } from "../../components/ui/Brand.jsx";
import { SignUpForm } from "./SignUpForm.jsx";
// Acceso local y creación única del administrador inicial.
export function LoginPage({ setup, onAuthenticated }) {
  const [signUp, setSignUp] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    correo: "",
    password: "",
    confirm: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function showLogin(correo) {
    setForm((old) => ({ ...old, correo, password: "" }));
    setError("");
    setSignUp(false);
  }
  const update = (event) =>
    setForm((old) => ({ ...old, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    setError("");
    if (setup && form.password !== form.confirm)
      return setError("Las contraseñas deben coincidir.");
    setBusy(true);
    try {
      const session = await api(
        setup ? "/setup/administrador" : "/auth/login",
        {
          method: "POST",
          body: {
            nombre: form.nombre,
            correo: form.correo,
            password: form.password,
          },
        },
      );
      onAuthenticated(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand light />
        <div className="auth-story-content">
          <h1>
            Encuentra tu próxima <em>competencia.</em>
          </h1>
          <p>
            Explora torneos y hackatones, inscríbete y consulta el estado de tu
            participación.
          </p>
          <div className="auth-pills">
            <span>Intercolegiados</span>
            <span>Torneos</span>
            <span>Hackatones</span>
          </div>
        </div>
        <div className="auth-orbit orbit-one" />
        <div className="auth-orbit orbit-two" />
      </section>
      <section className="auth-form-area">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-card">
          <div className="auth-icon">
            <ShieldCheck size={27} />
          </div>
          <h2>
            {setup
              ? "Configura Campus"
              : signUp
                ? "Crea tu cuenta"
                : "Iniciar sesión"}
          </h2>
          <p className="auth-description">
            {setup
              ? "Crea tu cuenta de administrador para empezar a organizar tu comunidad."
              : signUp
                ? "Crea tu cuenta de participante para inscribirte en eventos."
                : "Ingresa con tu correo y contraseña."}
          </p>
          {signUp ? (
            <SignUpForm onAuthenticated={onAuthenticated} onLogin={showLogin} />
          ) : (
            <>
              <form onSubmit={submit} className="auth-form">
                {setup && (
                  <label>
                    Nombre completo
                    <input
                      autoComplete="name"
                      name="nombre"
                      value={form.nombre}
                      onChange={update}
                      minLength={2}
                      maxLength={100}
                      required
                      placeholder="Tu nombre"
                    />
                  </label>
                )}
                <label>
                  Correo electrónico
                  <input
                    autoComplete="username"
                    type="email"
                    name="correo"
                    value={form.correo}
                    onChange={update}
                    maxLength={254}
                    required
                    placeholder="nombre@institucion.edu.co"
                  />
                </label>
                <label>
                  Contraseña
                  <input
                    autoComplete={setup ? "new-password" : "current-password"}
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={update}
                    minLength={setup ? 10 : 1}
                    maxLength={128}
                    required
                    placeholder={
                      setup ? "Al menos 10 caracteres" : "Tu contraseña"
                    }
                  />
                </label>
                {setup && (
                  <label>
                    Confirmar contraseña
                    <input
                      autoComplete="new-password"
                      type="password"
                      name="confirm"
                      value={form.confirm}
                      onChange={update}
                      minLength={10}
                      maxLength={128}
                      required
                      placeholder="Repite tu contraseña"
                    />
                  </label>
                )}
                <ErrorNotice>{error}</ErrorNotice>
                <button
                  className="button button-primary auth-submit"
                  disabled={busy}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <>
                      {setup ? "Crear mi cuenta" : "Iniciar sesión"}
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
              {!setup && (
                <div className="auth-switch">
                  <span>¿Es tu primera vez en Campus?</span>
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={busy}
                    onClick={() => setSignUp(true)}
                  >
                    Crear cuenta
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        <footer className="auth-bottom">
          Campus · Gestión de competencias universitarias
        </footer>
      </section>
    </main>
  );
}
