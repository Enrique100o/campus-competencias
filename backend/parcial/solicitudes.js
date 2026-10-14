// Las peticiones usan recursos preparados en MongoDB para evitar copiar identificadores durante la exposición.
export const historiasParcial = [
  { numero: 1, id: 'HU004', titulo: 'Consultar mi perfil', historia: 'Como usuario quiero consultar mi perfil para verificar mis datos y mi rol dentro de la plataforma.', segundos: 18 },
  { numero: 2, id: 'HU005', titulo: 'Eliminar una institución sin relaciones', historia: 'Como administrador quiero eliminar una institución registrada por error y sin relaciones para mantener un directorio correcto sin perder historial.', segundos: 22 },
  { numero: 3, id: 'HU006', titulo: 'Configurar una disciplina y sus categorías', historia: 'Como administrador quiero configurar disciplinas, categorías y modalidades para organizar las distintas competencias deportivas.', segundos: 26 },
  { numero: 4, id: 'HU008', titulo: 'Crear un torneo deportivo', historia: 'Como organizador quiero crear torneos deportivos para gestionar competencias universitarias e intercolegiadas de distintas disciplinas.', segundos: 30 },
  { numero: 5, id: 'HU009', titulo: 'Crear un hackatón', historia: 'Como administrador quiero crear un hackatón con fechas, categorías y límites de equipos para preparar un evento de innovación tecnológica.', segundos: 28 },
  { numero: 6, id: 'HU010', titulo: 'Actualizar el reglamento de un borrador', historia: 'Como organizador quiero actualizar el reglamento de un torneo en borrador para fijar integrantes, fases y criterios deportivos antes de abrir las inscripciones.', segundos: 24 },
  { numero: 7, id: 'HU012', titulo: 'Registrar un participante', historia: 'Como organizador quiero registrar participantes asociados a una cuenta y a una institución para identificar a las personas que competirán.', segundos: 24 },
  { numero: 8, id: 'HU013', titulo: 'Registrar un equipo deportivo', historia: 'Como participante responsable quiero registrar un equipo deportivo con su plantilla para representar a mi institución en los torneos.', segundos: 24 },
  { numero: 9, id: 'HU015', titulo: 'Consultar torneos disponibles', historia: 'Como participante quiero filtrar los torneos con inscripciones abiertas por disciplina para encontrar una competencia disponible.', segundos: 18 },
  { numero: 10, id: 'HU016', titulo: 'Inscribir un equipo y conservar su plantilla', historia: 'Como participante responsable quiero inscribir mi equipo en un torneo abierto para formalizar su participación y conservar la plantilla registrada.', segundos: 26 },
];

export function reglasFutbol(extra = {}) {
  return { integrantesMin: 5, integrantesMax: 8, maxInscripciones: 1, metrica: 'goles', unidad: 'goles', precision: 0, orden: 'descendente', fases: ['Clasificación', 'Final'], avance: 'Los dos mejores equipos avanzan a la final.', desempates: ['Diferencia de goles', 'Goles a favor'], pruebas: [], requisitos: 'Cuenta e institución activas; integrantes de la categoría Juvenil.', permiteMultiplesEquipos: false, ...extra };
}

export function cuerpoTorneo(contexto, nombre) {
  return { nombre, descripcion: 'Competencia de fútbol 5 para la demostración del MVP.', tipo: 'intercolegiados', disciplina: contexto.disciplinaId, categoria: contexto.categoriaId, unidadInscripcion: 'equipo', formato: 'liga', ciudad: 'Barranquilla', departamento: 'Atlántico', inicio: contexto.fechas.inicio, fin: contexto.fechas.fin, inscripcionInicio: contexto.fechas.inscripcionInicio, inscripcionFin: contexto.fechas.inscripcionFin, cupos: 8, responsable: contexto.actores.organizador.id, reglamento: reglasFutbol() };
}

export function cuerpoEquipo(contexto, nombre) {
  return { nombre, tipo: 'deportivo', responsable: contexto.actores.participante.id, estado: 'activo', institucion: contexto.institucionId, disciplina: contexto.disciplinaId, categoria: contexto.categoriaId, modalidad: 'equipo', integrantes: contexto.integrantes };
}

export function crearSolicitudes(contexto) {
  const { sufijo, actores, fechas } = contexto;
  const inscripcion = { torneo: contexto.torneoAbiertoId, modalidad: 'equipo', competidor: contexto.equipoBaseId, prueba: '' };
  function solicitud(numero, titulo, actor, metodo, ruta, estado, cuerpo, extra = {}) {
    const headers = { ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) };
    if (actor) {
      headers.Cookie = actores[actor].cookie;
      if (metodo !== 'GET') headers['X-CSRF-Token'] = actores[actor].csrf;
    }
    return { numero, titulo, actor, metodo, url: `${contexto.apiUrl}${ruta}`, estado, headers, ...(cuerpo ? { cuerpo } : {}), ...extra };
  }
  const principales = [
    solicitud(1, historiasParcial[0].titulo, 'participante', 'GET', `/usuarios/${actores.participante.id}`, 200),
    solicitud(2, historiasParcial[1].titulo, 'administrador', 'DELETE', `/instituciones/${contexto.institucionEliminarId}`, 200),
    solicitud(3, historiasParcial[2].titulo, 'administrador', 'POST', '/disciplinas', 201, { nombre: `Voleibol Parcial ${sufijo}`, modalidades: ['equipo'], formatos: ['liga', 'grupos'], categorias: [{ nombre: 'Juvenil', edadMin: 15, edadMax: 18, genero: 'cualquiera' }], estado: 'activo' }),
    solicitud(4, historiasParcial[3].titulo, 'organizador', 'POST', '/torneos', 201, cuerpoTorneo(contexto, `Torneo nuevo Parcial ${sufijo}`)),
    solicitud(5, historiasParcial[4].titulo, 'administrador', 'POST', '/hackatones', 201, { nombre: `Hackatón Parcial ${sufijo}`, descripcion: 'Soluciones para la comunidad universitaria.', ciudad: 'Barranquilla', departamento: 'Atlántico', modalidad: 'presencial', ...fechas.hackaton, cupos: 12, integrantesMin: 2, integrantesMax: 4, proyectosPorEquipo: 1, categorias: ['Educación', 'Ambiente'], requisitos: 'Proyecto original del equipo.', responsable: actores.organizador.id }),
    solicitud(6, historiasParcial[5].titulo, 'organizador', 'PATCH', `/torneos/${contexto.torneoReglasId}`, 200, { reglamento: reglasFutbol({ fases: ['Fase de grupos', 'Semifinal', 'Final'], avance: 'Los cuatro mejores equipos avanzan a semifinales.' }) }),
    solicitud(7, historiasParcial[6].titulo, 'organizador', 'POST', '/participantes', 201, { documento: `PAR-NUEVO-${sufijo}`.toUpperCase(), nombre: `Participante nuevo Parcial ${sufijo}`, nacimiento: contexto.nacimientoDemo, genero: 'femenino', usuario: contexto.usuarioNuevoId, institucion: contexto.institucionId, categoria: 'Juvenil', estado: 'activo' }),
    solicitud(8, historiasParcial[7].titulo, 'participante', 'POST', '/equipos', 201, cuerpoEquipo(contexto, `Equipo nuevo Parcial ${sufijo}`)),
    solicitud(9, historiasParcial[8].titulo, 'participante', 'GET', `/torneos?estado=inscripciones&tipo=intercolegiados&disciplina=${contexto.disciplinaId}&q=${sufijo}`, 200),
    solicitud(10, historiasParcial[9].titulo, 'participante', 'POST', '/inscripciones', 201, inscripcion),
  ].map((peticion, index) => ({ ...peticion, historia: historiasParcial[index] }));
  const reserva = [
    solicitud('R01', 'PUT: actualizar ubicación de una institución', 'administrador', 'PUT', `/instituciones/${contexto.institucionId}`, 200, { nombre: contexto.institucionNombre, ciudad: 'Santiago de Cali', departamento: 'Valle del Cauca', tipo: 'colegio', estado: 'activo' }),
    solicitud('R02', '404: consultar la institución eliminada en el paso 2', 'administrador', 'GET', `/instituciones/${contexto.institucionEliminarId}`, 404),
    solicitud('R03', '400: rechazar una disciplina sin nombre', 'administrador', 'POST', '/disciplinas', 400, { nombre: '', modalidades: ['equipo'], formatos: ['liga'], categorias: [{ nombre: 'Abierta', edadMin: 18, edadMax: 40, genero: 'cualquiera' }], estado: 'activo' }),
    solicitud('R04', '409: rechazar la inscripción repetida del paso 10', 'participante', 'POST', '/inscripciones', 409, inscripcion),
    solicitud('R05', '200: comprobar que la API sigue funcionando', null, 'GET', '/health', 200),
    solicitud('R06', '409: proteger una institución con participantes', 'administrador', 'DELETE', `/instituciones/${contexto.institucionId}`, 409),
    solicitud('R07', 'HU001: iniciar sesión con la cuenta de ensayo', null, 'POST', '/auth/login', 200, { correo: actores.participante.correo, password: contexto.passwordDemo }),
    solicitud('R08', '400: rechazar un identificador mal formado', 'administrador', 'GET', '/instituciones/no-es-un-objectid', 400),
    solicitud('R09', '403: proteger un perfil ajeno', 'participante', 'GET', `/usuarios/${actores.administrador.id}`, 403),
  ];
  return { principales, reserva };
}
