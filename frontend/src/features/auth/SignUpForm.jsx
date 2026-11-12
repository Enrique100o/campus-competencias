import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { api } from "../../api.js";
import { Field, Notice } from "../../components/ui/Fields.jsx";
import { Submit } from "../../components/ui/Workflow.jsx";

export function SignUpForm({ onAuthenticated, onLogin }) {
  const [step, setStep] = useState(1);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (step === 1) {
      if (nombre.trim().length < 2)
        return setError("Escribe tu nombre completo.");
      setStep(2);
      return;
    }
    setBusy(true);
    try {
      const session = await api("/auth/registro", {
        method: "POST",
        body: { nombre: nombre.trim(), correo: correo.trim(), password },
      });
      onAuthenticated(session);
    } catch (err) {
      if (err.status === 409) setStep(1);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ol className="signup-steps" aria-label="Pasos para crear tu cuenta">
        <li aria-current={step === 1 ? "step" : undefined}>1. Tus datos</li>
        <li aria-current={step === 2 ? "step" : undefined}>2. Contraseña</li>
      </ol>
      <form className="auth-form" onSubmit={submit}>
        {step === 1 ? (
          <div key="datos" className="signup-fields">
            <Field
              label="Nombre completo"
              value={nombre}
              onChange={setNombre}
              autoComplete="name"
              minLength={2}
              maxLength={100}
              autoFocus
            />
            <Field
              label="Correo electrónico"
              value={correo}
              onChange={setCorreo}
              type="email"
              autoComplete="email"
              maxLength={254}
            />
          </div>
        ) : (
          <div key="clave" className="signup-fields">
            <p className="signup-email">{correo}</p>
            <div className="password-field">
              <Field
                label="Contraseña"
                value={password}
                onChange={setPassword}
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                aria-describedby="signup-password-help"
                autoFocus
                disabled={busy}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={
                  visible ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                onClick={() => setVisible((value) => !value)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="form-help" id="signup-password-help">
              Usa al menos 10 caracteres.
            </p>
          </div>
        )}
        <Notice>{error}</Notice>
        {step === 1 ? (
          <button className="button button-primary">
            Continuar <ArrowRight size={17} />
          </button>
        ) : (
          <div className="signup-actions">
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={() => {
                setError("");
                setStep(1);
              }}
            >
              <ArrowLeft size={17} /> Atrás
            </button>
            <Submit busy={busy}>Crear cuenta</Submit>
          </div>
        )}
      </form>
      <div className="auth-switch">
        <span>¿Ya tienes cuenta?</span>
        <button
          type="button"
          className="button button-secondary"
          disabled={busy}
          onClick={() => onLogin(correo)}
        >
          Iniciar sesión
        </button>
      </div>
    </>
  );
}
