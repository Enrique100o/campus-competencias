import { useState } from "react";
import { Modal } from "../../components/ui/Modal.jsx";
import {
  Field,
  Select,
  Notice,
  Submit,
  useAction,
  stateLabel,
  localDate,
} from "../../components/ui/Workflow.jsx";

const transitions = {
  torneos: {
    borrador: ["inscripciones", "cancelado"],
    inscripciones: ["en_curso", "cancelado"],
    en_curso: ["finalizado", "cancelado"],
    finalizado: ["en_curso"],
    cancelado: ["inscripciones", "en_curso"],
  },
  hackatones: {
    borrador: ["inscripciones", "cancelado"],
    inscripciones: ["entrega", "cancelado"],
    entrega: ["evaluacion", "cancelado"],
    evaluacion: ["publicado", "cancelado"],
    publicado: ["evaluacion"],
    cancelado: ["inscripciones", "entrega", "evaluacion"],
  },
};
// La interfaz propone transiciones; el servicio verifica fechas, resultados y permisos antes de aplicarlas.
export function StageControls({ kind, event, onChanged }) {
  const [state, setState] = useState(""),
    [reason, setReason] = useState(""),
    [dates, setDates] = useState(null);
  const action = useAction(() => {
    setState("");
    setReason("");
    setDates(null);
    onChanged();
  });
  const keys = [
    "inscripcionInicio",
    "inscripcionFin",
    "inicio",
    "fin",
    ...(kind === "hackatones"
      ? ["entregaInicio", "entregaFin", "evaluacionInicio", "evaluacionFin"]
      : []),
  ];
  const titles = {
    inscripcionInicio: "Apertura de inscripciones",
    inscripcionFin: "Cierre de inscripciones",
    inicio: "Inicio del evento",
    fin: "Fin del evento",
    entregaInicio: "Apertura de entregas",
    entregaFin: "Cierre de entregas",
    evaluacionInicio: "Inicio de evaluación",
    evaluacionFin: "Fin de evaluación",
  };
  return (
    <section className="workflow-controls">
      <strong>Etapa: {stateLabel(event.estado)}</strong>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          action.run(`/${kind}/${event.id}/estado`, "PATCH", {
            estado: state,
            ...(reason ? { motivo: reason } : {}),
          });
        }}
      >
        <Select
          label="Siguiente etapa"
          value={state}
          onChange={setState}
          options={(transitions[kind][event.estado] || []).map((id) => ({
            id,
            nombre: stateLabel(id),
          }))}
        />
        <Field
          label="Motivo de cancelación o reapertura"
          required={
            state === "cancelado" ||
            ["cancelado", "finalizado", "publicado"].includes(event.estado)
          }
          value={reason}
          onChange={setReason}
          minLength={5}
        />
        <Submit busy={action.busy}>Cambiar etapa</Submit>
        <button
          type="button"
          className="button button-secondary"
          onClick={() =>
            setDates(
              Object.fromEntries(keys.map((k) => [k, localDate(event[k])])),
            )
          }
        >
          Ajustar fechas
        </button>
      </form>
      <Notice>{action.error}</Notice>
      {dates && (
        <Modal
          title="Ajustar fechas con trazabilidad"
          busy={action.busy}
          onClose={() => setDates(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action.run(`/${kind}/${event.id}/fechas`, "PATCH", {
                ...Object.fromEntries(
                  keys.map((k) => [k, new Date(dates[k]).toISOString()]),
                ),
                motivo: reason,
              });
            }}
          >
            {keys.map((k) => (
              <Field
                key={k}
                label={titles[k]}
                type="datetime-local"
                value={dates[k]}
                onChange={(v) => setDates((d) => ({ ...d, [k]: v }))}
              />
            ))}
            <Field
              label="Motivo del ajuste"
              value={reason}
              onChange={setReason}
              minLength={5}
            />
            <Notice>{action.error}</Notice>
            <Submit busy={action.busy}>Guardar fechas</Submit>
          </form>
        </Modal>
      )}
    </section>
  );
}
