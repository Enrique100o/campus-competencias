import { useState } from "react";
import { Modal } from "../../components/ui/Modal.jsx";
import {
  Field,
  Select,
  Notice,
  Submit,
  useAction,
  localDate,
} from "../../components/ui/Workflow.jsx";

export function VenueForm({ item, disciplines, onClose, onSaved }) {
  const [form, setForm] = useState(
    item
      ? {
          ...item,
          disponibilidad: item.disponibilidad.map((d) => ({
            inicio: localDate(d.inicio),
            fin: localDate(d.fin),
          })),
        }
      : {
          nombre: "",
          tipo: "cancha",
          ubicacion: "",
          capacidad: 20,
          disciplinas: [],
          recursos: [],
          disponibilidad: [],
          estado: "activo",
        },
  );
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const action = useAction(onSaved);
  return (
    <Modal
      title={item ? "Editar escenario" : "Nuevo escenario"}
      onClose={onClose}
      busy={action.busy}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const {
            nombre,
            tipo,
            ubicacion,
            capacidad,
            disciplinas,
            recursos,
            disponibilidad,
            estado,
          } = form;
          action.run(
            `/escenarios${item ? `/${item.id}` : ""}`,
            item ? "PATCH" : "POST",
            {
              nombre,
              tipo,
              ubicacion,
              capacidad: Number(capacidad),
              disciplinas,
              recursos: recursos.map((r) => ({
                nombre: r.nombre,
                capacidad: Number(r.capacidad),
              })),
              disponibilidad: disponibilidad.map((d) => ({
                inicio: new Date(d.inicio).toISOString(),
                fin: new Date(d.fin).toISOString(),
              })),
              estado,
            },
          );
        }}
      >
        <Field
          label="Nombre"
          value={form.nombre}
          onChange={(v) => set("nombre", v)}
        />
        <Select
          label="Tipo"
          value={form.tipo}
          onChange={(v) => set("tipo", v)}
          options={["cancha", "coliseo", "pista", "piscina", "otro"]}
        />
        <Field
          label="Ubicación"
          value={form.ubicacion}
          onChange={(v) => set("ubicacion", v)}
        />
        <Field
          label="Capacidad de participantes"
          type="number"
          min={1}
          value={form.capacidad}
          onChange={(v) => set("capacidad", v)}
        />
        <fieldset>
          <legend>Disciplinas compatibles</legend>
          {disciplines.map((d) => (
            <label className="check-line" key={d.id}>
              <input
                type="checkbox"
                checked={form.disciplinas.includes(d.id)}
                onChange={(e) =>
                  set(
                    "disciplinas",
                    e.target.checked
                      ? [...form.disciplinas, d.id]
                      : form.disciplinas.filter((x) => x !== d.id),
                  )
                }
              />
              {d.nombre}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Recursos: carriles, áreas u otras reservas</legend>
          {form.recursos.map((r, i) => (
            <div className="form-row" key={i}>
              <Field
                label="Recurso"
                value={r.nombre}
                onChange={(v) =>
                  set(
                    "recursos",
                    form.recursos.map((x, n) =>
                      n === i ? { ...x, nombre: v } : x,
                    ),
                  )
                }
              />
              <Field
                label="Capacidad del recurso"
                type="number"
                min={1}
                value={r.capacidad}
                onChange={(v) =>
                  set(
                    "recursos",
                    form.recursos.map((x, n) =>
                      n === i ? { ...x, capacidad: v } : x,
                    ),
                  )
                }
              />
              <button
                className="button button-secondary"
                type="button"
                onClick={() =>
                  set(
                    "recursos",
                    form.recursos.filter((_, n) => n !== i),
                  )
                }
              >
                Retirar
              </button>
            </div>
          ))}
          <button
            className="button button-secondary"
            type="button"
            onClick={() =>
              set("recursos", [...form.recursos, { nombre: "", capacidad: 1 }])
            }
          >
            Agregar recurso
          </button>
        </fieldset>
        <fieldset>
          <legend>Disponibilidad</legend>
          <p>
            Sin franjas se considera disponible dentro de las fechas del torneo.
          </p>
          {form.disponibilidad.map((d, i) => (
            <div key={i} className="form-row">
              <Field
                label="Desde"
                type="datetime-local"
                value={d.inicio}
                onChange={(v) =>
                  set(
                    "disponibilidad",
                    form.disponibilidad.map((x, n) =>
                      n === i ? { ...x, inicio: v } : x,
                    ),
                  )
                }
              />
              <Field
                label="Hasta"
                type="datetime-local"
                value={d.fin}
                onChange={(v) =>
                  set(
                    "disponibilidad",
                    form.disponibilidad.map((x, n) =>
                      n === i ? { ...x, fin: v } : x,
                    ),
                  )
                }
              />
              <button
                className="button button-secondary"
                type="button"
                onClick={() =>
                  set(
                    "disponibilidad",
                    form.disponibilidad.filter((_, n) => n !== i),
                  )
                }
              >
                Retirar
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button button-secondary"
            onClick={() =>
              set("disponibilidad", [
                ...form.disponibilidad,
                { inicio: "", fin: "" },
              ])
            }
          >
            Agregar franja
          </button>
        </fieldset>
        <Select
          label="Estado"
          value={form.estado}
          onChange={(v) => set("estado", v)}
          options={["activo", "inactivo"]}
        />
        <Notice>{action.error}</Notice>
        <Submit busy={action.busy} />
      </form>
    </Modal>
  );
}
