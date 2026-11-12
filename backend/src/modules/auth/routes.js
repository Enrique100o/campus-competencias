import { Router } from "express";
import { User } from "../../models.js";
import { credentials, formFields, ApiError } from "../../validation.js";
import {
  authLimiter,
  createSession,
  hashPassword,
  verifyPassword,
  requireCsrf,
  refreshSession,
  revokeSession,
  sessionData,
} from "../../security.js";
// Autenticación y rotación, sin mezclar reglas de instituciones o competencias.
export function authRouter(config, authenticated) {
  const router = Router(),
    limiter = authLimiter();
  router.get("/setup/status", async (req, res) => {
    const exists = await User.exists({});
    res.json({
      data: {
        needsSetup: !exists && config.allowInitialSetup,
        setupAllowed: config.allowInitialSetup,
      },
    });
  });

  router.post("/setup/administrador", limiter, async (req, res) => {
    if (!config.allowInitialSetup)
      throw new ApiError(404, "Operación no disponible.", "NOT_FOUND");
    if (await User.exists({}))
      throw new ApiError(
        409,
        "La cuenta inicial ya fue creada. Inicia sesión.",
        "SETUP_CLOSED",
      );
    const input = credentials(req.body, true);
    const user = await User.create({
      nombre: input.nombre,
      correo: input.correo,
      passwordHash: await hashPassword(input.password),
      rol: "administrador",
      estado: "activo",
      bootstrapAdmin: true,
    });
    res.status(201).json({ data: await createSession(res, user, config) });
  });

  router.post("/auth/login", limiter, async (req, res) => {
    const input = credentials(req.body);
    const user = await User.findOne({ correo: input.correo }).select(
      "+passwordHash +authVersion",
    );
    const valid = await verifyPassword(input.password, user?.passwordHash);
    if (!valid || user?.estado !== "activo")
      throw new ApiError(
        401,
        "Correo o contraseña incorrectos.",
        "INVALID_CREDENTIALS",
      );
    res.json({ data: await createSession(res, user, config) });
  });

  router.post("/auth/registro", limiter, async (req, res) => {
    if (config.allowInitialSetup && !(await User.exists({})))
      throw new ApiError(
        409,
        "Campus todavía necesita su cuenta de administrador inicial.",
        "SETUP_REQUIRED",
      );
    formFields(req.body, ["nombre", "correo", "password"]);
    const input = credentials(req.body, true);
    const user = await User.create({
      nombre: input.nombre,
      correo: input.correo,
      passwordHash: await hashPassword(input.password),
      rol: "participante",
      estado: "activo",
    });
    res.status(201).json({ data: await createSession(res, user, config) });
  });

  router.post("/auth/refresh", limiter, (req, res) =>
    refreshSession(req, res, config),
  );

  router.get("/auth/me", authenticated, (req, res) => {
    res.json({ data: sessionData(req.user, req.session, config) });
  });

  router.post("/auth/logout", authenticated, requireCsrf, async (req, res) => {
    await revokeSession(req, res, config);
  });

  return router;
}
