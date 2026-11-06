import { SportsRuleFields } from "./SportsRuleFields.jsx";
import { TextArea } from "../../../components/ui/Fields.jsx";

// Datos generales, ventanas y reglas de torneos y hackatones.
export function EventFields({
  form,
  set,
  type,
  select,
  locked,
  available,
  catalogs,
  discipline,
  field,
  owners,
  rule,
}) {
  return (
    <>
      <TextArea
        label="Descripción"
        value={form.descripcion}
        onChange={(v) => set("descripcion", v)}
        required={type === "hackatones"}
      />
      {type === "torneos" ? (
        <>
          {select("tipo", "Tipo de torneo", [
            "intercolegiados",
            "universitario",
          ])}
          <fieldset className="form-section" disabled={locked}>
            <legend>Disciplina y formato</legend>
            {select(
              "disciplina",
              "Disciplina",
              available(catalogs.disciplinas, "disciplina"),
            )}
            {select(
              "categoria",
              "Categoría deportiva",
              discipline?.categorias || [],
            )}
            <div className="form-row">
              {select(
                "unidadInscripcion",
                "Modalidad de inscripción",
                discipline?.modalidades || [],
              )}
              {select(
                "formato",
                "Formato de competencia",
                discipline?.formatos || [],
              )}
            </div>
          </fieldset>
        </>
      ) : (
        select("modalidad", "Modalidad del hackatón", [
          "presencial",
          "virtual",
          "hibrida",
        ])
      )}
      <div className="form-row">
        {field("ciudad", "Ciudad/municipio", { minLength: 2 })}
        {field("departamento", "Departamento", { minLength: 2 })}
      </div>
      <fieldset className="form-section">
        <legend>Fechas y ventanas</legend>
        <div className="form-row">
          {field("inscripcionInicio", "Apertura de inscripciones", {
            type: "datetime-local",
          })}
          {field("inscripcionFin", "Cierre de inscripciones", {
            type: "datetime-local",
          })}
        </div>
        <div className="form-row">
          {field("inicio", "Inicio del evento", {
            type: "datetime-local",
          })}
          {field("fin", "Fin del evento", { type: "datetime-local" })}
        </div>
        {type === "hackatones" && (
          <>
            <div className="form-row">
              {field("entregaInicio", "Inicio de entregas", {
                type: "datetime-local",
              })}
              {field("entregaFin", "Fin de entregas", {
                type: "datetime-local",
              })}
            </div>
            <div className="form-row">
              {field("evaluacionInicio", "Inicio de evaluación", {
                type: "datetime-local",
              })}
              {field("evaluacionFin", "Fin de evaluación", {
                type: "datetime-local",
              })}
            </div>
          </>
        )}
      </fieldset>
      <div className="form-row">
        {field(
          "cupos",
          type === "hackatones" ? "Cupos de equipos" : "Cupos de inscripciones",
          { type: "number", min: 1, max: 10000 },
        )}
        {select(
          "responsable",
          "Responsable del evento",
          available(owners, "responsable"),
        )}
      </div>
      {type === "hackatones" && (
        <>
          <div className="form-row">
            {field("integrantesMin", "Integrantes mínimos", {
              type: "number",
              min: 1,
              max: 100,
            })}
            {field("integrantesMax", "Integrantes máximos", {
              type: "number",
              min: 1,
              max: 100,
            })}
          </div>
          {field("proyectosPorEquipo", "Proyectos por equipo", {
            type: "number",
            min: 1,
            max: 10,
          })}
          <TextArea
            label="Categorías tecnológicas (una por línea)"
            value={form.categorias.join("\n")}
            onChange={(v) => set("categorias", v.split("\n"))}
            required
          />
          <TextArea
            label="Requisitos de participación"
            value={form.requisitos}
            onChange={(v) => set("requisitos", v)}
          />
        </>
      )}
      {type === "torneos" && (
        <SportsRuleFields locked={locked} form={form} rule={rule} />
      )}
    </>
  );
}
