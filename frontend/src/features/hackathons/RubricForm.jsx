import { useState } from "react";
import {
  Field,
  Select,
  Notice,
  Submit,
  useAction,
} from "../../components/ui/Workflow.jsx";

export function RubricForm({ event, rubric, onSaved }) {
  const [form, setForm] = useState(
      rubric || {
        criterios: [
          { nombre: "Innovación", minimo: 0, maximo: 10, peso: 25 },
          { nombre: "Impacto", minimo: 0, maximo: 10, peso: 25 },
          { nombre: "Viabilidad", minimo: 0, maximo: 10, peso: 25 },
          { nombre: "Presentación", minimo: 0, maximo: 10, peso: 25 },
        ],
        agregacion: "promedio",
        desempates: [],
        juradosMinimos: 1,
        politicaEmpates: "pendiente",
      },
    ),
    action = useAction(onSaved);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const update = (index, key, value) =>
    set(
      "criterios",
      form.criterios.map((c, i) => (i === index ? { ...c, [key]: value } : c)),
    );
  return (
    <form
      className="workflow-form"
      onSubmit={(e) => {
        e.preventDefault();
        action.run(`/hackatones/${event.id}/rubrica`, "PUT", {
          criterios: form.criterios.map((c) => ({
            ...(c.id ? { id: c.id } : {}),
            nombre: c.nombre,
            minimo: Number(c.minimo),
            maximo: Number(c.maximo),
            peso: Number(c.peso),
          })),
          agregacion: form.agregacion,
          desempates: form.desempates,
          juradosMinimos: Number(form.juradosMinimos),
          politicaEmpates: form.politicaEmpates,
        });
      }}
    >
      <p>
        Por jurado: suma de ((valor − mínimo) / (máximo − mínimo)) × peso. Los
        pesos deben sumar 100 %. La rúbrica se conserva al comenzar las
        evaluaciones.
      </p>
      {form.criterios.map((c, i) => (
        <fieldset key={i}>
          <legend>Criterio {i + 1}</legend>
          <Field
            label="Nombre"
            value={c.nombre}
            onChange={(v) => update(i, "nombre", v)}
          />
          <div className="form-row">
            <Field
              label="Mínimo"
              type="number"
              value={c.minimo}
              onChange={(v) => update(i, "minimo", v)}
            />
            <Field
              label="Máximo"
              type="number"
              value={c.maximo}
              onChange={(v) => update(i, "maximo", v)}
            />
            <Field
              label="Peso (%)"
              type="number"
              min={0.01}
              step="0.01"
              value={c.peso}
              onChange={(v) => update(i, "peso", v)}
            />
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              set(
                "criterios",
                form.criterios.filter((_, n) => n !== i),
              );
              set(
                "desempates",
                form.desempates.filter((x) => x !== (c.id || c.nombre)),
              );
            }}
          >
            Retirar criterio
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="button button-secondary"
        onClick={() =>
          set("criterios", [
            ...form.criterios,
            { nombre: "", minimo: 0, maximo: 10, peso: 0 },
          ])
        }
      >
        Agregar criterio
      </button>
      <div className="form-row">
        <Select
          label="Agregación entre jurados"
          value={form.agregacion}
          onChange={(v) => set("agregacion", v)}
          options={["promedio", "suma"]}
        />
        <Field
          label="Jurados mínimos por proyecto"
          type="number"
          min={1}
          max={20}
          value={form.juradosMinimos}
          onChange={(v) => set("juradosMinimos", v)}
        />
      </div>
      <fieldset>
        <legend>Desempates, en orden de selección</legend>
        {form.criterios
          .filter((c) => c.nombre)
          .map((c, i) => {
            const id = c.id || c.nombre;
            return (
              <label className="check-line" key={i}>
                <input
                  type="checkbox"
                  checked={form.desempates.includes(id)}
                  onChange={(e) =>
                    set(
                      "desempates",
                      e.target.checked
                        ? [...form.desempates, id]
                        : form.desempates.filter((x) => x !== id),
                    )
                  }
                />
                {c.nombre}
                {form.desempates.includes(id)
                  ? ` · prioridad ${form.desempates.indexOf(id) + 1}`
                  : ""}
              </label>
            );
          })}
      </fieldset>
      <Select
        label="Si persiste un empate por el primer lugar"
        value={form.politicaEmpates}
        onChange={(v) => set("politicaEmpates", v)}
        options={[
          { id: "pendiente", nombre: "Bloquear publicación hasta resolverlo" },
          { id: "compartido", nombre: "Publicar ganadores compartidos" },
        ]}
      />
      <Notice>{action.error}</Notice>
      <Submit busy={action.busy}>Guardar rúbrica</Submit>
    </form>
  );
}
