import { nameOf } from "../config.js";
// Composición y referencias condicionales de equipos deportivos o tecnológicos.
export function TeamFields({
  select,
  item,
  available,
  owners,
  form,
  catalogs,
  discipline,
  hack,
  set,
}) {
  return (
    <>
      {select("tipo", "Tipo de equipo", ["deportivo", "tecnologico"], {
        disabled: Boolean(item),
      })}
      {select(
        "responsable",
        "Responsable del equipo",
        available(owners, "responsable"),
      )}
      {form.tipo === "deportivo" ? (
        <>
          {select(
            "institucion",
            "Institución",
            available(catalogs.instituciones, "institucion"),
          )}
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
          {select(
            "modalidad",
            "Modalidad del equipo",
            discipline?.modalidades.filter((m) => m !== "individual") || [],
          )}
        </>
      ) : (
        <>
          {select(
            "hackaton",
            "Hackatón de referencia",
            catalogs.hackatones.filter(
              (h) => !["cancelado", "publicado"].includes(h.estado),
            ),
          )}
          {select(
            "categoriaTecnologica",
            "Categoría tecnológica",
            hack?.categorias || [],
          )}
          <p className="form-help">
            {hack
              ? `Plantilla requerida: ${hack.integrantesMin} a ${hack.integrantesMax} integrantes. `
              : ""}
            Crear el equipo todavía no lo inscribe en el hackatón.
          </p>
        </>
      )}
      <fieldset className="form-section">
        <legend>Integrantes ({form.integrantes.length})</legend>
        <div className="member-options">
          {catalogs.participantes
            .filter(
              (p) => p.estado === "activo" || form.integrantes.includes(p.id),
            )
            .map((p) => (
              <label key={p.id} className="check-label">
                <input
                  type="checkbox"
                  checked={form.integrantes.includes(p.id)}
                  onChange={(e) =>
                    set(
                      "integrantes",
                      e.target.checked
                        ? [...form.integrantes, p.id]
                        : form.integrantes.filter((id) => id !== p.id),
                    )
                  }
                />
                {p.nombre}
                <small>{nameOf(catalogs.instituciones, p.institucion)}</small>
              </label>
            ))}
          {!catalogs.participantes.length && (
            <p>Registra los participantes antes de agregar integrantes.</p>
          )}
        </div>
      </fieldset>
    </>
  );
}
