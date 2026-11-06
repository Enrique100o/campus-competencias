import { useState } from "react";
import { useResource } from "../../hooks/useResource.js";
import {
  PageHeading,
  Field,
  LoadState,
  DataTable,
  displayDate,
} from "../../components/ui/Workflow.jsx";
import { Modal } from "../../components/ui/Modal.jsx";

export function AuditPanel() {
  const [operation, setOperation] = useState(""),
    [from, setFrom] = useState(""),
    [until, setUntil] = useState(""),
    [event, setEvent] = useState(""),
    [detail, setDetail] = useState(null);
  const tournaments = useResource("/torneos?limit=50"),
    hacks = useResource("/hackatones?limit=50");
  const params = new URLSearchParams({
    limit: 20,
    ...(operation ? { operacion: operation } : {}),
    ...(event ? { evento: event } : {}),
    ...(from ? { desde: new Date(from).toISOString() } : {}),
    ...(until
      ? { hasta: new Date(until + "T23:59:59-05:00").toISOString() }
      : {}),
  });
  const [page, setPage] = useState(1);
  params.set("page", page);
  const records = useResource("/historial?" + params);
  return (
    <>
      <PageHeading
        title="Historial"
        description="Autor, fecha, motivo y valores relevantes de cada cambio."
      />
      <section className="directory-card">
        <div className="toolbar workflow-toolbar">
          <Field
            label="Operación"
            value={operation}
            onChange={(v) => {
              setOperation(v);
              setPage(1);
            }}
            required={false}
          />
          <Field
            label="Desde"
            type="date"
            required={false}
            value={from}
            onChange={(v) => {
              setFrom(v);
              setPage(1);
            }}
          />
          <Field
            label="Hasta"
            type="date"
            required={false}
            value={until}
            onChange={(v) => {
              setUntil(v);
              setPage(1);
            }}
          />
          <label>
            Evento
            <select
              value={event}
              onChange={(e) => {
                setEvent(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los eventos autorizados</option>
              {[
                ...(tournaments.data?.items || []),
                ...(hacks.data?.items || []),
              ].map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <LoadState resource={records} />
        <DataTable
          rows={records.data?.items || []}
          columns={[
            { label: "Fecha", render: (r) => displayDate(r.createdAt) },
            { label: "Autor", render: (r) => r.autor?.nombre || "Usuario" },
            { label: "Operación", render: (r) => r.operacion },
            { label: "Motivo", render: (r) => r.motivo || "Cambio ordinario" },
            {
              label: "Detalle",
              render: (r) => (
                <button
                  className="button button-secondary"
                  onClick={() => setDetail(r)}
                >
                  Ver cambios
                </button>
              ),
            },
          ]}
        />
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            disabled={page === 1}
            onClick={() => setPage((v) => v - 1)}
          >
            Anterior
          </button>
          <span>
            Página {page} de {records.data?.pages || 1}
          </span>
          <button
            className="button button-secondary"
            disabled={page >= (records.data?.pages || 1)}
            onClick={() => setPage((v) => v + 1)}
          >
            Siguiente
          </button>
        </div>
      </section>
      {detail && (
        <Modal title="Valores del cambio" onClose={() => setDetail(null)}>
          <h3>Antes</h3>
          <pre className="audit-values">
            {JSON.stringify(detail.anterior, null, 2)}
          </pre>
          <h3>Después</h3>
          <pre className="audit-values">
            {JSON.stringify(detail.nuevo, null, 2)}
          </pre>
        </Modal>
      )}
    </>
  );
}
