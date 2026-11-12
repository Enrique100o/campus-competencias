import { useState } from "react";
import { Field, Notice, Select } from "../../components/ui/Fields.jsx";
import { MemberPicker } from "../teams/MemberPicker.jsx";

export function EventTeamForm({
  event,
  isHackathon,
  user,
  institutions,
  profile,
  busy,
  error,
  onSave,
  onBack,
}) {
  const [nombre, setNombre] = useState("");
  const [institucion, setInstitucion] = useState(
    profile?.institucion ||
      (institutions.length === 1 ? institutions[0].id : ""),
  );
  const [categoria, setCategoria] = useState(
    event.categorias?.length === 1 ? event.categorias[0] : "",
  );
  const [members, setMembers] = useState(
    profile?.estado === "activo" ? [profile] : [],
  );
  const trials = isHackathon ? [] : event.reglamento.pruebas;
  const [trial, setTrial] = useState(trials.length === 1 ? trials[0] : "");
  const { integrantesMin: minimum, integrantesMax: maximum } = isHackathon
    ? event
    : event.reglamento;
  function submit(e) {
    e.preventDefault();
    if (busy || members.length < minimum || members.length > maximum) return;
    onSave(
      {
        nombre,
        responsable: user.id,
        integrantes: members.map((person) => person.id),
        ...(isHackathon
          ? {
              tipo: "tecnologico",
              hackaton: event.id,
              categoriaTecnologica: categoria,
            }
          : {
              tipo: "deportivo",
              institucion,
              disciplina: event.disciplina,
              categoria: event.categoria,
              modalidad: event.unidadInscripcion,
            }),
      },
      trial,
    );
  }

  return (
    <form onSubmit={submit}>
      <p>
        Arma tu equipo para <strong>{event.nombre}</strong>.
      </p>
      <Field
        label="Nombre del equipo"
        value={nombre}
        onChange={setNombre}
        minLength={2}
        maxLength={120}
      />
      {isHackathon ? (
        event.categorias.length > 1 && (
          <Select
            label="Categoría del hackatón"
            value={categoria}
            onChange={setCategoria}
            options={event.categorias}
          />
        )
      ) : profile ? (
        <p className="form-help">
          Institución ·{" "}
          {institutions.find((item) => item.id === institucion)?.nombre ||
            profile.institucionNombre ||
            "Consulta el estado de tu institución"}
        </p>
      ) : (
        <Select
          label="Institución del equipo"
          value={institucion}
          options={institutions}
          onChange={(value) => {
            setInstitucion(value);
            setMembers([]);
          }}
        />
      )}
      {trials.length > 1 && (
        <Select
          label="Prueba"
          value={trial}
          onChange={setTrial}
          options={trials}
        />
      )}
      <MemberPicker
        key={isHackathon ? "hackaton" : institucion}
        members={members}
        onChange={setMembers}
        institutions={institutions}
        institution={isHackathon ? "" : institucion}
        needsInstitution={!isHackathon}
        selfId={profile?.id}
        min={minimum}
        max={maximum}
        disabled={busy}
      />
      <Notice>{error}</Notice>
      <div className="dialog-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onBack}
          disabled={busy}
        >
          Atrás
        </button>
        <button
          className="button button-primary"
          disabled={
            busy || members.length < minimum || members.length > maximum
          }
        >
          {busy
            ? "Guardando…"
            : event.requiereAprobacion
              ? "Crear equipo y enviar solicitud"
              : "Crear equipo e inscribirme"}
        </button>
      </div>
    </form>
  );
}
