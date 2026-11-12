import { DisciplineFields } from "./fields/DisciplineFields.jsx";
import { EventFields } from "./fields/EventFields.jsx";
import { ParticipantFields } from "./fields/ParticipantFields.jsx";
import { TeamFields } from "./fields/TeamFields.jsx";
import { SportsRegistrationFields } from "./fields/SportsRegistrationFields.jsx";
import { EventPolicyFields } from "./fields/EventPolicyFields.jsx";
import { ClassificationFields } from "./fields/ClassificationFields.jsx";
import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Trophy, X } from "lucide-react";
import { api } from "../../api.js";
import { Notice, Field, Select } from "../../components/ui/Fields.jsx";
import {
  singular,
  fields,
  dateFields,
  pick,
  lines,
  initial,
} from "./config.js";
// Prepara los campos según el recurso y envía exclusivamente los campos editables.
export function ResourceForm({
  type,
  item,
  catalogs,
  user,
  onClose,
  onSaved,
  onLogout,
}) {
  const dialog = useRef(null);
  const ownProfile =
    type === "equipos" && !item && user.rol === "participante"
      ? catalogs.miFicha
      : null;
  const [form, setForm] = useState(() => ({
    ...initial(type, item, user),
    ...(ownProfile ? { institucion: ownProfile.institucion } : {}),
  }));
  const [members, setMembers] = useState(() =>
    ownProfile
      ? [ownProfile]
      : (item?.integrantes || []).map(
          (id) =>
            (item.integrantesDetalle || catalogs.participantes).find(
              (person) => person.id === id,
            ) || { id, nombre: "Integrante registrado" },
        ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current.showModal();
  }, []);
  const set = (key, value) => {
    if (type === "equipos" && (key === "tipo" || key === "institucion")) {
      setMembers((current) =>
        key === "tipo"
          ? ownProfile
            ? [ownProfile]
            : []
          : current.filter((person) => person.institucion === value),
      );
    }
    setForm((old) => {
      const next = { ...old, [key]: value };
      if (key === "disciplina")
        Object.assign(next, {
          categoria: "",
          modalidad: "",
          unidadInscripcion: "",
          formato: "",
        });
      if (key === "hackaton") next.categoriaTecnologica = "";
      if (key === "tipo" && type === "equipos")
        Object.assign(next, {
          institucion:
            value === "deportivo" ? ownProfile?.institucion || "" : "",
          disciplina: "",
          categoria: "",
          modalidad: "",
          hackaton: "",
          categoriaTecnologica: "",
        });
      if (key === "unidadInscripcion" && value === "individual")
        next.reglamento = {
          ...old.reglamento,
          integrantesMin: 1,
          integrantesMax: 1,
        };
      if (key === "torneo") {
        const event = catalogs.torneos.find((t) => t.id === value);
        Object.assign(next, {
          modalidad: event?.unidadInscripcion || "",
          competidor: "",
          prueba: "",
        });
      }
      return next;
    });
  };
  const rule = (key, value) =>
    setForm((old) => ({
      ...old,
      reglamento: { ...old.reglamento, [key]: value },
    }));
  const field = (key, label, options = {}) => (
    <Field
      label={label}
      value={form[key]}
      onChange={(value) => set(key, value)}
      {...options}
    />
  );
  const select = (key, label, options, props = {}) => (
    <Select
      label={label}
      value={form[key]}
      onChange={(value) => set(key, value)}
      options={options}
      {...props}
    />
  );
  const available = (list, key) =>
    list.map((record) => ({
      ...record,
      nombre: `${record.nombre}${record.estado === "inactivo" ? " (inactivo)" : ""}`,
      disabled: record.estado === "inactivo" && form[key] !== record.id,
    }));
  const discipline = catalogs.disciplinas.find((d) => d.id === form.disciplina);
  const hack = catalogs.hackatones.find((h) => h.id === form.hackaton);
  const event = catalogs.torneos.find((t) => t.id === form.torneo);
  const locked = type === "torneos" && item && item.estado !== "borrador";
  const owners = catalogs.usuarios.filter(
    (u) =>
      [
        "administrador",
        "organizador",
        ...(type === "equipos" ? ["participante"] : []),
      ].includes(u.rol) &&
      (user.rol !== "organizador" || type === "equipos" || u.id === user.id) &&
      (user.rol !== "participante" || u.id === user.id),
  );
  const competitors = !event
    ? []
    : event.unidadInscripcion === "individual"
      ? catalogs.participantes.filter(
          (p) =>
            p.estado === "activo" &&
            (user.rol === "administrador" ||
              event.responsable === user.id ||
              p.usuario === user.id),
        )
      : catalogs.equipos.filter(
          (t) =>
            t.tipo === "deportivo" &&
            t.estado === "activo" &&
            t.disciplina === event.disciplina &&
            t.categoria === event.categoria &&
            t.modalidad === event.unidadInscripcion &&
            (user.rol === "administrador" ||
              event.responsable === user.id ||
              t.responsable === user.id),
        );
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = pick(form, fields[type]);
      if (type === "hackatones")
        body.categorias = lines(body.categorias.join("\n"));
      if (type === "torneos")
        body.reglamento = {
          ...body.reglamento,
          ...Object.fromEntries(
            ["fases", "desempates", "pruebas"].map((key) => [
              key,
              lines(body.reglamento[key].join("\n")),
            ]),
          ),
        };
      for (const key of dateFields)
        if (body[key]) body[key] = new Date(body[key]).toISOString();
      if (type === "equipos") {
        body.integrantes = members.map((person) => person.id);
        const omit =
          body.tipo === "deportivo"
            ? ["hackaton", "categoriaTecnologica"]
            : ["institucion", "disciplina", "categoria", "modalidad"];
        omit.forEach((key) => delete body[key]);
      }
      await api(`/${type}${item ? `/${item.id}` : ""}`, {
        method: item ? "PATCH" : "POST",
        body,
      });
      onSaved(
        type === "inscripciones"
          ? "Inscripción confirmada."
          : "Información guardada.",
      );
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="institution-dialog resource-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="resource-form-title"
    >
      <div className="dialog-heading">
        <span className="dialog-icon">
          <Trophy size={24} />
        </span>
        <button
          className="icon-button"
          aria-label="Cerrar formulario"
          onClick={onClose}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </div>
      <h2 id="resource-form-title">
        {item ? "Editar" : type === "inscripciones" ? "Confirmar" : "Crear"}{" "}
        {singular[type]}
      </h2>
      <p>
        {type === "equipos"
          ? "Elige los datos del equipo y agrega a tus compañeros por nombre."
          : type === "inscripciones"
            ? "La plataforma comprobará requisitos, fechas y disponibilidad antes de confirmar."
            : "Completa los datos. Los campos y relaciones se validan al guardar."}
      </p>
      <form onSubmit={submit}>
        {type !== "inscripciones" &&
          field("nombre", "Nombre", { minLength: 2, maxLength: 100 })}
        {type === "disciplinas" && <DisciplineFields form={form} set={set} />}
        {["torneos", "hackatones"].includes(type) && (
          <EventFields
            form={form}
            set={set}
            type={type}
            select={select}
            locked={locked}
            available={available}
            catalogs={catalogs}
            discipline={discipline}
            field={field}
            owners={owners}
            rule={rule}
            onLocationChange={(location) =>
              setForm((old) => ({ ...old, ...location }))
            }
          />
        )}
        {type === "participantes" && (
          <ParticipantFields
            field={field}
            select={select}
            available={available}
            catalogs={catalogs}
          />
        )}
        {type === "equipos" && (
          <TeamFields
            select={select}
            item={item}
            available={available}
            owners={owners}
            form={form}
            catalogs={catalogs}
            discipline={discipline}
            hack={hack}
            user={user}
            members={members}
            onMembersChange={setMembers}
            busy={busy}
          />
        )}
        {type === "inscripciones" && (
          <SportsRegistrationFields
            select={select}
            catalogs={catalogs}
            event={event}
            competitors={competitors}
          />
        )}
        {["disciplinas", "participantes", "equipos"].includes(type) &&
          !(type === "equipos" && !item && user.rol === "participante") &&
          select("estado", "Estado", ["activo", "inactivo"])}

        {["torneos", "hackatones"].includes(type) && (
          <EventPolicyFields form={form} set={set} type={type} />
        )}
        {type === "torneos" && (
          <ClassificationFields locked={locked} form={form} rule={rule} />
        )}
        <Notice>{error}</Notice>
        <div className="dialog-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Check size={17} />
            )}
            {type === "inscripciones" ? "Confirmar inscripción" : "Guardar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
