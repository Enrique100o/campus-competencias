import { useState } from "react";
import { useResource } from "../../hooks/useResource.js";
import { Modal } from "../../components/ui/Modal.jsx";
import { StageControls } from "../events/StageControls.jsx";
import { ProjectForm } from "./ProjectForm.jsx";
import { RubricForm } from "./RubricForm.jsx";
import { EvaluationForm } from "./EvaluationForm.jsx";
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
  referenceId,
  displayDate,
} from "../../components/ui/Workflow.jsx";

export function HackathonPanel({ user }) {
  const events = useResource("/hackatones?limit=50"),
    [selected, setSelected] = useState(""),
    [tab, setTab] = useState("proyectos"),
    [projectForm, setProjectForm] = useState(null),
    [detail, setDetail] = useState(null),
    [evaluation, setEvaluation] = useState(null),
    [assignment, setAssignment] = useState(false);
  const event = events.data?.items.find((e) => e.id === selected),
    manager = Boolean(
      event &&
      (user.rol === "administrador" ||
        (user.rol === "organizador" && event.responsable === user.id)),
    ),
    jury = user.rol === "jurado";
  const projects = useResource(
      event ? `/proyectos?hackaton=${event.id}&limit=50` : null,
    ),
    rubric = useResource(event ? `/hackatones/${event.id}/rubrica` : null);
  const assignments = useResource(
      event && (manager || jury)
        ? `/asignaciones?hackaton=${event.id}&limit=50`
        : null,
    ),
    evaluations = useResource(
      event && (manager || jury)
        ? `/evaluaciones?hackaton=${event.id}&limit=50`
        : null,
    );
  const report = useResource(
    event && (manager || event.estado === "publicado")
      ? `/hackatones/${event.id}/reporte`
      : null,
  );
  const catalog = useResource("/flujo/catalogos"),
    registrations = useResource(
      event && !jury
        ? `/inscripciones-hackaton?hackaton=${event.id}&estado=confirmada&limit=50`
        : null,
    );
  const teams = (registrations.data?.items || [])
    .filter(
      (r) =>
        r.estado === "confirmada" &&
        (manager || r.equipo?.responsable === user.id),
    )
    .map((r) => ({
      id: referenceId(r.equipo),
      nombre: r.equipo?.nombre || "Equipo",
    }));
  const reload = () => {
    events.reload();
    projects.reload();
    rubric.reload();
    assignments.reload();
    evaluations.reload();
    report.reload();
    registrations.reload();
  };
  const action = useAction(() => {
    setAssignment(false);
    reload();
  });
  const canProject =
    event && !jury && event.estado === "entrega" && teams.length > 0;
  return (
    <>
      <PageHeading
        title="Proyectos y evaluación"
        description="Inscripción confirmada, entrega versionada, rúbrica, jurados y reporte."
      />
      <Select
        label="Hackatón"
        value={selected}
        onChange={(v) => {
          setSelected(v);
          setTab("proyectos");
        }}
        options={events.data?.items || []}
      />
      <LoadState resource={events} />
      {event && (
        <>
          {manager && (
            <StageControls kind="hackatones" event={event} onChanged={reload} />
          )}
          <div className="workflow-tabs">
            {[
              "proyectos",
              "rúbrica",
              ...(manager || jury ? ["jurados", "evaluaciones"] : []),
              ...(manager || event.estado === "publicado" ? ["reporte"] : []),
            ].map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <Notice>{action.error}</Notice>
          {tab === "proyectos" && (
            <section className="directory-card">
              {canProject && (
                <button
                  className="button button-primary"
                  onClick={() => setProjectForm({ item: null })}
                >
                  Nuevo proyecto
                </button>
              )}
              <LoadState resource={projects} />
              <DataTable
                rows={projects.data?.items || []}
                columns={[
                  { label: "Proyecto", render: (r) => r.nombre },
                  { label: "Equipo", render: (r) => r.equipo?.nombre },
                  {
                    label: "Estado",
                    render: (r) =>
                      `${stateLabel(r.estado)} · versión ${r.version}`,
                  },
                  {
                    label: "Acciones",
                    render: (r) => (
                      <div className="row-actions">
                        <button
                          className="button button-secondary"
                          onClick={() => setDetail(r)}
                        >
                          Ver presentación
                        </button>
                        {canProject &&
                          (manager ||
                            teams.some(
                              (t) => t.id === referenceId(r.equipo),
                            )) && (
                            <>
                              <button
                                className="button button-secondary"
                                onClick={() => setProjectForm({ item: r })}
                              >
                                Editar borrador
                              </button>
                              {r.estado === "borrador" && (
                                <button
                                  className="button button-primary"
                                  disabled={action.busy}
                                  onClick={() =>
                                    action.run(
                                      `/proyectos/${r.id}/entregar`,
                                      "POST",
                                      {},
                                    )
                                  }
                                >
                                  Entregar
                                </button>
                              )}
                            </>
                          )}
                      </div>
                    ),
                  },
                ]}
              />
            </section>
          )}
          {tab === "rúbrica" && (
            <section className="directory-card">
              <LoadState resource={rubric} />
              {manager ? (
                <RubricForm
                  key={`${event.id}-${rubric.data?.version || 0}`}
                  event={event}
                  rubric={rubric.data}
                  onSaved={reload}
                />
              ) : rubric.data ? (
                <>
                  <p>
                    Versión {rubric.data.version} · agregación:{" "}
                    {rubric.data.agregacion}
                  </p>
                  <DataTable
                    rows={rubric.data.criterios}
                    columns={[
                      { label: "Criterio", render: (c) => c.nombre },
                      {
                        label: "Escala",
                        render: (c) => `${c.minimo} a ${c.maximo}`,
                      },
                      { label: "Peso", render: (c) => `${c.peso}%` },
                    ]}
                  />
                </>
              ) : (
                <p>El organizador aún no configuró la rúbrica.</p>
              )}
            </section>
          )}
          {tab === "jurados" && (
            <section className="directory-card">
              {manager && (
                <button
                  className="button button-primary"
                  onClick={() => setAssignment(true)}
                >
                  Asignar jurado
                </button>
              )}
              <LoadState resource={assignments} />
              <DataTable
                rows={assignments.data?.items || []}
                columns={[
                  { label: "Proyecto", render: (r) => r.proyecto?.nombre },
                  { label: "Jurado", render: (r) => r.jurado?.nombre },
                  {
                    label: "Asignación",
                    render: (r) => (r.activo ? "Activa" : "Retirada"),
                  },
                  {
                    label: "Acciones",
                    render: (r) => (
                      <div className="row-actions">
                        {jury &&
                          r.activo &&
                          rubric.data &&
                          event.estado === "evaluacion" && (
                            <button
                              className="button button-primary"
                              onClick={() =>
                                setEvaluation({
                                  project: r.proyecto,
                                  item:
                                    (evaluations.data?.items || []).find(
                                      (e) =>
                                        referenceId(e.proyecto) ===
                                        referenceId(r.proyecto),
                                    ) || null,
                                })
                              }
                            >
                              Evaluar
                            </button>
                          )}
                        {manager && r.activo && (
                          <button
                            className="button button-secondary"
                            onClick={() => {
                              setAssignment({ record: r });
                            }}
                          >
                            Retirar
                          </button>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </section>
          )}
          {tab === "evaluaciones" && (
            <section className="directory-card">
              <LoadState resource={evaluations} />
              <DataTable
                rows={evaluations.data?.items || []}
                columns={[
                  { label: "Proyecto", render: (r) => r.proyecto?.nombre },
                  { label: "Jurado", render: (r) => r.jurado?.nombre },
                  { label: "Estado", render: (r) => stateLabel(r.estado) },
                  {
                    label: "Total calculado",
                    render: (r) => `${r.total} / 100`,
                  },
                  { label: "Versión", render: (r) => r.version },
                  {
                    label: "Acciones",
                    render: (r) =>
                      jury &&
                      rubric.data &&
                      event.estado === "evaluacion" && (
                        <button
                          className="button button-secondary"
                          onClick={() =>
                            setEvaluation({ project: r.proyecto, item: r })
                          }
                        >
                          Abrir evaluación
                        </button>
                      ),
                  },
                ]}
              />
            </section>
          )}
          {tab === "reporte" && (
            <section className="directory-card">
              <LoadState resource={report} />
              {report.data && (
                <>
                  <p>{report.data.formula}</p>
                  <p>
                    {report.data.completo
                      ? "Evaluaciones completas."
                      : "Hay proyectos con evaluaciones pendientes."}{" "}
                    {report.data.publicable
                      ? "Reporte listo para publicar."
                      : "La publicación requiere completar evaluaciones y resolver empates."}
                  </p>
                  <DataTable
                    rows={report.data.proyectos}
                    columns={[
                      {
                        label: "Posición",
                        render: (r) =>
                          r.posicion === null
                            ? "Pendiente"
                            : `${r.posicion}${r.empate ? " · empate" : ""}`,
                      },
                      { label: "Proyecto", render: (r) => r.nombre },
                      { label: "Equipo", render: (r) => r.equipo },
                      {
                        label: "Puntaje",
                        render: (r) =>
                          r.puntaje === null
                            ? "Sin evaluar"
                            : r.puntaje.toFixed(2),
                      },
                      {
                        label: "Evaluaciones",
                        render: (r) => `${r.recibidas} / ${r.esperadas}`,
                      },
                      {
                        label: "Estado",
                        render: (r) => (r.completo ? "Completo" : "Incompleto"),
                      },
                    ]}
                  />
                </>
              )}
            </section>
          )}
        </>
      )}
      {projectForm && (
        <ProjectForm
          event={event}
          item={projectForm.item}
          teams={teams}
          onClose={() => setProjectForm(null)}
          onSaved={() => {
            setProjectForm(null);
            reload();
          }}
        />
      )}
      {detail && (
        <Modal title={detail.nombre} onClose={() => setDetail(null)}>
          <p>
            Estado: {stateLabel(detail.estado)} · versión {detail.version}
          </p>
          <p>{detail.presentacion?.descripcion || detail.descripcion}</p>
          {detail.repositorio && (
            <p>
              <a href={detail.repositorio} target="_blank" rel="noreferrer">
                Repositorio
              </a>
            </p>
          )}
          {detail.demostracion && (
            <p>
              <a href={detail.demostracion} target="_blank" rel="noreferrer">
                Demostración
              </a>
            </p>
          )}
          <p>Entrega: {displayDate(detail.entregadoEn)}</p>
        </Modal>
      )}
      {evaluation && rubric.data && (
        <EvaluationForm
          {...evaluation}
          rubric={rubric.data}
          onClose={() => setEvaluation(null)}
          onSaved={() => {
            setEvaluation(null);
            reload();
          }}
        />
      )}
      {assignment && (
        <AssignmentDialog
          item={assignment.record}
          projects={projects.data?.items || []}
          juries={catalog.data?.jurados || []}
          onClose={() => setAssignment(false)}
          onSaved={() => {
            setAssignment(false);
            reload();
          }}
        />
      )}
    </>
  );
}

function AssignmentDialog({ item, projects, juries, onClose, onSaved }) {
  const [project, setProject] = useState(""),
    [jury, setJury] = useState(""),
    [reason, setReason] = useState(""),
    action = useAction(onSaved);
  return (
    <Modal
      title={item ? "Retirar asignación" : "Asignar jurado"}
      busy={action.busy}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action.run(
            item ? `/asignaciones/${item.id}` : "/asignaciones",
            item ? "PATCH" : "POST",
            item
              ? { activo: false, motivo: reason }
              : { proyecto: project, jurado: jury },
          );
        }}
      >
        {item ? (
          <Field
            label="Motivo"
            minLength={5}
            value={reason}
            onChange={setReason}
          />
        ) : (
          <>
            <Select
              label="Proyecto entregado"
              value={project}
              onChange={setProject}
              options={projects.filter((p) => p.estado === "entregado")}
            />
            <Select
              label="Jurado activo"
              value={jury}
              onChange={setJury}
              options={juries}
            />
          </>
        )}
        <Notice>{action.error}</Notice>
        <Submit busy={action.busy} />
      </form>
    </Modal>
  );
}
