import { useState } from "react";
import { useResource } from "../../hooks/useResource.js";
import { ResourcePanel } from "../competitions/ResourcePanel.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import {
  PageHeading,
  LoadState,
  DataTable,
  Select,
  Field,
  Notice,
  Submit,
  useAction,
  stateLabel,
} from "../../components/ui/Workflow.jsx";

export function RegistrationsPanel({ user, onLogout, initialKind, onExplore }) {
  const [kind, setKind] = useState(initialKind),
    [form, setForm] = useState(false),
    [hack, setHack] = useState(""),
    [team, setTeam] = useState(""),
    [eventFilter, setEventFilter] = useState(""),
    [selected, setSelected] = useState(null),
    [state, setState] = useState("cancelada"),
    [reason, setReason] = useState("");
  const hacks = useResource("/hackatones?limit=50"),
    teams = useResource("/equipos?limit=50"),
    tournaments = useResource("/torneos?limit=50");
  const manager = ["administrador", "organizador"].includes(user.rol);
  const path =
    kind === "deportiva" ? "/inscripciones" : "/inscripciones-hackaton";
  const records = useResource(
    `${path}?limit=50${eventFilter ? `&${kind === "deportiva" ? "torneo" : "hackaton"}=${eventFilter}` : ""}`,
  );
  const action = useAction(() => {
    setForm(false);
    setSelected(null);
    records.reload();
  });
  return (
    <>
      <PageHeading
        title={manager ? "Inscripciones" : "Mis inscripciones"}
        description={
          manager
            ? "Revisa las solicitudes y gestiona las inscripciones de tus eventos."
            : "Consulta si tu inscripción está confirmada o pendiente de aprobación."
        }
      >
        {!manager && (
          <button
            className="button button-primary"
            onClick={() =>
              onExplore(kind === "deportiva" ? "torneos" : "hackatones")
            }
          >
            {kind === "deportiva" ? "Buscar torneos" : "Buscar hackatones"}
          </button>
        )}
      </PageHeading>
      <div className="workflow-tabs">
        <button
          className={kind === "deportiva" ? "active" : ""}
          onClick={() => {
            setKind("deportiva");
            setEventFilter("");
          }}
        >
          Deportes
        </button>
        <button
          className={kind === "tecnologica" ? "active" : ""}
          onClick={() => {
            setKind("tecnologica");
            setEventFilter("");
          }}
        >
          Hackatones
        </button>
      </div>
      {manager && kind === "deportiva" && (
        <ResourcePanel type="inscripciones" user={user} onLogout={onLogout} />
      )}
      <section className="directory-card">
        <div className="toolbar workflow-toolbar">
          <Select
            label="Filtrar evento"
            value={eventFilter}
            required={false}
            onChange={setEventFilter}
            options={
              kind === "deportiva"
                ? tournaments.data?.items || []
                : hacks.data?.items || []
            }
          />
          {manager && kind === "tecnologica" && (
            <button
              className="button button-primary"
              onClick={() => setForm(true)}
            >
              Inscribir equipo
            </button>
          )}
          <button className="button button-secondary" onClick={records.reload}>
            Actualizar seguimiento
          </button>
        </div>
        <LoadState resource={records} />
        <DataTable
          rows={records.data?.items || []}
          columns={[
            {
              label: "Equipo / competidor",
              render: (r) => r.equipo?.nombre || r.competidorNombre,
            },
            {
              label: "Evento",
              render: (r) => r.hackaton?.nombre || r.torneoNombre,
            },
            { label: "Estado", render: (r) => stateLabel(r.estado) },
            {
              label: "Plantilla confirmada",
              render: (r) => r.plantilla.map((p) => p.nombre).join(", "),
            },
            {
              label: "Acciones",
              render: (r) =>
                ["pendiente", "confirmada"].includes(r.estado) ? (
                  <button
                    className="button button-secondary"
                    onClick={() => {
                      setSelected(r);
                      setState("cancelada");
                      setReason("");
                    }}
                  >
                    Gestionar
                  </button>
                ) : (
                  r.motivo || "Solicitud cerrada"
                ),
            },
          ]}
        />
      </section>
      {form && (
        <Modal
          title="Inscribir equipo en hackatón"
          busy={action.busy}
          onClose={() => setForm(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action.run(path, "POST", { hackaton: hack, equipo: team });
            }}
          >
            <Select
              label="Hackatón"
              value={hack}
              onChange={(v) => {
                setHack(v);
                setTeam("");
              }}
              options={(hacks.data?.items || []).filter(
                (h) => h.estado === "inscripciones",
              )}
            />
            <Select
              label="Equipo tecnológico"
              value={team}
              onChange={setTeam}
              options={(teams.data?.items || []).filter(
                (t) =>
                  t.tipo === "tecnologico" &&
                  t.hackaton === hack &&
                  (manager || t.responsable === user.id),
              )}
            />
            <Notice>{action.error}</Notice>
            <Submit busy={action.busy}>Solicitar inscripción</Submit>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal
          title="Gestionar inscripción"
          onClose={() => setSelected(null)}
          busy={action.busy}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action.run(`${path}/${selected.id}`, "PATCH", {
                estado: state,
                motivo: reason,
              });
            }}
          >
            <Select
              label="Acción"
              value={state}
              onChange={setState}
              options={[
                { id: "cancelada", nombre: "Retirar inscripción" },
                ...(manager && selected.estado === "pendiente"
                  ? [
                      { id: "confirmada", nombre: "Aprobar solicitud" },
                      { id: "rechazada", nombre: "Rechazar solicitud" },
                    ]
                  : []),
              ]}
            />
            <Field
              label="Motivo"
              value={reason}
              onChange={setReason}
              required={state !== "confirmada"}
              minLength={5}
            />
            <Notice>{action.error}</Notice>
            <Submit busy={action.busy}>Aplicar cambio</Submit>
          </form>
        </Modal>
      )}
    </>
  );
}
