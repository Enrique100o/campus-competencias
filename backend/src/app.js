import express from "express";
import mongoose from "mongoose";
import { requireSession } from "./security.js";
import { ApiError } from "./validation.js";
import { usersRouter } from "./users.js";
import { competitionRouter } from "./competition-routes.js";
import { authRouter } from "./modules/auth/routes.js";
import { institutionRouter } from "./modules/institutions/routes.js";
import { workflowRouter } from "./modules/workflow/routes.js";
import { auditMiddleware } from "./modules/audit/middleware.js";
import { errorHandler } from "./middleware/errors.js";

// La aplicación compone los módulos. server.js se ocupa de conexión, puertos y cierre del proceso.
export function createApp(config) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") &&
      req.get("origin") !== config.clientOrigin
    )
      throw new ApiError(
        403,
        "El origen de la solicitud no está autorizado.",
        "ORIGIN",
      );
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  const authenticated = requireSession(config);
  app.get("/api/health", (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
      data: { status: connected ? "ok" : "unavailable", database: connected },
    });
  });
  app.use("/api", authRouter(config, authenticated));
  app.use("/api", auditMiddleware);
  app.use("/api/usuarios", usersRouter(authenticated));
  app.use("/api", institutionRouter(authenticated));
  app.use("/api", workflowRouter(authenticated));
  app.use("/api", competitionRouter(authenticated));
  app.use((req, res) =>
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Recurso no encontrado." },
    }),
  );
  app.use(errorHandler);
  return app;
}
