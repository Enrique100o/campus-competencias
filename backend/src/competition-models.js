import mongoose from 'mongoose';

const { Schema } = mongoose;
const reference = (model, required = true) => ({ type: Schema.Types.ObjectId, ref: model, required });
const activeState = { type: String, enum: ['activo', 'inactivo'], default: 'activo' };
const options = collection => ({ collection, timestamps: true, bufferCommands: false });

export const participationModes = ['equipo', 'individual', 'relevo'];
export const competitionFormats = ['liga', 'grupos', 'eliminacion', 'pruebas', 'rondas'];
export const sportsStates = ['borrador', 'inscripciones', 'en_curso', 'finalizado', 'cancelado'];
export const hackathonStates = ['borrador', 'inscripciones', 'entrega', 'evaluacion', 'publicado', 'cancelado'];

const categorySchema = new Schema({
  nombre: { type: String, required: true },
  edadMin: { type: Number, default: null },
  edadMax: { type: Number, default: null },
  genero: { type: String, enum: ['cualquiera', 'femenino', 'masculino'], default: 'cualquiera' },
});
const disciplineSchema = new Schema({
  nombre: { type: String, required: true },
  clave: { type: String, required: true, unique: true, select: false },
  modalidades: [{ type: String, enum: participationModes }],
  formatos: [{ type: String, enum: competitionFormats }],
  categorias: [categorySchema],
  estado: activeState,
}, options('disciplinas'));

const rulesSchema = new Schema({
  integrantesMin: { type: Number, required: true },
  integrantesMax: { type: Number, required: true },
  maxInscripciones: { type: Number, required: true },
  metrica: { type: String, enum: ['goles', 'puntos', 'sets', 'tiempo', 'distancia', 'otra'], required: true },
  unidad: { type: String, required: true },
  precision: { type: Number, required: true },
  orden: { type: String, enum: ['ascendente', 'descendente'], required: true },
  fases: [String],
  avance: { type: String, required: true },
  desempates: [String],
  pruebas: [String],
  edadMin: { type: Number, default: null },
  edadMax: { type: Number, default: null },
  genero: { type: String, required: true },
  requisitos: { type: String, default: '' },
  permiteMultiplesEquipos: { type: Boolean, default: false },
}, { _id: false });

const tournamentSchema = new Schema({
  nombre: { type: String, required: true },
  descripcion: { type: String, default: '' },
  tipo: { type: String, enum: ['intercolegiados', 'universitario'], required: true },
  disciplina: reference('Disciplina'),
  categoria: { type: String, required: true },
  categoriaNombre: { type: String, required: true },
  unidadInscripcion: { type: String, enum: participationModes, required: true },
  formato: { type: String, enum: competitionFormats, required: true },
  ciudad: { type: String, required: true },
  departamento: { type: String, required: true },
  inicio: { type: Date, required: true },
  fin: { type: Date, required: true },
  inscripcionInicio: { type: Date, required: true },
  inscripcionFin: { type: Date, required: true },
  cupos: { type: Number, required: true },
  responsable: reference('Usuario'),
  estado: { type: String, enum: sportsStates, default: 'borrador' },
  reglamento: { type: rulesSchema, required: true },
  reglamentoVersion: { type: Number, default: 1 },
  creadoPor: reference('Usuario'),
}, options('torneos'));
tournamentSchema.index({ estado: 1, tipo: 1, disciplina: 1 });

const hackathonSchema = new Schema({
  nombre: { type: String, required: true },
  descripcion: { type: String, required: true },
  ciudad: { type: String, required: true },
  departamento: { type: String, required: true },
  modalidad: { type: String, enum: ['presencial', 'virtual', 'hibrida'], required: true },
  inicio: { type: Date, required: true },
  fin: { type: Date, required: true },
  inscripcionInicio: { type: Date, required: true },
  inscripcionFin: { type: Date, required: true },
  entregaInicio: { type: Date, required: true },
  entregaFin: { type: Date, required: true },
  evaluacionInicio: { type: Date, required: true },
  evaluacionFin: { type: Date, required: true },
  cupos: { type: Number, required: true },
  integrantesMin: { type: Number, required: true },
  integrantesMax: { type: Number, required: true },
  proyectosPorEquipo: { type: Number, required: true },
  categorias: [String],
  requisitos: { type: String, default: '' },
  responsable: reference('Usuario'),
  estado: { type: String, enum: hackathonStates, default: 'borrador' },
  creadoPor: reference('Usuario'),
}, options('hackatones'));
hackathonSchema.index({ estado: 1, responsable: 1 });

const participantSchema = new Schema({
  documento: { type: String, required: true, unique: true },
  nombre: { type: String, required: true },
  nacimiento: { type: Date, required: true },
  genero: { type: String, enum: ['femenino', 'masculino', 'otro'], required: true },
  usuario: { ...reference('Usuario'), unique: true },
  institucion: reference('Institucion'),
  categoria: { type: String, required: true },
  estado: activeState,
  creadoPor: reference('Usuario'),
}, options('participantes'));
participantSchema.index({ institucion: 1, categoria: 1 });

const teamSchema = new Schema({
  nombre: { type: String, required: true },
  tipo: { type: String, enum: ['deportivo', 'tecnologico'], required: true },
  clave: { type: String, required: true, unique: true, select: false },
  responsable: reference('Usuario'),
  estado: activeState,
  institucion: reference('Institucion', false),
  disciplina: reference('Disciplina', false),
  categoria: String,
  categoriaNombre: String,
  modalidad: { type: String, enum: ['equipo', 'relevo'] },
  hackaton: reference('Hackaton', false),
  categoriaTecnologica: String,
  integrantes: [reference('Participante')],
  creadoPor: reference('Usuario'),
}, options('equipos'));
teamSchema.index({ responsable: 1, estado: 1 });

const registrationSchema = new Schema({
  torneo: reference('Torneo'),
  modalidad: { type: String, enum: participationModes, required: true },
  competidor: { type: Schema.Types.ObjectId, required: true },
  institucion: reference('Institucion'),
  prueba: { type: String, default: '' },
  estado: { type: String, enum: ['confirmada'], default: 'confirmada' },
  creadoPor: reference('Usuario'),
  plantilla: [{ participante: reference('Participante'), nombre: String, institucion: reference('Institucion') }],
  reglamentoVersion: { type: Number, required: true },
}, options('inscripciones'));
registrationSchema.index({ torneo: 1, modalidad: 1, competidor: 1, prueba: 1 }, { unique: true });

export const Discipline = mongoose.model('Disciplina', disciplineSchema);
export const Tournament = mongoose.model('Torneo', tournamentSchema);
export const Hackathon = mongoose.model('Hackaton', hackathonSchema);
export const Participant = mongoose.model('Participante', participantSchema);
export const Team = mongoose.model('Equipo', teamSchema);
export const Registration = mongoose.model('Inscripcion', registrationSchema);
export const competitionModels = [Discipline, Tournament, Hackathon, Participant, Team, Registration];

export function resourceJSON(value) {
  if (value?.toObject) return resourceJSON(value.toObject());
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(resourceJSON);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['__v', 'clave', 'passwordHash', 'authVersion', 'bootstrapAdmin'].includes(key))
    .map(([key, item]) => [key === '_id' ? 'id' : key, resourceJSON(item)]));
  return value;
}
