import { useEffect, useRef, useState } from "react";
import { Building2, Check, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { api } from "../../api.js";
import { Notice as ErrorNotice } from "../../components/ui/Fields.jsx";
import { types, blankInstitution } from "./config.js";
// Alta y edición completa con PUT; el estado inactivo conserva relaciones históricas.
export function InstitutionDialog({ institution, onClose, onSaved }) {
  const dialog = useRef(null);
  const [form, setForm] = useState(institution || blankInstitution);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current.showModal();
  }, []);
  const update = (event) =>
    setForm((old) => ({ ...old, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        institution ? `/instituciones/${institution.id}` : "/instituciones",
        {
          method: institution ? "PUT" : "POST",
          body: {
            nombre: form.nombre,
            ciudad: form.ciudad,
            departamento: form.departamento,
            tipo: form.tipo,
            estado: form.estado,
          },
        },
      );
      onSaved(
        institution ? "Institución actualizada." : "Institución registrada.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      className="institution-dialog"
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="institution-dialog-title"
    >
      <div className="dialog-heading">
        <span className="dialog-icon">
          <Building2 size={24} />
        </span>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="Cerrar formulario"
        >
          <X size={20} />
        </button>
      </div>
      <h2 id="institution-dialog-title">
        {institution ? "Editar institución" : "Una nueva institución"}
      </h2>
      <p>Agrega la información de la institución educativa.</p>
      <form onSubmit={submit}>
        <label>
          Nombre de la institución
          <input
            autoFocus
            name="nombre"
            value={form.nombre}
            onChange={update}
            required
            minLength={2}
            maxLength={150}
            placeholder="Ej. Universidad del Norte"
          />
        </label>
        <div className="form-row">
          <label>
            Ciudad/municipio
            <input
              name="ciudad"
              value={form.ciudad}
              onChange={update}
              required
              minLength={2}
              maxLength={100}
              placeholder="Ej. Barranquilla"
            />
          </label>
          <label>
            Departamento
            <input
              name="departamento"
              value={form.departamento}
              onChange={update}
              required
              minLength={2}
              maxLength={100}
              placeholder="Ej. Atlántico"
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Tipo de institución
            <select name="tipo" value={form.tipo} onChange={update}>
              {Object.entries(types).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select name="estado" value={form.estado} onChange={update}>
              <option value="activo">Activa</option>
              <option value="inactivo">Inactiva</option>
            </select>
          </label>
        </div>
        <div className="form-hint">
          <ShieldCheck size={16} />
          <span>Una institución inactiva permanece en el historial.</span>
        </div>
        <ErrorNotice>{error}</ErrorNotice>
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
              <LoaderCircle className="spin" size={17} />
            ) : (
              <>
                <Check size={17} />
                {institution ? "Guardar cambios" : "Registrar institución"}
              </>
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}
