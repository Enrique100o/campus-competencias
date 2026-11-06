import { labels, readableDate } from "../config.js";
// Selección de evento y competidor elegible para inscripción deportiva.
export function SportsRegistrationFields({
  select,
  catalogs,
  event,
  competitors,
}) {
  return (
    <>
      {select(
        "torneo",
        "Torneo",
        catalogs.torneos.filter(
          (t) =>
            t.estado === "inscripciones" &&
            Date.now() >= Date.parse(t.inscripcionInicio) &&
            Date.now() <= Date.parse(t.inscripcionFin),
        ),
      )}
      {event && (
        <div className="form-hint">
          {labels[event.unidadInscripcion]} · {event.categoriaNombre} ·{" "}
          {event.cupos} cupos de inscripciones · Cierre:{" "}
          {readableDate(event.inscripcionFin)}
        </div>
      )}
      {select(
        "competidor",
        event?.unidadInscripcion === "individual"
          ? "Participante"
          : "Equipo o relevo",
        competitors,
      )}
      {event?.reglamento.pruebas.length > 0 &&
        select("prueba", "Prueba", event.reglamento.pruebas)}
      {event && (
        <p className="form-help">
          Plantilla: {event.reglamento.integrantesMin} a{" "}
          {event.reglamento.integrantesMax}. Límite:{" "}
          {event.reglamento.maxInscripciones} inscripciones por competidor.{" "}
          {event.reglamento.requisitos}
        </p>
      )}
      {!competitors.length && event && (
        <p className="form-help">
          No tienes competidores compatibles disponibles. Revisa los
          participantes o equipos registrados y su categoría.
        </p>
      )}
    </>
  );
}
