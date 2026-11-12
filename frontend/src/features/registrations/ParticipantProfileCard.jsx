import { useState } from "react";
import { Modal } from "../../components/ui/Modal.jsx";
import { LoadState, useAction } from "../../components/ui/Workflow.jsx";
import { useResource } from "../../hooks/useResource.js";
import { ParticipantProfileForm } from "./ParticipantProfileForm.jsx";

export function ParticipantProfileCard() {
  const [editing, setEditing] = useState(false);
  const profile = useResource("/participantes?limit=1");
  const institutions = useResource(editing ? "/catalogos" : null);
  const action = useAction(() => {
    setEditing(false);
    profile.reload();
  });
  const participant = profile.data?.items[0];

  return (
    <section className="profile-card participant-profile-card">
      <h2>Ficha de participante</h2>
      <LoadState resource={profile} />
      {profile.error && (
        <button className="button button-secondary" onClick={profile.reload}>
          Volver a intentar
        </button>
      )}
      {!profile.loading &&
        !profile.error &&
        (participant ? (
          <p>
            {participant.estado === "activo"
              ? `Ficha registrada en ${participant.institucionNombre}.`
              : "Tu ficha está inactiva. Consulta con la organización."}
          </p>
        ) : (
          <>
            <p className="page-description">
              Completa tus datos para participar en torneos o formar parte de un
              equipo.
            </p>
            <button
              className="button button-primary"
              onClick={() => setEditing(true)}
            >
              Completar mi ficha
            </button>
          </>
        ))}
      {editing && (
        <Modal
          title="Tu ficha de participante"
          onClose={() => setEditing(false)}
          busy={action.busy}
        >
          <LoadState resource={institutions} />
          {institutions.error && (
            <button
              className="button button-secondary"
              onClick={institutions.reload}
            >
              Volver a intentar
            </button>
          )}
          {!institutions.loading &&
            !institutions.error &&
            institutions.data && (
              <ParticipantProfileForm
                institutions={institutions.data.instituciones.filter(
                  (i) => i.estado === "activo",
                )}
                busy={action.busy}
                error={action.error}
                onBack={() => setEditing(false)}
                onSave={(body) =>
                  action.run("/participantes/mi-ficha", "POST", body)
                }
              />
            )}
        </Modal>
      )}
    </section>
  );
}
