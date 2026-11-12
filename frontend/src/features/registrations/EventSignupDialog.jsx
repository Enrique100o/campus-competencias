import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Modal } from "../../components/ui/Modal.jsx";
import { Notice, Select } from "../../components/ui/Fields.jsx";
import { LoadState, Submit, useAction } from "../../components/ui/Workflow.jsx";
import { useResource } from "../../hooks/useResource.js";
import {
  canEdit,
  labels,
  readableDate,
  registrationWindowOpen,
} from "../competitions/config.js";
import { ParticipantProfileForm } from "./ParticipantProfileForm.jsx";
import { EventTeamForm } from "./EventTeamForm.jsx";

const activeStates = ["pendiente", "confirmada"];

export function EventSignupDialog({
  event,
  type,
  user,
  catalogs,
  onClose,
  onViewRegistrations,
}) {
  const isHackathon = type === "hackatones";
  const individual = !isHackathon && event.unidadInscripcion === "individual";
  const self = user.rol === "participante";
  const [screen, setScreen] = useState("registration");
  const [afterProfile, setAfterProfile] = useState("registration");
  const [result, setResult] = useState(null);
  const [createdProfile, setCreatedProfile] = useState(null);
  const [createdTeam, setCreatedTeam] = useState(null);
  const [selected, setSelected] = useState("");
  const [trial, setTrial] = useState("");
  const profileResource = useResource(self ? "/participantes?limit=1" : null);
  const profile = createdProfile || profileResource.data?.items[0];
  const teams = createdTeam
    ? [createdTeam, ...catalogs.equipos]
    : catalogs.equipos;
  const institutions = catalogs.instituciones.filter(
    (i) => i.estado === "activo",
  );
  const path = isHackathon ? "/inscripciones-hackaton" : "/inscripciones";
  const records = useResource(
    self
      ? `${path}?${isHackathon ? "hackaton" : "torneo"}=${event.id}&limit=50`
      : null,
  );
  const registrations = (records.data?.items || []).filter((record) =>
    activeStates.includes(record.estado),
  );
  const manages = canEdit(type, event, user);
  const trials = isHackathon ? [] : event.reglamento.pruebas;
  const options = individual
    ? (self ? (profile ? [profile] : []) : catalogs.participantes).filter(
        (p) => p.estado === "activo" && (manages || p.usuario === user.id),
      )
    : teams.filter(
        (t) =>
          t.estado === "activo" &&
          (manages || t.responsable === user.id) &&
          (isHackathon
            ? t.tipo === "tecnologico" && t.hackaton === event.id
            : t.tipo === "deportivo" &&
              t.disciplina === event.disciplina &&
              t.categoria === event.categoria &&
              t.modalidad === event.unidadInscripcion),
      );
  const choice =
    options.find((item) => item.id === selected) ||
    (options.length === 1 ? options[0] : null);
  const chosenTrial = trials.length === 1 ? trials[0] : trial;
  const previous = registrations.find((record) =>
    isHackathon
      ? record.equipo?.id === choice?.id
      : record.competidor === choice?.id && record.prueba === chosenTrial,
  );
  const action = useAction(setResult);
  const profileAction = useAction((value) => {
    setCreatedProfile(value);
    setScreen(afterProfile);
  });
  const teamAction = useAction((value) => {
    setCreatedTeam(value);
    setSelected(value.id);
    setScreen("registration");
  });
  const busy = action.busy || profileAction.busy || teamAction.busy;
  const loading = profileResource.loading || records.loading;
  const loadError = profileResource.error || records.error;

  function register(competitor, prueba) {
    return action.run(
      path,
      "POST",
      isHackathon
        ? { hackaton: event.id, equipo: competitor }
        : {
            torneo: event.id,
            modalidad: event.unidadInscripcion,
            competidor: competitor,
            prueba,
          },
    );
  }

  function submit(e) {
    e.preventDefault();
    if (busy || !choice || previous || (trials.length && !chosenTrial)) return;
    register(choice.id, chosenTrial);
  }

  function openTeam() {
    if (self && !profile) {
      setAfterProfile("team");
      setScreen("profile");
    } else {
      setScreen("team");
    }
  }

  async function createAndRegister(body, prueba) {
    const team = await teamAction.run("/equipos", "POST", body);
    if (!team) return;
    // Si falla la inscripción, el equipo queda seleccionado para reintentar.
    setTrial(prueba);
    await register(team.id, prueba);
  }

  return (
    <Modal
      title={
        result
          ? "Inscripción registrada"
          : screen === "profile"
            ? "Tu ficha de participante"
            : screen === "team"
              ? "Crea tu equipo"
              : "Inscríbete en el evento"
      }
      onClose={onClose}
      busy={busy}
    >
      {result ? (
        <div className="registration-success" role="status">
          <CheckCircle2 size={30} />
          <strong>
            {result.estado === "pendiente"
              ? "Solicitud enviada"
              : "Inscripción confirmada"}
          </strong>
          <p>
            {result.estado === "pendiente"
              ? `La organización de ${event.nombre} debe aprobar tu solicitud.`
              : `Tu inscripción en ${event.nombre} está confirmada.`}
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
            >
              Volver a eventos
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={onViewRegistrations}
            >
              Ver inscripciones
            </button>
          </div>
        </div>
      ) : !registrationWindowOpen(event) ? (
        <p>El plazo de inscripción de {event.nombre} ya terminó.</p>
      ) : screen === "profile" ? (
        <ParticipantProfileForm
          institutions={institutions}
          busy={busy}
          error={profileAction.error}
          onBack={() => setScreen("registration")}
          onSave={(body) =>
            profileAction.run("/participantes/mi-ficha", "POST", body)
          }
        />
      ) : screen === "team" ? (
        <EventTeamForm
          event={event}
          isHackathon={isHackathon}
          user={user}
          institutions={institutions}
          profile={profile}
          busy={busy}
          error={teamAction.error}
          onBack={() => setScreen("registration")}
          onSave={createAndRegister}
        />
      ) : (
        <>
          <div className="registration-event">
            <h3>{event.nombre}</h3>
            <p>
              {individual
                ? "Participación individual"
                : isHackathon
                  ? "Participación por equipo"
                  : labels[event.unidadInscripcion]}{" "}
              · Cierra {readableDate(event.inscripcionFin)}
            </p>
            {(event.reglamento?.requisitos || event.requisitos) && (
              <p>{event.reglamento?.requisitos || event.requisitos}</p>
            )}
          </div>
          <LoadState resource={profileResource} />
          <LoadState resource={records} />
          {loadError && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                if (profileResource.error) profileResource.reload();
                if (records.error) records.reload();
              }}
            >
              Volver a intentar
            </button>
          )}
          {!loading && !loadError && (
            <form onSubmit={submit}>
              {options.length > 1 ? (
                <Select
                  label={individual ? "Participante" : "Equipo"}
                  value={choice?.id}
                  onChange={setSelected}
                  options={options}
                  disabled={busy}
                />
              ) : (
                choice && (
                  <p className="form-hint">
                    {individual ? "Participante" : "Equipo"} ·{" "}
                    <strong>{choice.nombre}</strong>
                  </p>
                )
              )}
              {trials.length > 1 && choice && (
                <Select
                  label="Prueba"
                  value={trial}
                  onChange={setTrial}
                  options={trials}
                  disabled={busy}
                />
              )}
              {trials.length === 1 && choice && (
                <p className="form-help">Prueba · {chosenTrial}</p>
              )}
              {individual && self && !profile && (
                <p>
                  Completa tu ficha deportiva para continuar con la inscripción.
                </p>
              )}
              {individual && !choice && (!self || profile) && (
                <p>
                  No hay una ficha activa para inscribir. Consulta con la
                  organización del evento.
                </p>
              )}
              {!individual && !choice && options.length === 0 && (
                <p>Crea tu equipo para participar.</p>
              )}
              {!individual && self && profile?.estado === "inactivo" && (
                <p>
                  Tu ficha está inactiva. Consulta con la organización para
                  crear un equipo.
                </p>
              )}
              {previous && (
                <p className="form-hint">
                  {previous.estado === "pendiente"
                    ? "Ya hay una solicitud pendiente."
                    : "Esta inscripción ya está confirmada."}
                </p>
              )}
              <Notice>{action.error}</Notice>
              {createdTeam && action.error && (
                <p className="form-help">
                  Tu equipo quedó guardado. Puedes volver a intentar la
                  inscripción aquí.
                </p>
              )}
              <div className="dialog-actions">
                {registrations.length > 0 && (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={onViewRegistrations}
                  >
                    Ver inscripciones
                  </button>
                )}
                {individual && self && !profile && (
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => {
                      setAfterProfile("registration");
                      setScreen("profile");
                    }}
                  >
                    Completar mi ficha
                  </button>
                )}
                {!individual && profile?.estado !== "inactivo" && (
                  <button
                    type="button"
                    className={`button ${choice ? "button-secondary" : "button-primary"}`}
                    disabled={busy}
                    onClick={openTeam}
                  >
                    Crear equipo
                  </button>
                )}
                {choice && !previous && (
                  <Submit busy={busy}>
                    {event.requiereAprobacion
                      ? "Solicitar inscripción"
                      : "Confirmar inscripción"}
                  </Submit>
                )}
              </div>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}
