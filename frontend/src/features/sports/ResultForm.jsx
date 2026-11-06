import { useState } from "react";
import { Modal } from "../../components/ui/Modal.jsx";
import {
  Field,
  Select,
  Notice,
  Submit,
  useAction,
} from "../../components/ui/Workflow.jsx";

// El usuario introduce marcas; el servidor determina puestos, ganador y clasificación.
export function ResultForm({ event, competition, result, onClose, onSaved }) {
  const [marks, setMarks] = useState(
    competition.participaciones.map((p) => {
      const old = result?.marcas.find((m) => m.inscripcion === p.inscripcion);
      return {
        inscripcion: p.inscripcion,
        nombre: p.nombre,
        estado: old?.estado || "valido",
        valor: old?.valor ?? "",
        desempate: old?.desempate ?? "",
      };
    }),
  );
  const [reason, setReason] = useState(""),
    action = useAction(onSaved);
  const update = (index, key, value) =>
    setMarks((m) =>
      m.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    );
  return (
    <Modal
      title={result ? "Corregir resultado" : "Registrar resultado"}
      onClose={onClose}
      busy={action.busy}
    >
      <p>
        Métrica: {event.reglamento.metrica} · Unidad: {event.reglamento.unidad}{" "}
        · {event.reglamento.precision} decimales.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const marcas = marks.map(
            ({ inscripcion, estado, valor, desempate }) => ({
              inscripcion,
              estado,
              valor: estado === "valido" ? Number(valor) : null,
              ...(estado === "valido" && desempate !== ""
                ? { desempate: Number(desempate) }
                : {}),
            }),
          );
          action.run(
            result ? `/resultados/${result.id}` : "/resultados",
            result ? "PATCH" : "POST",
            {
              competencia: competition.id,
              marcas,
              ...(result ? { motivo: reason } : {}),
            },
          );
        }}
      >
        {marks.map((m, i) => (
          <fieldset key={m.inscripcion}>
            <legend>{m.nombre}</legend>
            <Select
              label="Estado de participación"
              value={m.estado}
              onChange={(v) => update(i, "estado", v)}
              options={[
                "valido",
                "descalificado",
                "no_presentacion",
                "abandono",
              ]}
            />
            {m.estado === "valido" && (
              <div className="form-row">
                <Field
                  label={`Resultado (${event.reglamento.unidad})`}
                  type="number"
                  min={0}
                  step={10 ** -event.reglamento.precision}
                  value={m.valor}
                  onChange={(v) => update(i, "valor", v)}
                />
                <Field
                  label="Desempate numérico (mayor gana)"
                  type="number"
                  min={0}
                  required={false}
                  value={m.desempate}
                  onChange={(v) => update(i, "desempate", v)}
                />
              </div>
            )}
          </fieldset>
        ))}
        {result && (
          <Field
            label="Motivo de corrección"
            value={reason}
            onChange={setReason}
            minLength={5}
          />
        )}
        <Notice>{action.error}</Notice>
        <Submit busy={action.busy}>
          {result ? "Corregir y recalcular" : "Guardar resultado"}
        </Submit>
      </form>
    </Modal>
  );
}
