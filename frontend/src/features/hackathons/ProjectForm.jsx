import { useState } from "react";
import { Modal } from "../../components/ui/Modal.jsx";
import {
  Field,
  Select,
  TextArea,
  Notice,
  Submit,
  useAction,
  referenceId,
} from "../../components/ui/Workflow.jsx";

export function ProjectForm({ event, item, teams, onClose, onSaved }) {
  const [form, setForm] = useState(
    item
      ? { ...item, equipo: referenceId(item.equipo) }
      : {
          equipo: "",
          nombre: "",
          categoria: event.categorias[0] || "",
          descripcion: "",
          repositorio: "",
          demostracion: "",
        },
  );
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value })),
    action = useAction(onSaved);
  return (
    <Modal
      title={item ? "Editar proyecto" : "Nuevo proyecto"}
      onClose={onClose}
      busy={action.busy}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const {
            equipo,
            nombre,
            categoria,
            descripcion,
            repositorio,
            demostracion,
          } = form;
          action.run(
            item ? `/proyectos/${item.id}` : "/proyectos",
            item ? "PATCH" : "POST",
            {
              hackaton: event.id,
              equipo,
              nombre,
              categoria,
              descripcion,
              repositorio,
              demostracion,
            },
          );
        }}
      >
        <Select
          label="Equipo inscrito"
          value={form.equipo}
          onChange={(v) => set("equipo", v)}
          options={teams}
          disabled={Boolean(item)}
        />
        <Field
          label="Nombre del proyecto"
          value={form.nombre}
          onChange={(v) => set("nombre", v)}
        />
        <Select
          label="Categoría"
          value={form.categoria}
          onChange={(v) => set("categoria", v)}
          options={event.categorias}
        />
        <TextArea
          label="Descripción de la solución"
          value={form.descripcion}
          onChange={(v) => set("descripcion", v)}
          required={false}
        />
        <Field
          label={`Repositorio${event.requiereRepositorio ? " (obligatorio al entregar)" : ""}`}
          type="url"
          required={false}
          value={form.repositorio}
          onChange={(v) => set("repositorio", v)}
        />
        <Field
          label={`Demostración${event.requiereDemostracion ? " (obligatoria al entregar)" : ""}`}
          type="url"
          required={false}
          value={form.demostracion}
          onChange={(v) => set("demostracion", v)}
        />
        <p>
          Guardar prepara el borrador. Usa “Entregar” para confirmar la versión
          que evaluarán los jurados.
        </p>
        <Notice>{action.error}</Notice>
        <Submit busy={action.busy}>Guardar borrador</Submit>
      </form>
    </Modal>
  );
}
