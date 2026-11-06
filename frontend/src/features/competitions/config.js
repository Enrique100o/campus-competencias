// Catálogos, permisos de presentación y valores iniciales. La API vuelve a comprobar todos los permisos.
export const resourceNames = {
  disciplinas: "Disciplinas",
  torneos: "Torneos",
  hackatones: "Hackatones",
  participantes: "Participantes",
  equipos: "Equipos",
  inscripciones: "Inscripciones",
};
const singular = {
  disciplinas: "disciplina",
  torneos: "torneo",
  hackatones: "hackatón",
  participantes: "participante",
  equipos: "equipo",
  inscripciones: "inscripción",
};
const labels = {
  activo: "Activo",
  inactivo: "Inactivo",
  borrador: "Borrador",
  inscripciones: "Inscripciones abiertas",
  en_curso: "En curso",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
  entrega: "Entrega de proyectos",
  evaluacion: "Evaluación",
  publicado: "Publicado",
  equipo: "Equipo",
  individual: "Individual",
  relevo: "Relevo",
  liga: "Liga",
  grupos: "Grupos",
  eliminacion: "Eliminación",
  pruebas: "Pruebas",
  rondas: "Rondas",
  intercolegiados: "Intercolegiados",
  universitario: "Universitario",
  deportivo: "Deportivo",
  tecnologico: "Tecnológico",
  cualquiera: "Sin restricción",
  femenino: "Femenino",
  masculino: "Masculino",
  otro: "Otro",
  presencial: "Presencial",
  virtual: "Virtual",
  hibrida: "Híbrida",
  ascendente: "Menor resultado primero",
  descendente: "Mayor resultado primero",
  goles: "Goles",
  puntos: "Puntos",
  sets: "Sets",
  tiempo: "Tiempo",
  distancia: "Distancia",
  otra: "Otra",
  confirmada: "Confirmada",
};
const empty = {
  items: [],
  total: 0,
  pages: 1,
  summary: { total: 0, active: 0 },
};
const catalogsEmpty = {
  instituciones: [],
  disciplinas: [],
  usuarios: [],
  participantes: [],
  equipos: [],
  torneos: [],
  hackatones: [],
};
const fields = {
  disciplinas: ["nombre", "modalidades", "formatos", "categorias", "estado"],
  torneos: [
    "nombre",
    "descripcion",
    "tipo",
    "disciplina",
    "categoria",
    "unidadInscripcion",
    "formato",
    "ciudad",
    "departamento",
    "inicio",
    "fin",
    "inscripcionInicio",
    "inscripcionFin",
    "cupos",
    "responsable",
    "reglamento",
    "requiereAprobacion",
  ],
  hackatones: [
    "nombre",
    "descripcion",
    "ciudad",
    "departamento",
    "modalidad",
    "inicio",
    "fin",
    "inscripcionInicio",
    "inscripcionFin",
    "entregaInicio",
    "entregaFin",
    "evaluacionInicio",
    "evaluacionFin",
    "cupos",
    "integrantesMin",
    "integrantesMax",
    "proyectosPorEquipo",
    "categorias",
    "requisitos",
    "responsable",
    "requiereAprobacion",
    "requiereRepositorio",
    "requiereDemostracion",
  ],
  participantes: [
    "documento",
    "nombre",
    "nacimiento",
    "genero",
    "usuario",
    "institucion",
    "categoria",
    "estado",
  ],
  equipos: [
    "nombre",
    "tipo",
    "responsable",
    "estado",
    "institucion",
    "disciplina",
    "categoria",
    "modalidad",
    "hackaton",
    "categoriaTecnologica",
    "integrantes",
  ],
  inscripciones: ["torneo", "modalidad", "competidor", "prueba"],
};
const ruleFields = [
  "integrantesMin",
  "integrantesMax",
  "maxInscripciones",
  "metrica",
  "unidad",
  "precision",
  "orden",
  "fases",
  "avance",
  "desempates",
  "pruebas",
  "requisitos",
  "permiteMultiplesEquipos",
  "clasificacion",
];
const dateFields = [
  "inicio",
  "fin",
  "inscripcionInicio",
  "inscripcionFin",
  "entregaInicio",
  "entregaFin",
  "evaluacionInicio",
  "evaluacionFin",
];
const pick = (item, keys) =>
  Object.fromEntries(
    keys
      .filter((key) => item[key] !== undefined)
      .map((key) => [key, item[key]]),
  );
const lines = (value) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
function localDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
const readableDate = (value) =>
  value
    ? new Date(value).toLocaleString("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Sin fecha";
const nameOf = (list, id) =>
  list.find((item) => item.id === id)?.nombre || "Registro no disponible";
function eventStatus(item) {
  if (item.estado !== "inscripciones") return labels[item.estado];
  const now = Date.now();
  return now < Date.parse(item.inscripcionInicio)
    ? "Inscripciones próximas"
    : now > Date.parse(item.inscripcionFin)
      ? "Inscripciones cerradas"
      : "Inscripciones abiertas";
}
function canEdit(type, item, user) {
  if (user.rol === "administrador") return true;
  if (["torneos", "hackatones"].includes(type))
    return user.rol === "organizador" && item.responsable === user.id;
  if (type === "participantes")
    return user.rol === "organizador" && item.creadoPor === user.id;
  if (type === "equipos")
    return (
      item.responsable === user.id ||
      (user.rol === "organizador" && item.creadoPor === user.id)
    );
  return false;
}
function canCreate(type, user) {
  if (["disciplinas", "hackatones"].includes(type))
    return user.rol === "administrador";
  if (["torneos", "participantes"].includes(type))
    return ["administrador", "organizador"].includes(user.rol);
  return ["administrador", "organizador", "participante"].includes(user.rol);
}
function initial(type, item, user) {
  const common = { nombre: "", estado: "activo", responsable: user.id };
  const defaults = {
    disciplinas: {
      ...common,
      modalidades: [],
      formatos: [],
      categorias: [
        { nombre: "", edadMin: "", edadMax: "", genero: "cualquiera" },
      ],
    },
    torneos: {
      ...common,
      requiereAprobacion: false,
      descripcion: "",
      tipo: "intercolegiados",
      disciplina: "",
      categoria: "",
      unidadInscripcion: "",
      formato: "",
      ciudad: "",
      departamento: "",
      inicio: "",
      fin: "",
      inscripcionInicio: "",
      inscripcionFin: "",
      cupos: "",
      reglamento: {
        integrantesMin: "",
        integrantesMax: "",
        maxInscripciones: 1,
        metrica: "puntos",
        unidad: "",
        precision: 0,
        orden: "descendente",
        fases: [],
        avance: "",
        desempates: [],
        pruebas: [],
        requisitos: "",
        permiteMultiplesEquipos: false,
      },
    },
    hackatones: {
      ...common,
      requiereAprobacion: false,
      requiereRepositorio: false,
      requiereDemostracion: false,
      descripcion: "",
      modalidad: "presencial",
      ciudad: "",
      departamento: "",
      inicio: "",
      fin: "",
      inscripcionInicio: "",
      inscripcionFin: "",
      entregaInicio: "",
      entregaFin: "",
      evaluacionInicio: "",
      evaluacionFin: "",
      cupos: "",
      integrantesMin: "",
      integrantesMax: "",
      proyectosPorEquipo: 1,
      categorias: [],
      requisitos: "",
    },
    participantes: {
      ...common,
      documento: "",
      nacimiento: "",
      genero: "otro",
      usuario: "",
      institucion: "",
      categoria: "",
    },
    equipos: {
      ...common,
      tipo: "deportivo",
      institucion: "",
      disciplina: "",
      categoria: "",
      modalidad: "",
      hackaton: "",
      categoriaTecnologica: "",
      integrantes: [],
    },
    inscripciones: { torneo: "", modalidad: "", competidor: "", prueba: "" },
  };
  if (!item) return defaults[type];
  const form = { ...defaults[type], ...pick(item, fields[type]) };
  if (type === "torneos") form.reglamento = pick(item.reglamento, ruleFields);
  if (type === "disciplinas")
    form.categorias = item.categorias.map((cat) => ({
      ...cat,
      edadMin: cat.edadMin ?? "",
      edadMax: cat.edadMax ?? "",
    }));
  if (type === "participantes") form.nacimiento = item.nacimiento.slice(0, 10);
  for (const key of dateFields) if (form[key]) form[key] = localDate(form[key]);
  return form;
}

export {
  singular,
  labels,
  empty,
  catalogsEmpty,
  fields,
  ruleFields,
  dateFields,
  pick,
  lines,
  localDate,
  readableDate,
  nameOf,
  eventStatus,
  canEdit,
  canCreate,
  initial,
};

Object.assign(labels, {
  pendiente: "Pendiente",
  rechazada: "Rechazada",
  cancelada: "Cancelada",
  programada: "Programada",
  reprogramada: "Reprogramada",
  finalizada: "Finalizada",
  entregado: "Entregado",
  enviada: "Enviada",
  valido: "Válido",
  descalificado: "Descalificado",
  no_presentacion: "No se presentó",
  abandono: "Abandono",
  partido: "Partido",
  prueba: "Prueba",
  ronda: "Ronda",
  cancha: "Cancha",
  coliseo: "Coliseo",
  pista: "Pista",
  piscina: "Piscina",
  mejor: "Mejor marca",
  suma: "Suma",
  promedio: "Promedio",
});
