import mongoose from "mongoose";

// Los módulos nuevos referencian los modelos existentes por nombre: no duplican usuarios ni eventos.
const { Schema } = mongoose;
const ref = (model, required = true) => ({
  type: Schema.Types.ObjectId,
  ref: model,
  required,
});
const options = (collection) => ({
  collection,
  timestamps: true,
  bufferCommands: false,
});
const roster = [
  {
    participante: ref("Participante"),
    nombre: String,
    institucion: ref("Institucion"),
  },
];

const venueSchema = new Schema(
  {
    nombre: { type: String, required: true },
    tipo: { type: String, required: true },
    ubicacion: { type: String, required: true },
    capacidad: { type: Number, required: true },
    disciplinas: [ref("Disciplina")],
    recursos: [{ nombre: String, capacidad: Number }],
    disponibilidad: [{ inicio: Date, fin: Date }],
    estado: { type: String, enum: ["activo", "inactivo"], default: "activo" },
    creadoPor: ref("Usuario"),
  },
  options("escenarios"),
);
venueSchema.index({ estado: 1, disciplinas: 1 });

const hackRegistrationSchema = new Schema(
  {
    hackaton: ref("Hackaton"),
    equipo: ref("Equipo"),
    creadoPor: ref("Usuario"),
    estado: {
      type: String,
      enum: ["pendiente", "confirmada", "rechazada", "cancelada"],
      default: "confirmada",
    },
    motivo: String,
    plantilla: roster,
  },
  options("inscripciones_hackaton"),
);
// Se reutiliza el documento al solicitar de nuevo una inscripción retirada; el historial conserva sus estados.
hackRegistrationSchema.index({ hackaton: 1, equipo: 1 }, { unique: true });

const scheduleSchema = new Schema(
  {
    torneo: ref("Torneo"),
    escenario: ref("Escenario"),
    tipo: {
      type: String,
      enum: ["partido", "prueba", "ronda"],
      required: true,
    },
    fase: { type: String, required: true },
    grupo: String,
    prueba: String,
    inicio: { type: Date, required: true },
    fin: { type: Date, required: true },
    obligatoria: { type: Boolean, default: true },
    participaciones: [
      {
        inscripcion: ref("Inscripcion"),
        competidor: Schema.Types.ObjectId,
        nombre: String,
        carril: String,
        serie: String,
        posicion: String,
      },
    ],
    personas: [Schema.Types.ObjectId],
    recursos: [String],
    creadoPor: ref("Usuario"),
    motivo: String,
    estado: {
      type: String,
      enum: ["programada", "reprogramada", "finalizada", "cancelada"],
      default: "programada",
    },
  },
  options("competencias"),
);
scheduleSchema.index({ escenario: 1, inicio: 1, fin: 1 });
scheduleSchema.index({ personas: 1, inicio: 1 });
scheduleSchema.index({ torneo: 1, fase: 1, inicio: 1 });

const resultSchema = new Schema(
  {
    competencia: { ...ref("Competencia"), unique: true },
    torneo: ref("Torneo"),
    autor: ref("Usuario"),
    marcas: [
      {
        inscripcion: ref("Inscripcion"),
        valor: { type: Number, default: null },
        desempate: { type: Number, default: null },
        estado: {
          type: String,
          enum: ["valido", "descalificado", "no_presentacion", "abandono"],
          default: "valido",
        },
      },
    ],
    posiciones: [{ inscripcion: ref("Inscripcion"), posicion: Number }],
    ganadores: [Schema.Types.ObjectId],
    empate: Boolean,
    version: { type: Number, default: 1 },
    reglamentoVersion: Number,
    motivo: String,
  },
  options("resultados"),
);

const criterionSchema = new Schema({
  nombre: String,
  minimo: Number,
  maximo: Number,
  peso: Number,
});
const rubricSchema = new Schema(
  {
    hackaton: { ...ref("Hackaton"), unique: true },
    criterios: [criterionSchema],
    agregacion: {
      type: String,
      enum: ["promedio", "suma"],
      default: "promedio",
    },
    desempates: [String],
    juradosMinimos: { type: Number, default: 1 },
    politicaEmpates: {
      type: String,
      enum: ["pendiente", "compartido"],
      default: "pendiente",
    },
    version: { type: Number, default: 1 },
  },
  options("rubricas"),
);

const projectSchema = new Schema(
  {
    hackaton: ref("Hackaton"),
    equipo: ref("Equipo"),
    inscripcion: ref("InscripcionHackaton"),
    nombre: { type: String, required: true },
    categoria: { type: String, required: true },
    descripcion: String,
    repositorio: String,
    demostracion: String,
    estado: {
      type: String,
      enum: ["borrador", "entregado"],
      default: "borrador",
    },
    creadoPor: ref("Usuario"),
    version: { type: Number, default: 1 },
    entregadoEn: Date,
    presentacion: Schema.Types.Mixed,
  },
  options("proyectos_hackaton"),
);
projectSchema.index({ hackaton: 1, equipo: 1 });

const assignmentSchema = new Schema(
  {
    proyecto: ref("Proyecto"),
    hackaton: ref("Hackaton"),
    jurado: ref("Usuario"),
    activo: { type: Boolean, default: true },
    creadoPor: ref("Usuario"),
    motivo: String,
  },
  options("asignaciones_jurados"),
);
assignmentSchema.index({ proyecto: 1, jurado: 1 }, { unique: true });

const evaluationSchema = new Schema(
  {
    proyecto: ref("Proyecto"),
    hackaton: ref("Hackaton"),
    jurado: ref("Usuario"),
    criterios: [{ criterio: String, valor: Number }],
    observaciones: String,
    estado: {
      type: String,
      enum: ["borrador", "enviada"],
      default: "borrador",
    },
    total: Number,
    rubricaVersion: Number,
    rubrica: Schema.Types.Mixed,
    proyectoVersion: Number,
    version: { type: Number, default: 1 },
    enviadaEn: Date,
    motivo: String,
  },
  options("evaluaciones"),
);
evaluationSchema.index({ proyecto: 1, jurado: 1 }, { unique: true });

const auditSchema = new Schema(
  {
    autor: ref("Usuario"),
    evento: { type: Schema.Types.ObjectId, default: null },
    tipoEvento: {
      type: String,
      enum: ["torneos", "hackatones", "cuentas", "general"],
      default: "general",
    },
    recurso: String,
    identificador: String,
    operacion: String,
    motivo: String,
    anterior: Schema.Types.Mixed,
    nuevo: Schema.Types.Mixed,
  },
  options("historial"),
);
auditSchema.index({ evento: 1, createdAt: -1 });

export const Venue = mongoose.model("Escenario", venueSchema);
export const HackRegistration = mongoose.model(
  "InscripcionHackaton",
  hackRegistrationSchema,
);
export const Competition = mongoose.model("Competencia", scheduleSchema);
export const Result = mongoose.model("Resultado", resultSchema);
export const Rubric = mongoose.model("Rubrica", rubricSchema);
export const Project = mongoose.model("Proyecto", projectSchema);
export const Assignment = mongoose.model("AsignacionJurado", assignmentSchema);
export const Evaluation = mongoose.model("Evaluacion", evaluationSchema);
export const Audit = mongoose.model("Cambio", auditSchema);
export const workflowModels = [
  Venue,
  HackRegistration,
  Competition,
  Result,
  Rubric,
  Project,
  Assignment,
  Evaluation,
  Audit,
];
