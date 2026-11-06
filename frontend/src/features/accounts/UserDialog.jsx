import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  LoaderCircle,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { api } from "../../api.js";

const roles = {
  administrador: "Administrador",
  organizador: "Organizador",
  participante: "Participante",
  jurado: "Jurado",
};
const blankUser = {
  nombre: "",
  correo: "",
  rol: "participante",
  estado: "activo",
  password: "",
};

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

// Formulario de cuentas: ningún campo privado del modelo se devuelve al navegador.
export function UserDialog({
  account,
  currentUser,
  onClose,
  onSaved,
  onLogout,
}) {
  const dialog = useRef(null);
  const [form, setForm] = useState(
    account ? { ...account, password: "" } : blankUser,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ownAccount = account?.id === currentUser.id;
  useEffect(() => {
    dialog.current.showModal();
  }, []);
  const update = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body = {
        nombre: form.nombre,
        correo: form.correo,
        rol: form.rol,
        estado: form.estado,
      };
      if (!account || form.password) body.password = form.password;
      await api(account ? `/usuarios/${account.id}` : "/usuarios", {
        method: account ? "PATCH" : "POST",
        body,
      });
      onSaved(account ? "Cuenta actualizada." : "Cuenta registrada.");
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      className="institution-dialog"
      ref={dialog}
      aria-labelledby="user-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-heading">
        <span className="dialog-icon">
          <UserRound size={24} />
        </span>
        <button
          className="icon-button"
          type="button"
          aria-label="Cerrar formulario de usuario"
          onClick={onClose}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </div>
      <h2 id="user-dialog-title">
        {account ? "Editar usuario" : "Un nuevo usuario"}
      </h2>
      <p>
        {account
          ? "Actualiza la información y los permisos de esta cuenta."
          : "Crea una cuenta para que otra persona pueda acceder a Campus."}
      </p>
      <form onSubmit={submit}>
        <label>
          Nombre completo
          <input
            name="nombre"
            autoComplete="off"
            required
            minLength={2}
            maxLength={100}
            value={form.nombre}
            onChange={update}
            placeholder="Nombre de la persona"
          />
        </label>
        <label>
          Correo electrónico
          <input
            name="correo"
            type="email"
            autoComplete="off"
            required
            maxLength={254}
            value={form.correo}
            onChange={update}
            placeholder="nombre@institucion.edu.co"
          />
        </label>
        <div className="form-row">
          <label>
            Rol
            <select name="rol" value={form.rol} onChange={update}>
              {Object.entries(roles).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select
              name="estado"
              value={form.estado}
              onChange={update}
              disabled={ownAccount}
            >
              <option value="activo">Activa</option>
              <option value="inactivo">Inactiva</option>
            </select>
          </label>
        </div>
        <label>
          {account ? "Nueva contraseña (opcional)" : "Contraseña inicial"}
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
            required={!account}
            value={form.password}
            onChange={update}
            placeholder={
              account
                ? "Déjala vacía para conservar la actual"
                : "Al menos 10 caracteres"
            }
          />
        </label>
        <div className="form-hint">
          <ShieldCheck size={16} />
          <span>
            {ownAccount ? "Tu propia cuenta debe permanecer activa. " : ""}
            {account
              ? "Cambiar la contraseña cierra las sesiones de esa cuenta."
              : "La persona podrá ingresar con este correo y su contraseña inicial."}
          </span>
        </div>
        <Notice>{error}</Notice>
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <>
                <Check size={17} />
                {account ? "Guardar cambios" : "Registrar usuario"}
              </>
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}
