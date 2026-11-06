import { Audit } from "../workflow/models.js";
import { Tournament, Hackathon } from "../../competition-models.js";
import { User } from "../../models.js";

// El historial permite explicar cambios sin registrar credenciales, cookies ni tokens.
function safe(value) {
  if (Array.isArray(value)) return value.map(safe);
  if (value?.toObject) return safe(value.toObject());
  if (value instanceof Date) return value.toISOString();
  if (value?._bsontype === "ObjectId") return String(value);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !/password|token|cookie|authVersion|bootstrapAdmin|clave/i.test(
              key,
            ),
        )
        .map(([key, item]) => [key, safe(item)]),
    );
  return value;
}

export async function auditMiddleware(req, res, next) {
  if (
    !["POST", "PUT", "PATCH", "DELETE"].includes(req.method) ||
    req.path.startsWith("/auth") ||
    req.path.startsWith("/setup")
  )
    return next();
  if (req.path.startsWith("/usuarios/") && req.method === "PATCH") {
    const identifier = req.path.split("/")[2];
    if (/^[a-f\d]{24}$/i.test(identifier))
      req.auditBefore = await User.findById(identifier).lean();
  }
  const send = res.json.bind(res);
  res.json = function (payload) {
    if (res.statusCode >= 400 || !req.user || !payload?.data)
      return send(payload);
    const data = payload.data;
    const details = req.audit || {};
    const identify = async () => {
      let evento =
        details.evento ||
        data.torneo ||
        data.hackaton ||
        req.body?.torneo ||
        req.body?.hackaton ||
        null;
      let tipoEvento =
        details.tipoEvento ||
        (data.torneo || req.body?.torneo
          ? "torneos"
          : data.hackaton || req.body?.hackaton
            ? "hackatones"
            : "general");
      if (!evento && /^\/(torneos|hackatones)(\/|$)/.test(req.path)) {
        tipoEvento = req.path.split("/")[1];
        evento = data.id || req.path.split("/")[2];
      }
      if (tipoEvento === "general" && req.path.startsWith("/usuarios"))
        tipoEvento = "cuentas";
      await Audit.create({
        autor: req.user._id,
        evento,
        tipoEvento,
        recurso: req.path.split("/")[1],
        identificador: String(data.id || req.path.split("/")[2] || ""),
        operacion: `${req.method} ${req.path}`,
        motivo: details.motivo || req.body?.motivo || "",
        anterior: safe(details.anterior || req.auditBefore || null),
        nuevo: safe(data),
      });
      return send(payload);
    };
    // La respuesta se envía después del registro: una escritura confirmada ya tiene trazabilidad consultable.
    identify().catch(next);
    return res;
  };
  next();
}

export async function auditScope(user) {
  if (user.rol === "administrador") return {};
  const ids = [
    ...(await Tournament.find({ responsable: user._id }).distinct("_id")),
    ...(await Hackathon.find({ responsable: user._id }).distinct("_id")),
  ];
  return { evento: { $in: ids } };
}
