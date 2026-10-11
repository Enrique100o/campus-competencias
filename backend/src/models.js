import mongoose from 'mongoose';
import { competitionModels } from './competition-models.js';

const { Schema } = mongoose;
export const roles = ['administrador', 'organizador', 'participante', 'jurado'];
export const institutionTypes = ['colegio', 'universidad', 'instituto', 'otro'];
export const states = ['activo', 'inactivo'];

const userSchema = new Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 100 },
  correo: { type: String, required: true, lowercase: true, trim: true, maxlength: 254, unique: true },
  passwordHash: { type: String, required: true, select: false },
  rol: { type: String, enum: roles, required: true },
  estado: { type: String, enum: states, default: 'activo' },
  bootstrapAdmin: { type: Boolean, select: false },
  authVersion: { type: Number, default: 0, select: false },
}, { timestamps: true, collection: 'usuarios', bufferCommands: false });
// Dos solicitudes simultáneas no pueden crear dos administradores iniciales.
userSchema.index({ bootstrapAdmin: 1 }, {
  unique: true, partialFilterExpression: { bootstrapAdmin: true },
});

const sessionSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  usuario: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  csrfToken: { type: String, required: true },
  authVersion: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true, collection: 'sesiones', bufferCommands: false });

const institutionSchema = new Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 150 },
  ciudad: { type: String, required: true, trim: true, maxlength: 100 },
  departamento: { type: String, required: true, trim: true, maxlength: 100 },
  tipo: { type: String, required: true, enum: institutionTypes },
  estado: { type: String, required: true, enum: states, default: 'activo' },
  clave: { type: String, required: true, unique: true, select: false },
}, { timestamps: true, collection: 'instituciones', bufferCommands: false });
institutionSchema.index({ estado: 1, nombre: 1 });

export const User = mongoose.model('Usuario', userSchema);
export const Session = mongoose.model('Sesion', sessionSchema);
export const Institution = mongoose.model('Institucion', institutionSchema);

export async function initializeModels() {
  await Promise.all([User.init(), Session.init(), Institution.init(), ...competitionModels.map(model => model.init())]);
}

export function publicUser(user) {
  return { id: String(user._id), nombre: user.nombre, correo: user.correo, rol: user.rol, estado: user.estado };
}

export function publicInstitution(doc) {
  return {
    id: String(doc._id), nombre: doc.nombre, ciudad: doc.ciudad,
    departamento: doc.departamento, tipo: doc.tipo, estado: doc.estado,
    createdAt: doc.createdAt, updatedAt: doc.updatedAt,
  };
}
