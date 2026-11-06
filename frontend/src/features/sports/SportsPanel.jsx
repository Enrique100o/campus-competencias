import { useState } from "react";
import { useResource } from "../../hooks/useResource.js";
import { StageControls } from "../events/StageControls.jsx";
import { ScheduleForm } from "./ScheduleForm.jsx";
import { ResultForm } from "./ResultForm.jsx";
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
  displayDate,
  stateLabel,
  referenceId,
} from "../../components/ui/Workflow.jsx";

export function SportsPanel({ user }) {
  const events = useResource("/torneos?limit=50"),
    [selected, setSelected] = useState(""),
    [tab, setTab] = useState("agenda"),
    [schedule, setSchedule] = useState(null),
    [result, setResult] = useState(null),
    [cancel, setCancel] = useState(null),
    [reason, setReason] = useState(""),
    [day, setDay] = useState(""),
    [competitor, setCompetitor] = useState("");
  const event = events.data?.items.find((t) => t.id === selected);
  const manager =
    event &&
    (user.rol === "administrador" ||
      (user.rol === "organizador" && event.responsable === user.id));
  const agenda = useResource(
    event
      ? `/torneos/${event.id}/agenda?${new URLSearchParams({ ...(day ? { fecha: day } : {}), ...(competitor ? { competidor: competitor } : {}) })}`
      : null,
  );
  const scores = useResource(event ? `/torneos/${event.id}/resultados` : null),
    table = useResource(event ? `/clasificaciones/${event.id}` : null);
  const venues = useResource("/escenarios?limit=50"),
    registrations = useResource(
      manager ? `/torneos/${event.id}/inscripciones` : null,
    );
  const reload = () => {
    events.reload();
    agenda.reload();
    scores.reload();
    table.reload();
    registrations.reload();
  };
  const action = useAction(() => {
    setCancel(null);
    reload();
  });
  const matchNames = [
    ...new Map(
      (agenda.data?.items || [])
        .flatMap((c) => c.participaciones)
        .map((p) => [p.competidor, { id: p.competidor, nombre: p.nombre }]),
    ).values(),
  ];
  return (
    <>
      <PageHeading
        title="Agenda y resultados"
        description="Partidos, pruebas y rondas con métricas propias de cada disciplina."
      />
      <Select
        label="Torneo"
        value={selected}
        onChange={(v) => {
          setSelected(v);
          setDay("");
          setCompetitor("");
        }}
        options={events.data?.items || []}
      />
      <LoadState resource={events} />
      {event && (
        <>
          {manager && (
            <StageControls kind="torneos" event={event} onChanged={reload} />
          )}
          <div className="workflow-tabs">
            {["agenda", "resultados", "clasificación"].map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "agenda" && (
            <section className="directory-card">
              <div className="toolbar workflow-toolbar">
                <Field
                  label="Fecha"
                  type="date"
                  value={day}
                  onChange={setDay}
                  required={false}
                />
                <Select
                  label="Competidor"
                  value={competitor}
                  onChange={setCompetitor}
                  options={matchNames}
                  required={false}
                />
                {manager &&
                  ["inscripciones", "en_curso"].includes(event.estado) && (
                    <button
                      className="button button-primary"
                      onClick={() => setSchedule({ item: null })}
                    >
                      Programar competencia
                    </button>
                  )}
              </div>
              <LoadState resource={agenda} />
              <DataTable
                rows={agenda.data?.items || []}
                columns={[
                  {
                    label: "Fase / prueba",
                    render: (r) =>
                      `${r.fase} · ${r.prueba || r.tipo} ${r.grupo || ""}`,
                  },
                  {
                    label: "Horario",
                    render: (r) => (
                      <>
                        {displayDate(r.inicio)}
                        <br />
                        {displayDate(r.fin)}
                      </>
                    ),
                  },
                  { label: "Escenario", render: (r) => r.escenario?.nombre },
                  {
                    label: "Participación",
                    render: (r) =>
                      r.participaciones
                        .map(
                          (p) =>
                            `${p.nombre}${p.carril ? ` · ${p.carril}` : ""}${p.serie ? ` · serie ${p.serie}` : ""}${p.posicion ? ` · salida ${p.posicion}` : ""}`,
                        )
                        .join(" / "),
                  },
                  { label: "Estado", render: (r) => stateLabel(r.estado) },
                  {
                    label: "Acciones",
                    render: (r) =>
                      manager &&
                      ["programada", "reprogramada"].includes(r.estado) && (
                        <div className="row-actions">
                          <button
                            className="button button-secondary"
                            onClick={() => setSchedule({ item: r })}
                          >
                            Reprogramar
                          </button>
                          <button
                            className="button button-secondary"
                            onClick={() => {
                              setCancel(r);
                              setReason("");
                            }}
                          >
                            Cancelar
                          </button>
                          {event.estado === "en_curso" && (
                            <button
                              className="button button-primary"
                              onClick={() =>
                                setResult({ competition: r, result: null })
                              }
                            >
                              Resultado
                            </button>
                          )}
                        </div>
                      ),
                  },
                ]}
              />
            </section>
          )}
          {tab === "resultados" && (
            <section className="directory-card">
              <LoadState resource={scores} />
              <DataTable
                rows={scores.data?.items || []}
                columns={[
                  {
                    label: "Competencia",
                    render: (r) =>
                      `${r.competencia.fase} · ${r.competencia.prueba || "Partido"}`,
                  },
                  {
                    label: "Resultados",
                    render: (r) =>
                      r.marcas
                        .map(
                          (m) =>
                            `${r.competencia.participaciones.find((p) => p.inscripcion === m.inscripcion)?.nombre}: ${m.estado === "valido" ? m.valor : stateLabel(m.estado)}`,
                        )
                        .join(" / "),
                  },
                  { label: "Versión", render: (r) => r.version },
                  {
                    label: "Acciones",
                    render: (r) =>
                      manager &&
                      event.estado === "en_curso" && (
                        <button
                          className="button button-secondary"
                          onClick={() =>
                            setResult({
                              competition: {
                                ...r.competencia,
                                id: referenceId(r.competencia),
                              },
                              result: r,
                            })
                          }
                        >
                          Corregir con motivo
                        </button>
                      ),
                  },
                ]}
              />
            </section>
          )}
          {tab === "clasificación" && (
            <section>
              <LoadState resource={table} />
              {table.data?.grupos.map((g) => (
                <section
                  className="directory-card"
                  key={`${g.fase}-${g.prueba}-${g.grupo}`}
                >
                  <h3>
                    {g.fase} · {g.prueba || event.reglamento.metrica} ·{" "}
                    {g.grupo}
                  </h3>
                  <p>
                    {g.pendientes} competencias pendientes. Clasifican{" "}
                    {g.clasifican}; los empates no resueltos se muestran
                    explícitamente.
                  </p>
                  <DataTable
                    rowKey={(r) => r.inscripcion}
                    rows={g.tabla}
                    columns={[
                      {
                        label: "Posición",
                        render: (r) =>
                          `${r.posicion}${r.empate ? " (empate)" : ""}`,
                      },
                      { label: "Competidor", render: (r) => r.nombre },
                      { label: "Jugados", render: (r) => r.jugados },
                      { label: "Puntos", render: (r) => r.puntos },
                      {
                        label: "A favor / contra",
                        render: (r) => `${r.aFavor} / ${r.enContra}`,
                      },
                      {
                        label: `Marca (${event.reglamento.unidad})`,
                        render: (r) =>
                          r.marca === null ? "Pendiente / sin marca" : r.marca,
                      },
                      {
                        label: "Avance",
                        render: (r) =>
                          r.clasificado
                            ? "Clasificado"
                            : g.pendientes
                              ? "Pendiente"
                              : "No clasificado",
                      },
                    ]}
                  />
                </section>
              ))}
            </section>
          )}
        </>
      )}
      {schedule && (
        <ScheduleForm
          event={event}
          item={schedule.item}
          venues={venues.data?.items || []}
          registrations={registrations.data?.items || []}
          onClose={() => setSchedule(null)}
          onSaved={() => {
            setSchedule(null);
            reload();
          }}
        />
      )}
      {result && (
        <ResultForm
          event={event}
          {...result}
          onClose={() => setResult(null)}
          onSaved={() => {
            setResult(null);
            reload();
          }}
        />
      )}
      {cancel && (
        <Modal title="Cancelar competencia" onClose={() => setCancel(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action.run(`/competencias/${cancel.id}`, "PATCH", {
                estado: "cancelada",
                motivo: reason,
              });
            }}
          >
            <Field
              label="Motivo"
              minLength={5}
              value={reason}
              onChange={setReason}
            />
            <Notice>{action.error}</Notice>
            <Submit busy={action.busy}>Confirmar cancelación</Submit>
          </form>
        </Modal>
      )}
    </>
  );
}
