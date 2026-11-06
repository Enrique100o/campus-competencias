import { useState } from "react";
import { Modal } from "../../components/ui/Modal.jsx";
import {
  Field,
  Select,
  Notice,
  Submit,
  useAction,
  localDate,
  referenceId,
} from "../../components/ui/Workflow.jsx";

export function ScheduleForm({
  event,
  item,
  venues,
  registrations,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(
    item
      ? {
          ...item,
          escenario: referenceId(item.escenario),
          inicio: localDate(item.inicio),
          fin: localDate(item.fin),
        }
      : {
          tipo: event.formato === "pruebas" ? "prueba" : "partido",
          fase: event.reglamento.fases[0],
          grupo: "",
          prueba: event.reglamento.pruebas[0] || "",
          escenario: "",
          inicio: "",
          fin: "",
          participaciones: [],
          recursos: [],
          obligatoria: true,
        },
  );
  const [reason, setReason] = useState(""),
    action = useAction(onSaved),
    set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const venue = venues.find((v) => v.id === form.escenario);
  const changeEntry = (id, key, value) =>
    set(
      "participaciones",
      form.participaciones.map((p) =>
        p.inscripcion === id ? { ...p, [key]: value } : p,
      ),
    );
  return (
    <Modal
      title={item ? "Reprogramar competencia" : "Programar competencia"}
      busy={action.busy}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const {
            tipo,
            fase,
            grupo,
            prueba,
            escenario,
            inicio,
            fin,
            participaciones,
            recursos,
            obligatoria,
          } = form;
          action.run(
            item ? `/competencias/${item.id}` : "/competencias",
            item ? "PATCH" : "POST",
            {
              torneo: event.id,
              tipo,
              fase,
              grupo,
              prueba,
              escenario,
              inicio: new Date(inicio).toISOString(),
              fin: new Date(fin).toISOString(),
              participaciones: participaciones.map((p) => ({
                inscripcion: p.inscripcion,
                carril: p.carril || "",
                serie: p.serie || "",
                posicion: p.posicion || "",
              })),
              recursos,
              obligatoria,
              ...(item ? { motivo: reason } : {}),
            },
          );
        }}
      >
        <div className="form-row">
          <Select
            label="Tipo"
            value={form.tipo}
            onChange={(v) => set("tipo", v)}
            options={["partido", "prueba", "ronda"]}
          />
          <Select
            label="Fase"
            value={form.fase}
            onChange={(v) => set("fase", v)}
            options={event.reglamento.fases}
          />
        </div>
        <Field
          label="Grupo"
          value={form.grupo}
          required={false}
          onChange={(v) => set("grupo", v)}
        />
        {event.reglamento.pruebas.length > 0 && (
          <Select
            label="Prueba"
            value={form.prueba}
            onChange={(v) => {
              setForm((f) => ({ ...f, prueba: v, participaciones: [] }));
            }}
            options={event.reglamento.pruebas}
          />
        )}
        <Select
          label="Escenario"
          value={form.escenario}
          onChange={(v) =>
            setForm((f) => ({ ...f, escenario: v, recursos: [] }))
          }
          options={venues.filter(
            (v) =>
              v.estado === "activo" && v.disciplinas.includes(event.disciplina),
          )}
        />
        <div className="form-row">
          <Field
            label="Inicio"
            type="datetime-local"
            value={form.inicio}
            onChange={(v) => set("inicio", v)}
          />
          <Field
            label="Fin"
            type="datetime-local"
            value={form.fin}
            onChange={(v) => set("fin", v)}
          />
        </div>
        <fieldset>
          <legend>Recursos reservados</legend>
          {venue?.recursos.map((r) => (
            <label className="check-line" key={r.nombre}>
              <input
                type="checkbox"
                checked={form.recursos.includes(r.nombre)}
                onChange={(e) =>
                  set(
                    "recursos",
                    e.target.checked
                      ? [...form.recursos, r.nombre]
                      : form.recursos.filter((x) => x !== r.nombre),
                  )
                }
              />
              {r.nombre} · capacidad {r.capacidad}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Competidores con inscripción confirmada</legend>
          {registrations
            .filter(
              (r) =>
                r.estado === "confirmada" && (r.prueba || "") === form.prueba,
            )
            .map((r) => {
              const included = form.participaciones.some(
                  (p) => p.inscripcion === r.id,
                ),
                entry = form.participaciones.find(
                  (p) => p.inscripcion === r.id,
                );
              return (
                <div key={r.id} className="schedule-entry">
                  <label className="check-line">
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={(e) =>
                        set(
                          "participaciones",
                          e.target.checked
                            ? [
                                ...form.participaciones,
                                {
                                  inscripcion: r.id,
                                  carril: "",
                                  serie: "",
                                  posicion: "",
                                },
                              ]
                            : form.participaciones.filter(
                                (p) => p.inscripcion !== r.id,
                              ),
                        )
                      }
                    />
                    {r.competidorNombre}
                  </label>
                  {included && form.tipo !== "partido" && (
                    <div className="form-row">
                      <Select
                        required={false}
                        label="Carril / recurso"
                        value={entry.carril}
                        onChange={(v) => changeEntry(r.id, "carril", v)}
                        options={form.recursos}
                      />
                      <Field
                        label="Serie"
                        required={false}
                        value={entry.serie}
                        onChange={(v) => changeEntry(r.id, "serie", v)}
                      />
                      <Field
                        label="Posición de salida"
                        required={false}
                        value={entry.posicion}
                        onChange={(v) => changeEntry(r.id, "posicion", v)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
        </fieldset>
        <label className="check-line">
          <input
            type="checkbox"
            checked={form.obligatoria}
            onChange={(e) => set("obligatoria", e.target.checked)}
          />
          Competencia obligatoria para el cierre
        </label>
        {item && (
          <Field
            label="Motivo de reprogramación"
            value={reason}
            onChange={setReason}
            minLength={5}
          />
        )}
        <Notice>{action.error}</Notice>
        <Submit busy={action.busy} />
      </form>
    </Modal>
  );
}
