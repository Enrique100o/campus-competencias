import {
  CalendarDays,
  Eye,
  LoaderCircle,
  MapPin,
  Pencil,
  Trophy,
} from "lucide-react";
import {
  canEdit,
  canRegisterForEvent,
  eventStatus,
  labels,
  readableDate,
  registrationWindowOpen,
} from "./config.js";

export function EventCard({
  event,
  type,
  user,
  publishing,
  onDetails,
  onRegister,
  onRoster,
  onEdit,
  onPublish,
}) {
  const isTournament = type === "torneos";
  const open = registrationWindowOpen(event);
  const places = Math.max(0, event.cupos - (event.inscritos ?? 0));
  return (
    <article className="event-card" aria-label={event.nombre}>
      <div className="event-card-top">
        <span className="event-symbol">
          <Trophy size={23} aria-hidden="true" />
        </span>
        <span
          className={`badge ${open && places > 0 ? "badge-active" : "badge-inactive"}`}
        >
          {eventStatus(event)}
        </span>
      </div>
      <span className="eyebrow">
        {isTournament
          ? `${event.disciplinaNombre} · ${labels[event.unidadInscripcion]}`
          : labels[event.modalidad]}
      </span>
      <h3>{event.nombre}</h3>
      {event.descripcion && <p>{event.descripcion}</p>}
      <div className="event-meta">
        <span>
          <MapPin size={15} /> {event.ciudad}, {event.departamento}
        </span>
        <span>
          <CalendarDays size={15} /> Inicia {readableDate(event.inicio)}
        </span>
        {isTournament && (
          <span>
            <strong>
              {event.inscritos ?? 0} de {event.cupos} cupos ocupados
            </strong>
          </span>
        )}
        {open && (
          <>
            <span>
              <strong>
                {places}{" "}
                {places === 1 ? "cupo disponible" : "cupos disponibles"}
              </strong>
            </span>
            <span>Cierra {readableDate(event.inscripcionFin)}</span>
          </>
        )}
        {!open &&
          event.estado === "inscripciones" &&
          Date.now() < Date.parse(event.inscripcionInicio) && (
            <span>
              Inscripciones desde {readableDate(event.inscripcionInicio)}
            </span>
          )}
      </div>
      <div className="event-actions">
        {canRegisterForEvent(event, user) && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => onRegister(event)}
          >
            {user.rol === "participante" ? "Inscribirme" : "Inscribir"}
          </button>
        )}
        <button
          type="button"
          className="button button-secondary"
          aria-label={`Ver requisitos de ${event.nombre}`}
          onClick={() => onDetails(event)}
        >
          <Eye size={16} /> Ver requisitos
        </button>
        {isTournament && (
          <button
            type="button"
            className="button button-secondary"
            aria-label={`Ver inscritos de ${event.nombre}`}
            onClick={() => onRoster(event)}
          >
            Ver inscritos
          </button>
        )}
        {canEdit(type, event, user) && (
          <>
            <button
              type="button"
              className="icon-button edit-button"
              aria-label={`Editar ${event.nombre}`}
              onClick={() => onEdit(event)}
            >
              <Pencil size={16} />
            </button>
            {event.estado === "borrador" && (
              <button
                type="button"
                className="button button-primary"
                disabled={Boolean(publishing)}
                onClick={() => onPublish(event)}
              >
                {publishing === event.id ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  "Abrir inscripciones"
                )}
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}
