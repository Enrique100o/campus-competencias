import { useState } from "react";
import { useResource } from "../../hooks/useResource.js";
import { VenueForm } from "./VenueForm.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import {
  PageHeading,
  LoadState,
  DataTable,
  Refresh,
  displayDate,
  stateLabel,
} from "../../components/ui/Workflow.jsx";

export function VenuesPanel({ user }) {
  const records = useResource("/escenarios?limit=50"),
    disciplines = useResource("/disciplinas?limit=50"),
    [form, setForm] = useState(null),
    [agenda, setAgenda] = useState(null);
  const slots = useResource(agenda ? `/escenarios/${agenda.id}/agenda` : null);
  const manager = ["administrador", "organizador"].includes(user.rol);
  return (
    <>
      <PageHeading
        title="Escenarios"
        description="Instalaciones, recursos, disponibilidad y reservas."
      >
        {manager && (
          <button
            className="button button-primary"
            onClick={() => setForm({ item: null })}
          >
            Nuevo escenario
          </button>
        )}
      </PageHeading>
      <LoadState resource={records} />
      <section className="directory-card">
        <Refresh onClick={records.reload} />
        <DataTable
          rows={records.data?.items || []}
          columns={[
            { label: "Nombre", render: (r) => r.nombre },
            { label: "Ubicación", render: (r) => r.ubicacion },
            { label: "Capacidad", render: (r) => r.capacidad },
            { label: "Estado", render: (r) => stateLabel(r.estado) },
            {
              label: "Acciones",
              render: (r) => (
                <div className="row-actions">
                  <button
                    className="button button-secondary"
                    onClick={() => setAgenda(r)}
                  >
                    Ver agenda
                  </button>
                  {manager &&
                    (user.rol === "administrador" ||
                      r.creadoPor === user.id) && (
                      <button
                        className="button button-secondary"
                        onClick={() => setForm({ item: r })}
                      >
                        Editar
                      </button>
                    )}
                </div>
              ),
            },
          ]}
        />
      </section>
      {form && (
        <VenueForm
          item={form.item}
          disciplines={disciplines.data?.items || []}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            records.reload();
          }}
        />
      )}
      {agenda && (
        <Modal
          title={`Agenda de ${agenda.nombre}`}
          onClose={() => setAgenda(null)}
        >
          <LoadState resource={slots} />
          <DataTable
            rows={slots.data?.items || []}
            columns={[
              { label: "Fase", render: (r) => r.fase },
              { label: "Inicio", render: (r) => displayDate(r.inicio) },
              { label: "Fin", render: (r) => displayDate(r.fin) },
              {
                label: "Competidores",
                render: (r) =>
                  r.participaciones.map((p) => p.nombre).join(" / "),
              },
              { label: "Estado", render: (r) => stateLabel(r.estado) },
            ]}
          />
        </Modal>
      )}
    </>
  );
}
