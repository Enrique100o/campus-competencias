import { MemberPicker } from "../../teams/MemberPicker.jsx";
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
  user,
  members,
  onMembersChange,
  busy,
}) {
  const self = user.rol === "participante";
  const profile = !item && self ? catalogs.miFicha : null;
  const sports = form.tipo === "deportivo";
  return (
    <>
      {select("tipo", "Tipo de equipo", ["deportivo", "tecnologico"], {
        disabled: Boolean(item),
      })}
      {!self &&
        select(
          "responsable",
          "Responsable del equipo",
          available(owners, "responsable"),
        )}
      {sports ? (
        <>
          {profile ? (
            <p className="form-help">
              Institución ·{" "}
              {
                catalogs.instituciones.find((i) => i.id === profile.institucion)
                  ?.nombre
              }
            </p>
          ) : (
            select(
              "institucion",
              "Institución",
              available(catalogs.instituciones, "institucion"),
            )
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
      <MemberPicker
        key={sports ? form.institucion : form.hackaton}
        members={members}
        onChange={onMembersChange}
        institutions={catalogs.instituciones}
        institution={sports ? form.institucion : ""}
        needsInstitution={sports}
        selfId={profile?.id}
        max={!sports && hack ? hack.integrantesMax : 100}
        min={sports ? undefined : hack?.integrantesMin}
        disabled={busy}
      />
    </>
  );
}
