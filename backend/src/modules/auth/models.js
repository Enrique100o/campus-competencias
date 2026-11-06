import mongoose from "mongoose";

// Se conserva solo el hash del refresh token. Cada uso invalida ese token y emite otro.
const schema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    familia: { type: String, required: true, index: true },
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
    },
    sesion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sesion",
      required: true,
    },
    authVersion: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    usadoEn: Date,
    revocadoEn: Date,
  },
  { collection: "refresh_tokens", timestamps: true, bufferCommands: false },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RefreshToken = mongoose.model("RefreshToken", schema);
