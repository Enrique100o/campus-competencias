import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, X, Trash2 } from "lucide-react";
import { api } from "../../api.js";
import { Notice as ErrorNotice } from "../../components/ui/Fields.jsx";

// La API impide borrar instituciones utilizadas; la alternativa es desactivarlas.
export function InstitutionDeleteDialog({
  institution,
  onClose,
  onSaved,
  onLogout,
}) {
  const dialog = useRef(null);
  const cancel = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    dialog.current.showModal();
    cancel.current.focus();
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy || (blocked && institution.estado === "inactivo")) return;
    setBusy(true);
    setError("");
    try {
      await api(
        `/instituciones/${institution.id}`,
        blocked
          ? { method: "PATCH", body: { estado: "inactivo" } }
          : { method: "DELETE" },
      );
      onSaved(blocked ? "Institución desactivada." : "Institución eliminada.");
    } catch (err) {
      if (err.status === 401) onLogout();
      else if (err.status === 404)
        onSaved("La institución ya no está disponible.");
      else {
        if (err.code === "INSTITUTION_IN_USE") setBlocked(true);
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      className="institution-dialog delete-dialog"
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="institution-delete-title"
      aria-describedby="institution-delete-description"
    >
      <div className="dialog-heading">
        <span className="dialog-icon">
          <Trash2 size={24} />
        </span>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="Cerrar confirmación"
        >
          <X size={20} />
        </button>
      </div>
      <h2 id="institution-delete-title">
        {blocked ? "Conservar el historial" : "¿Eliminar institución?"}
      </h2>
      <p id="institution-delete-description">
        {blocked ? (
          <>
            La institución <strong>{institution.nombre}</strong> tiene registros
            relacionados y debe permanecer en la base de datos.
          </>
        ) : (
          <>
            Se eliminará <strong>{institution.nombre}</strong> de la base de
            datos. Esta acción no se puede deshacer.
          </>
        )}
      </p>
      <form onSubmit={submit}>
        <ErrorNotice>{error}</ErrorNotice>
        {blocked && (
          <p className="form-help">
            {institution.estado === "activo"
              ? "Puedes desactivarla para impedir nuevas participaciones y mantener los registros existentes."
              : "La institución ya está inactiva y conserva sus registros existentes."}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            type="button"
            ref={cancel}
            onClick={onClose}
            disabled={busy}
          >
            {blocked ? "Cerrar" : "Cancelar"}
          </button>
          {(!blocked || institution.estado === "activo") && (
            <button
              className={`button ${blocked ? "button-primary" : "button-danger"}`}
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : blocked ? (
                <>
                  <Check size={17} />
                  Desactivar institución
                </>
              ) : (
                <>
                  <Trash2 size={17} />
                  Eliminar institución
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
