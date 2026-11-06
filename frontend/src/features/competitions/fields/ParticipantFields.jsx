// Datos personales y referencias del participante.
export function ParticipantFields({ field, select, available, catalogs }) {
  return (
    <>
      <div className="form-row">
        {field("documento", "Documento de identidad", { maxLength: 30 })}
        {field("nacimiento", "Fecha de nacimiento", { type: "date" })}
      </div>
      {select("genero", "Género del participante", [
        "femenino",
        "masculino",
        "otro",
      ])}
      {select(
        "usuario",
        "Cuenta de acceso del participante",
        available(
          catalogs.usuarios.filter((u) => u.rol === "participante"),
          "usuario",
        ),
      )}
      {select(
        "institucion",
        "Institución",
        available(catalogs.instituciones, "institucion"),
      )}
      {field("categoria", "Categoría de referencia", { maxLength: 80 })}
      <p className="form-help">
        La categoría de referencia ayuda a organizar el registro. La
        elegibilidad se verifica con las reglas de cada torneo.
      </p>
    </>
  );
}
