import { useState } from "react";
import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { api } from "../../api.js";
import { Notice as ErrorNotice } from "../../components/ui/Fields.jsx";
import { Brand } from "../../components/ui/Brand.jsx";
// Acceso local y creación única del administrador inicial.
export function LoginPage({ setup, onAuthenticated }) {
  const [form, setForm] = useState({
    nombre: "",
    correo: "",
    password: "",
    confirm: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
          <span className="eyebrow light-eyebrow">
            CONECTA. ORGANIZA. COMPITE.
          </span>
          <h1>
            Las grandes ideas
            <br />y las grandes
            <br />
            <em>competencias.</em>
          </h1>
          <p>
            Un punto de encuentro para las instituciones y los equipos que hacen
            posible cada evento.
          </p>
          <div className="auth-pills">
            <span>Intercolegiados</span>
            <span>Torneos</span>
            <span>Hackatones</span>
          </div>
        </div>
        <div className="auth-story-footer">
          <span className="status-dot" /> Juntos llegamos más lejos
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
          <span className="eyebrow">
            {setup ? "BIENVENIDO A CAMPUS" : "TU ESPACIO DE TRABAJO"}
          </span>
          <h2>{setup ? "Comencemos." : "Qué bueno verte."}</h2>
          <p className="auth-description">
            {setup
              ? "Crea tu cuenta de administrador para empezar a organizar tu comunidad."
              : "Ingresa con tu cuenta para continuar."}
          </p>
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
                placeholder={setup ? "Al menos 10 caracteres" : "Tu contraseña"}
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
          <p className="auth-note">
            <ShieldCheck size={14} />
            Tu cuenta y tus datos, en un espacio seguro.
          </p>
        </div>
        <footer className="auth-bottom">
          Campus · Gestión de competencias universitarias
        </footer>
      </section>
    </main>
  );
}
