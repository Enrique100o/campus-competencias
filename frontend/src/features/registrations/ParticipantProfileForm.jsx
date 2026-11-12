import { useState } from "react";
import { Field, Notice, Select } from "../../components/ui/Fields.jsx";
import { Submit } from "../../components/ui/Workflow.jsx";

export function ParticipantProfileForm({
  institutions,
  busy,
  error,
  onSave,
  onBack,
}) {
  const [form, setForm] = useState({
    documento: "",
    nacimiento: "",
    genero: "",
    institucion: "",
  });
  const update = (key) => (value) =>
    setForm((old) => ({ ...old, [key]: value }));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(form);
      }}
    >
      <p>
        Completa tu ficha una sola vez. Estos datos se usan para comprobar los
        requisitos de los eventos.
      </p>
      <Field
        label="Número de documento"
        value={form.documento}
        onChange={update("documento")}
        minLength={2}
        maxLength={30}
      />
      <Field
        label="Fecha de nacimiento"
        type="date"
        value={form.nacimiento}
        onChange={update("nacimiento")}
        min="1900-01-01"
        autoComplete="bday"
      />
      <Select
        label="Género"
        value={form.genero}
        onChange={update("genero")}
        options={["femenino", "masculino", "otro"]}
      />
      <Select
        label="Institución educativa"
        value={form.institucion}
        onChange={update("institucion")}
        options={institutions}
      />
      {!institutions.length && (
        <p className="form-help">
          Pídele a la organización que agregue tu institución a Campus.
        </p>
      )}
      <Notice>{error}</Notice>
      <div className="dialog-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onBack}
          disabled={busy}
        >
          Atrás
        </button>
        {institutions.length > 0 && <Submit busy={busy}>Guardar ficha</Submit>}
      </div>
    </form>
  );
}
