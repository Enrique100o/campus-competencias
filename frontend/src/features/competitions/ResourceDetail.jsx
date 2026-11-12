import { useEffect, useRef } from "react";
import { Eye, X } from "lucide-react";

import {
  singular,
  labels,
  readableDate,
  nameOf,
  eventStatus,
} from "./config.js";
// Detalle de solo lectura, incluyendo la versión del reglamento y la plantilla confirmada.
export function ResourceDetail({
  type,
  item,
  catalogs,
  onClose,
  onRegister,
  registrationLabel,
}) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  const row = (title, value) => (
    <div>
      <dt>{title}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );
  const rules = item.reglamento;
  return (
    <dialog
      ref={ref}
      className="institution-dialog resource-dialog detail-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="resource-detail-title"
    >
      <div className="dialog-heading">
        <span className="dialog-icon">
          <Eye size={24} />
        </span>
        <button
          className="icon-button"
          aria-label="Cerrar detalle"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <h2 id="resource-detail-title">{item.nombre || item.competidorNombre}</h2>
      <p>{item.descripcion || `Detalle de ${singular[type]}`}</p>
      <dl className="resource-details">
        {row(
          "Estado",
          item.inicio ? eventStatus(item) : labels[item.estado] || item.estado,
        )}
        {item.tipo && row("Tipo", labels[item.tipo])}
        {item.responsable &&
          row(
            "Responsable",
            item.responsableNombre ||
              nameOf(catalogs.usuarios, item.responsable),
          )}
        {item.institucion &&
          row(
            "Institución",
            item.institucionNombre ||
              nameOf(catalogs.instituciones, item.institucion),
          )}
        {item.disciplina &&
          row(
            "Disciplina",
            item.disciplinaNombre ||
              nameOf(catalogs.disciplinas, item.disciplina),
          )}
        {item.categoria &&
          row("Categoría", item.categoriaNombre || item.categoria)}
        {item.modalidad && row("Modalidad", labels[item.modalidad])}
        {item.ciudad &&
          row("Ubicación", `${item.ciudad}, ${item.departamento}`)}
        {item.inicio && (
          <>
            {row("Inicio", readableDate(item.inicio))}
            {row("Fin", readableDate(item.fin))}
            {row(
              "Ventana de inscripción",
              `${readableDate(item.inscripcionInicio)} — ${readableDate(item.inscripcionFin)}`,
            )}
            {row(
              "Cupos",
              type === "torneos"
                ? `${item.inscritos} ocupados de ${item.cupos}`
                : `${item.inscritos} equipos inscritos de ${item.cupos}`,
            )}
            {type === "hackatones" && (
              <>
                {row(
                  "Ventana de entrega",
                  `${readableDate(item.entregaInicio)} — ${readableDate(item.entregaFin)}`,
                )}
                {row(
                  "Ventana de evaluación",
                  `${readableDate(item.evaluacionInicio)} — ${readableDate(item.evaluacionFin)}`,
                )}
                {row(
                  "Plantilla",
                  `${item.integrantesMin} a ${item.integrantesMax} integrantes`,
                )}
                {row("Proyectos por equipo", item.proyectosPorEquipo)}
                {row("Categorías tecnológicas", item.categorias.join(", "))}
                {row(
                  "Requisitos",
                  item.requisitos || "Sin requisitos adicionales",
                )}
              </>
            )}
          </>
        )}
        {type === "disciplinas" && (
          <>
            {row(
              "Modalidades",
              item.modalidades.map((m) => labels[m]).join(", "),
            )}
            {row("Formatos", item.formatos.map((m) => labels[m]).join(", "))}
            {item.categorias.map((cat) => (
              <div key={cat.id}>
                <dt>{cat.nombre}</dt>
                <dd>
                  Edad: {cat.edadMin ?? "sin mínimo"} a{" "}
                  {cat.edadMax ?? "sin máximo"} · {labels[cat.genero]}
                </dd>
              </div>
            ))}
          </>
        )}
        {type === "participantes" && (
          <>
            {row("Documento", item.documento)}
            {row("Nacimiento", item.nacimiento.slice(0, 10))}
            {row("Género", labels[item.genero])}
            {row("Cuenta de acceso", item.usuarioNombre)}
          </>
        )}
        {type === "equipos" && (
          <>
            {item.hackaton &&
              row("Hackatón de referencia", item.hackatonNombre)}
            {item.categoriaTecnologica &&
              row("Categoría tecnológica", item.categoriaTecnologica)}
            {row(
              "Integrantes",
              item.integrantes
                .map((id) =>
                  nameOf(item.integrantesDetalle || catalogs.participantes, id),
                )
                .join(", ") || "Sin integrantes",
            )}
          </>
        )}
        {type === "inscripciones" && (
          <>
            {row("Torneo", item.torneoNombre)}
            {row("Prueba", item.prueba || "Competencia general")}
            {row("Confirmada el", readableDate(item.createdAt))}
            {row(
              "Plantilla confirmada",
              item.plantilla.map((p) => p.nombre).join(", "),
            )}
            {row("Versión del reglamento", item.reglamentoVersion)}
          </>
        )}
      </dl>
      {rules && (
        <section className="rules-detail">
          <h3>Reglamento · versión {item.reglamentoVersion}</h3>
          <dl className="resource-details">
            {row(
              "Modalidad y formato",
              `${labels[item.unidadInscripcion]} · ${labels[item.formato]}`,
            )}
            {row(
              "Elegibilidad",
              `Edad: ${rules.edadMin ?? "sin mínimo"} a ${rules.edadMax ?? "sin máximo"} · ${labels[rules.genero]}`,
            )}
            {row(
              "Plantilla",
              `${rules.integrantesMin} a ${rules.integrantesMax} integrantes`,
            )}
            {row("Inscripciones por competidor", rules.maxInscripciones)}
            {row(
              "Resultado",
              `${labels[rules.metrica]} · ${rules.unidad} · ${rules.precision} decimales`,
            )}
            {row("Orden", labels[rules.orden])}
            {row("Fases", rules.fases.join(" → "))}
            {row("Avance", rules.avance)}
            {row("Desempates", rules.desempates.join(" → "))}
            {row("Pruebas", rules.pruebas.join(", ") || "Competencia general")}
            {row(
              "Requisitos",
              rules.requisitos || "Sin requisitos adicionales",
            )}
            {row(
              "Participación en varios equipos",
              rules.permiteMultiplesEquipos
                ? "Permitida"
                : "Un solo equipo por torneo",
            )}
          </dl>
        </section>
      )}
      <div className="dialog-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onClose}
        >
          Cerrar detalle
        </button>
        {onRegister && (
          <button
            className="button button-primary"
            onClick={() => onRegister(item)}
          >
            {registrationLabel}
          </button>
        )}
      </div>
    </dialog>
  );
}
