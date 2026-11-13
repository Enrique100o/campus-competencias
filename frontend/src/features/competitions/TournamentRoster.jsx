import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "../../components/ui/Modal.jsx";
import {
  DataTable,
  LoadState,
  stateLabel,
} from "../../components/ui/Workflow.jsx";
import { useResource } from "../../hooks/useResource.js";

const columns = [
  {
    label: "Participante o equipo",
    render: (entry) => (
      <div>
        <strong>{entry.nombre}</strong>
        {entry.integrantes.length > 0 && <p>{entry.integrantes.join(", ")}</p>}
      </div>
    ),
  },
  { label: "Prueba", render: (entry) => entry.prueba || "General" },
  { label: "Estado", render: (entry) => stateLabel(entry.estado) },
];

export function TournamentRoster({ event, onClose }) {
  const [page, setPage] = useState(1);
  const roster = useResource(
    `/torneos/${event.id}/inscritos?page=${page}&limit=10`,
  );
  const data = roster.data;
  return (
    <Modal title="Inscritos del torneo" onClose={onClose}>
      <p>{event.nombre}</p>
      <LoadState resource={roster} />
      {roster.error && (
        <button className="button button-secondary" onClick={roster.reload}>
          Volver a intentar
        </button>
      )}
      {!roster.error && data && (
        <>
          <p className="form-hint" role="status">
            {data.total} de {event.cupos} cupos ocupados · {data.confirmed}{" "}
            confirmadas · {data.pending} pendientes
          </p>
          {!roster.loading &&
            (data.items.length ? (
              <DataTable rows={data.items} columns={columns} />
            ) : (
              <p>Todavía no hay inscripciones activas en este torneo.</p>
            ))}
          {data.pages > 1 && (
            <div className="table-footer">
              <span>
                Página {page} de {data.pages}
              </span>
              <div>
                <button
                  type="button"
                  className="pagination-button"
                  aria-label="Página anterior de inscritos"
                  disabled={roster.loading || page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  type="button"
                  className="pagination-button"
                  aria-label="Página siguiente de inscritos"
                  disabled={roster.loading || page >= data.pages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
