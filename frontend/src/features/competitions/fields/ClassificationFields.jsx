import { Field, Select } from "../../../components/ui/Fields.jsx";

// Puntuación y criterios explícitos de orden y avance.
export function ClassificationFields({ locked, form, rule }) {
  return (
    <fieldset disabled={locked}>
      <legend>Clasificación y avance</legend>
      <p>
        Los puntos por enfrentamiento y las marcas individuales se calculan con
        estas reglas.
      </p>
      {["victoria", "empate", "derrota", "avanzan"].map((key) => {
        const rules = form.reglamento.clasificacion || {
          victoria: 3,
          empate: 1,
          derrota: 0,
          avanzan: 2,
          criterios: ["puntos", "diferencia", "aFavor"],
          agregacion: "mejor",
        };
        return (
          <Field
            key={key}
            label={
              {
                victoria: "Puntos por victoria",
                empate: "Puntos por empate",
                derrota: "Puntos por derrota",
                avanzan: "Clasificados por grupo o prueba",
              }[key]
            }
            type="number"
            min={key === "avanzan" ? 1 : 0}
            value={rules[key]}
            onChange={(v) =>
              rule("clasificacion", { ...rules, [key]: Number(v) })
            }
          />
        );
      })}
      <Select
        label="Agregación de marcas"
        value={form.reglamento.clasificacion?.agregacion || "mejor"}
        onChange={(v) =>
          rule("clasificacion", {
            victoria: 3,
            empate: 1,
            derrota: 0,
            avanzan: 2,
            criterios: ["puntos", "diferencia", "aFavor"],
            ...(form.reglamento.clasificacion || {}),
            agregacion: v,
          })
        }
        options={["mejor", "suma", "promedio"]}
      />
      <p>
        Desempates por enfrentamientos: puntos, diferencia, a favor y victorias.
        Selecciona el orden.
      </p>
      {["puntos", "diferencia", "aFavor", "victorias"].map((key) => {
        const rules = form.reglamento.clasificacion || {
          victoria: 3,
          empate: 1,
          derrota: 0,
          avanzan: 2,
          criterios: ["puntos", "diferencia", "aFavor"],
          agregacion: "mejor",
        };
        return (
          <label className="check-line" key={key}>
            <input
              type="checkbox"
              checked={rules.criterios.includes(key)}
              onChange={(e) =>
                rule("clasificacion", {
                  ...rules,
                  criterios: e.target.checked
                    ? [...rules.criterios, key]
                    : rules.criterios.filter((k) => k !== key),
                })
              }
            />
            {key}
            {rules.criterios.includes(key)
              ? ` · prioridad ${rules.criterios.indexOf(key) + 1}`
              : ""}
          </label>
        );
      })}
    </fieldset>
  );
}
