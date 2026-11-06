import { Field, Select, TextArea } from "../../../components/ui/Fields.jsx";
// Parámetros del reglamento conservado al abrir las inscripciones.
export function SportsRuleFields({ locked, form, rule }) {
  return (
    <fieldset className="form-section" disabled={locked}>
      <legend>Reglamento deportivo</legend>
      <p>
        {locked
          ? "El reglamento queda conservado al abrir inscripciones."
          : "Define las reglas de esta competencia antes de abrir las inscripciones."}
      </p>
      <div className="form-row">
        <Field
          label="Integrantes mínimos"
          type="number"
          min={1}
          max={100}
          value={form.reglamento.integrantesMin}
          onChange={(v) => rule("integrantesMin", v)}
          disabled={form.unidadInscripcion === "individual"}
        />
        <Field
          label="Integrantes máximos"
          type="number"
          min={1}
          max={100}
          value={form.reglamento.integrantesMax}
          onChange={(v) => rule("integrantesMax", v)}
          disabled={form.unidadInscripcion === "individual"}
        />
      </div>
      <Field
        label="Inscripciones por competidor"
        type="number"
        min={1}
        max={30}
        value={form.reglamento.maxInscripciones}
        onChange={(v) => rule("maxInscripciones", v)}
      />
      <div className="form-row">
        <Select
          label="Métrica del resultado"
          value={form.reglamento.metrica}
          onChange={(v) => rule("metrica", v)}
          options={["goles", "puntos", "sets", "tiempo", "distancia", "otra"]}
        />
        <Field
          label="Unidad del resultado"
          value={form.reglamento.unidad}
          onChange={(v) => rule("unidad", v)}
          maxLength={40}
        />
      </div>
      <div className="form-row">
        <Field
          label="Decimales"
          type="number"
          min={0}
          max={6}
          value={form.reglamento.precision}
          onChange={(v) => rule("precision", v)}
        />
        <Select
          label="Orden de clasificación"
          value={form.reglamento.orden}
          onChange={(v) => rule("orden", v)}
          options={["ascendente", "descendente"]}
        />
      </div>
      <TextArea
        label="Fases o rondas (una por línea)"
        value={form.reglamento.fases.join("\n")}
        onChange={(v) => rule("fases", v.split("\n"))}
        required
      />
      <TextArea
        label="Criterios de avance"
        value={form.reglamento.avance}
        onChange={(v) => rule("avance", v)}
        required
        maxLength={1000}
      />
      <TextArea
        label="Desempates (uno por línea, en orden)"
        value={form.reglamento.desempates.join("\n")}
        onChange={(v) => rule("desempates", v.split("\n"))}
        required
      />
      <TextArea
        label="Pruebas (una por línea)"
        value={form.reglamento.pruebas.join("\n")}
        onChange={(v) => rule("pruebas", v.split("\n"))}
        required={form.formato === "pruebas"}
      />
      <TextArea
        label="Requisitos de participación"
        value={form.reglamento.requisitos}
        onChange={(v) => rule("requisitos", v)}
      />
      <label className="check-label">
        <input
          type="checkbox"
          checked={form.reglamento.permiteMultiplesEquipos}
          onChange={(e) => rule("permiteMultiplesEquipos", e.target.checked)}
        />
        Permitir un integrante en varios equipos del torneo
      </label>
    </fieldset>
  );
}
