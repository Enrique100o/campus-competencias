import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  LoaderCircle,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import { api } from "../../api.js";

const roles = {
  administrador: "Administrador",
  organizador: "Organizador",
  participante: "Participante",
  jurado: "Jurado",
};
const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

function Notice({ children }) {
  return (
    children && (
      <div className="error-notice" role="alert">
        <AlertCircle size={18} />
        <span>{children}</span>
      </div>
    )
  );
}

// El servidor confirma la contraseña actual antes de cambiar el correo.
export function ProfilePanel({ user, onUserChanged, onLogout }) {
  const [form, setForm] = useState({
    nombre: user.nombre,
    correo: user.correo,
    currentPassword: "",
  });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const emailChanged = form.correo.trim().toLowerCase() !== user.correo;
  const update = (event) => {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
    setSaved(false);
  };
  useEffect(() => {
    setForm({ nombre: user.nombre, correo: user.correo, currentPassword: "" });
  }, [user.nombre, user.correo]);
  function edit() {
    setEditing(true);
    setError("");
    setSaved(false);
  }
  function cancel() {
    setEditing(false);
    setError("");
    setForm({ nombre: user.nombre, correo: user.correo, currentPassword: "" });
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/usuarios/me", {
        method: "PATCH",
        body: {
          nombre: form.nombre,
          correo: form.correo,
          ...(emailChanged ? { currentPassword: form.currentPassword } : {}),
        },
      });
      onUserChanged(await api("/auth/me"));
      setEditing(false);
      setForm((previous) => ({ ...previous, currentPassword: "" }));
      setSaved(true);
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow">TU CUENTA</span>
      <h1>Mi perfil</h1>
      <p className="page-description">
        Mantén actualizada tu información personal.
      </p>
      <section className="profile-card">
        <div className="profile-heading">
          <span className="avatar profile-avatar">{initials(user.nombre)}</span>
          {!editing && (
            <button className="button button-secondary" onClick={edit}>
              <Pencil size={15} />
              Editar perfil
            </button>
          )}
        </div>
        <h2>{user.nombre}</h2>
        <span className="role-pill">{roles[user.rol]}</span>
        {editing ? (
          <form className="profile-form" onSubmit={submit}>
            <label>
              Nombre completo
              <input
                name="nombre"
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
                value={form.nombre}
                onChange={update}
              />
            </label>
            <label>
              Correo electrónico
              <input
                name="correo"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
                value={form.correo}
                onChange={update}
              />
            </label>
            {emailChanged && (
              <>
                <label>
                  Contraseña actual
                  <input
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={128}
                    value={form.currentPassword}
                    onChange={update}
                  />
                </label>
                <div className="form-hint">
                  <ShieldCheck size={16} />
                  <span>
                    Confirma tu contraseña actual para cambiar el correo con el
                    que ingresas.
                  </span>
                </div>
              </>
            )}
            <Notice>{error}</Notice>
            <div className="dialog-actions">
              <button
                className="button button-secondary"
                type="button"
                disabled={busy}
                onClick={cancel}
              >
                Cancelar
              </button>
              <button className="button button-primary" disabled={busy}>
                {busy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <>
                    <Check size={17} />
                    Guardar mi perfil
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <dl>
            <div>
              <dt>Correo electrónico</dt>
              <dd>{user.correo}</dd>
            </div>
            <div>
              <dt>Estado de la cuenta</dt>
              <dd>
                <span className="badge badge-active">
                  <span />
                  Activa
                </span>
              </dd>
            </div>
          </dl>
        )}
        {saved && (
          <div className="success-notice" role="status">
            <Check size={17} />
            <span>Tu perfil fue actualizado.</span>
          </div>
        )}
      </section>
    </>
  );
}
