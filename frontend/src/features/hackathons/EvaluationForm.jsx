import { useState } from "react";
import { Modal } from "../../components/ui/Modal.jsx";
import {
  Field,
  Select,
  TextArea,
  Notice,
  Submit,
  useAction,
} from "../../components/ui/Workflow.jsx";

export function EvaluationForm({ project, rubric, item, onClose, onSaved }) {
  const [scores, setScores] = useState(
      Object.fromEntries(
        rubric.criterios.map((c) => [
          c.id,
          item?.criterios.find((x) => x.criterio === c.id)?.valor ?? "",
        ]),
      ),
    ),
    [state, setState] = useState(item?.estado || "borrador"),
    [note, setNote] = useState(item?.observaciones || ""),
    [reason, setReason] = useState(""),
    action = useAction(onSaved);
  return (
    <Modal
      title={`${item ? "Corregir evaluación" : "Evaluar"}: ${project.nombre}`}
      onClose={onClose}
      busy={action.busy}
    >
      <p>
        Rúbrica versión {rubric.version}. El total se calcula en el servidor
        sobre 100.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const criterios = Object.entries(scores)
            .filter(([, v]) => v !== "")
            .map(([criterio, valor]) => ({ criterio, valor: Number(valor) }));
          action.run(
            item ? `/evaluaciones/${item.id}` : "/evaluaciones",
            item ? "PATCH" : "POST",
            {
              proyecto: project.id,
              criterios,
              observaciones: note,
              estado: state,
              ...(reason ? { motivo: reason } : {}),
            },
          );
        }}
      >
        {rubric.criterios.map((c) => (
          <Field
            key={c.id}
            label={`${c.nombre} · peso ${c.peso}% · rango ${c.minimo}–${c.maximo}`}
            type="number"
            min={c.minimo}
            max={c.maximo}
            step="any"
            required={state === "enviada"}
            value={scores[c.id]}
            onChange={(v) => setScores((old) => ({ ...old, [c.id]: v }))}
          />
        ))}
        <TextArea label="Observaciones" value={note} onChange={setNote} />
        <Select
          label="Estado"
          value={state}
          onChange={setState}
          options={
            item?.estado === "enviada" ? ["enviada"] : ["borrador", "enviada"]
          }
        />
        {item?.estado === "enviada" && (
          <Field
            label="Motivo de corrección"
            value={reason}
            minLength={5}
            onChange={setReason}
          />
        )}
        <Notice>{action.error}</Notice>
        <Submit busy={action.busy}>
          {state === "enviada" ? "Enviar evaluación" : "Guardar borrador"}
        </Submit>
      </form>
    </Modal>
  );
}
