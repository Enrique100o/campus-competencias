// Todas las rutas devuelven un contrato de error uniforme y no filtran detalles internos.
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.code === 11000) {
    let message = req.path.includes("/instituciones")
      ? "Ya existe una institución con ese nombre y ubicación."
      : "Ya existe un registro con esos datos.";
    if (req.path.startsWith("/api/setup"))
      message = "La cuenta inicial ya existe. Inicia sesión.";
    else if (req.path.startsWith("/api/usuarios"))
      message = "Ya existe una cuenta con ese correo.";
    else if (req.path.startsWith("/api/disciplinas"))
      message = "Ya existe una disciplina con ese nombre.";
    else if (req.path.startsWith("/api/participantes"))
      message = "Ya existe un participante con ese documento o cuenta.";
    else if (req.path.startsWith("/api/equipos"))
      message = "Ya existe un equipo con ese nombre en esta categoría.";
    else if (req.path.startsWith("/api/inscripciones"))
      message = "Este competidor ya está inscrito en la prueba.";
    return res.status(409).json({ error: { code: "DUPLICATE", message } });
  }
  if (error.type === "entity.parse.failed")
    return res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "El formato enviado no es válido.",
      },
    });
  if (error.type === "entity.too.large")
    return res.status(413).json({
      error: {
        code: "TOO_LARGE",
        message: "La solicitud es demasiado grande.",
      },
    });
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({
      error: { code: "VALIDATION", message: "Revisa los datos enviados." },
    });
  }
  const status = error.status || 500;
  if (status >= 500)
    console.error("La API no pudo completar una operación:", error.name);
  res.status(status).json({
    error: {
      code: error.code || "INTERNAL",
      message:
        status < 500
          ? error.message
          : "No se pudo completar la operación. Intenta nuevamente.",
      ...(error.fields ? { fields: error.fields } : {}),
    },
  });
}
