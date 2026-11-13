import { useState } from "react";
import { Modal } from "../../components/ui/Modal.jsx";
import {
  Field,
  Notice,
  Submit,
  useAction,
} from "../../components/ui/Workflow.jsx";

export function BirthDateDialog({ account, onClose, onSaved }) {
  const [date, setDate] = useState(account.nacimiento);
  const action = useAction(onSaved);
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Bogota",
  });
  return (
    <Modal
      title="Editar fecha de nacimiento"
      onClose={onClose}
      busy={action.busy}
    >
      <p>
        {account.nombre} · {account.edad} años
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!action.busy)
            action.run(`/usuarios/${account.id}/nacimiento`, "PATCH", {
              nacimiento: date,
            });
        }}
      >
        <Field
          label="Fecha de nacimiento"
          type="date"
          value={date}
          onChange={setDate}
          min="1900-01-01"
          max={today}
          disabled={action.busy}
        />
        <Notice>{action.error}</Notice>
        <div className="dialog-actions">
          <button
            type="button"
            className="button button-secondary"
            disabled={action.busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <Submit busy={action.busy}>Guardar fecha</Submit>
        </div>
      </form>
    </Modal>
  );
}
