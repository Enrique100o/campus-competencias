# Historias de usuario y trazabilidad

Actualización: 5 de noviembre de 2026. Alcance: matriz v3 de 32 historias, con interfaz web, API REST y MongoDB/Mongoose.

Estado: **32 historias implementadas**. Cada código conserva su necesidad y sus criterios de aceptación.

## Ubicación funcional

| ID | Historia | Pantalla | Endpoint principal |
| --- | --- | --- | --- |
| HU001 | Iniciar y cerrar sesión | Acceso | `POST /api/auth/login; POST /api/auth/logout; POST /api/auth/refresh` |
| HU002 | Controlar acceso por rol y recurso | Menú según rol | `Middleware en cada recurso protegido` |
| HU003 | Registrar y administrar usuarios | Usuarios | `GET/POST /api/usuarios; GET/PATCH /api/usuarios/:id` |
| HU004 | Consultar y actualizar mi perfil | Mi perfil | `GET /api/usuarios/:id; PATCH /api/usuarios/me` |
| HU005 | Gestionar instituciones educativas | Instituciones | `GET/POST /api/instituciones; GET/PUT/PATCH/DELETE /api/instituciones/:id` |
| HU006 | Gestionar disciplinas, categorías y modalidades | Disciplinas | `GET/POST /api/disciplinas; GET/PATCH /api/disciplinas/:id` |
| HU007 | Gestionar escenarios e instalaciones | Escenarios | `GET/POST /api/escenarios; GET/PATCH /api/escenarios/:id; GET /api/escenarios/:id/agenda` |
| HU008 | Crear torneos deportivos | Torneos | `GET/POST /api/torneos; GET/PATCH /api/torneos/:id` |
| HU009 | Crear hackatones | Hackatones | `GET/POST /api/hackatones; GET/PATCH /api/hackatones/:id` |
| HU010 | Definir el reglamento deportivo | Torneos: reglamento | `PATCH /api/torneos/:id` |
| HU011 | Gestionar etapas y fechas de eventos | Agenda / Proyectos: etapas | `PATCH /api/torneos/:id/estado; PATCH /api/hackatones/:id/estado; PATCH /:tipo/:id/fechas` |
| HU012 | Registrar y gestionar participantes | Participantes | `GET/POST /api/participantes; GET/PATCH /api/participantes/:id` |
| HU013 | Registrar equipos deportivos y tecnológicos | Equipos | `GET/POST /api/equipos; GET/PATCH /api/equipos/:id` |
| HU014 | Gestionar integrantes de equipos | Equipos: integrantes | `PATCH /api/equipos/:id` |
| HU015 | Consultar eventos y requisitos | Torneos / Hackatones | `GET /api/torneos; GET /api/hackatones` |
| HU016 | Inscribir competidores en torneos | Inscripciones: Deportes | `POST /api/inscripciones` |
| HU017 | Inscribir equipos en hackatones | Inscripciones: Hackatones | `POST /api/inscripciones-hackaton` |
| HU018 | Revisar y gestionar inscripciones | Inscripciones: seguimiento | `GET /api/inscripciones; PATCH /api/inscripciones/:id; GET /api/inscripciones-hackaton; PATCH /api/inscripciones-hackaton/:id` |
| HU019 | Programar competencias deportivas | Agenda: programar | `POST /api/competencias; POST /api/partidos; POST /api/pruebas; PATCH /api/competencias/:id` |
| HU020 | Consultar la agenda deportiva | Agenda: consultar | `GET /api/torneos/:id/agenda; GET /api/torneos/:id/partidos` |
| HU021 | Registrar resultados deportivos | Agenda: resultados | `POST /api/resultados` |
| HU022 | Consultar clasificaciones y avance | Agenda: clasificación | `GET /api/clasificaciones/:torneoId` |
| HU023 | Corregir resultados deportivos | Agenda: corregir resultado | `PATCH /api/resultados/:id` |
| HU024 | Cerrar torneos y publicar resultados | Agenda: etapa Finalizado | `POST /api/torneos/:id/cerrar` |
| HU025 | Registrar y actualizar proyectos | Proyectos: borradores | `GET/POST /api/proyectos; GET/PATCH /api/proyectos/:id` |
| HU026 | Entregar el proyecto para evaluación | Proyectos: Entregar | `POST /api/proyectos/:id/entregar` |
| HU027 | Configurar la rúbrica de evaluación | Proyectos: Rúbrica | `GET/PUT /api/hackatones/:id/rubrica` |
| HU028 | Asignar jurados a proyectos | Proyectos: Jurados | `GET/POST /api/asignaciones; PATCH /api/asignaciones/:id` |
| HU029 | Registrar evaluaciones de proyectos | Proyectos: Evaluar | `POST /api/evaluaciones` |
| HU030 | Consultar y corregir mi evaluación | Proyectos: Evaluaciones | `GET/PATCH /api/evaluaciones/:id` |
| HU031 | Consultar y publicar el reporte del hackatón | Proyectos: Reporte | `GET /api/hackatones/:id/reporte; POST /api/hackatones/:id/publicar` |
| HU032 | Consultar historial de cambios relevantes | Historial | `GET /api/historial` |

## Criterios de aceptación

Los siguientes criterios conservan el alcance de la matriz original. La política de correo es local: confirmar la contraseña actual al cambiarlo; no se afirma que exista verificación por correo electrónico.

### HU001. Iniciar y cerrar sesión

Como usuario quiero iniciar y cerrar sesión para acceder a las funciones que me corresponden en la plataforma.

- Debe existir una pantalla de acceso y una operación de autenticación en la API.
- Las credenciales válidas de una cuenta activa deben permitir el acceso; las inválidas o de una cuenta inactiva deben rechazarlo.
- La sesión debe tener vencimiento y el cierre de sesión debe invalidar el acceso correspondiente.
- La interfaz debe mostrar al usuario su área de trabajo después del acceso y solicitar autenticación cuando la sesión expire.
- Las contraseñas, si se usan cuentas locales, deben almacenarse mediante hash y nunca devolverse en respuestas.

### HU002. Controlar acceso por rol y recurso

Como usuario quiero acceder a las funciones y recursos autorizados para trabajar según mi rol y responsabilidad.

- Se deben contemplar administrador, organizador, participante y jurado, con permisos documentados.
- La interfaz debe mostrar las opciones correspondientes y la API debe verificar permisos en cada operación protegida.
- El organizador solo debe gestionar los eventos asignados; el participante y el jurado solo sus recursos autorizados.
- Cambiar un identificador o enviar campos adicionales no debe permitir consultar información privada ni asignarse privilegios.
- Los cambios de rol o desactivación deben aplicarse a las sesiones existentes.

### HU003. Registrar y administrar usuarios

Como administrador quiero registrar y administrar usuarios para habilitar las cuentas que utilizarán la plataforma.

- Debe existir POST /api/usuarios y un formulario con nombre, correo, rol y estado.
- El correo debe ser obligatorio, normalizado y único; los roles y estados deben pertenecer al catálogo permitido.
- Debe permitir listar, consultar, actualizar y activar o desactivar cuentas con autorización de administrador.
- El mecanismo de alta debe permitir establecer credenciales sin exponer contraseñas en listados o respuestas.
- Desactivar una cuenta debe conservar sus relaciones históricas y bloquear nuevas operaciones protegidas.

### HU004. Consultar y actualizar mi perfil

Como usuario quiero consultar y actualizar los datos permitidos de mi perfil para mantener mi información correcta.

- Debe existir GET /api/usuarios/:id y una pantalla de perfil para el titular o un administrador autorizado.
- La actualización debe permitir únicamente los campos personales definidos; el usuario no debe cambiar su rol ni su estado.
- Si se actualiza el correo, debe conservarse su unicidad y aplicarse la política de verificación acordada.
- No deben mostrarse contraseñas, hashes, tokens ni información interna innecesaria.
- Los identificadores inválidos o usuarios inexistentes deben producir respuestas controladas.

### HU005. Gestionar instituciones educativas

Como administrador quiero gestionar instituciones educativas para asociarlas a los participantes y equipos de los eventos.

- Debe existir POST /api/instituciones con nombre, ciudad, departamento, tipo y estado.
- Debe permitir listar, buscar, consultar y actualizar instituciones desde la interfaz.
- Los campos obligatorios deben validarse y las instituciones deben estar disponibles en los selectores correspondientes.
- Las relaciones deben utilizar ObjectId y comprobar que la institución exista.
- La desactivación debe conservar el historial y bloquear las nuevas asociaciones que requieran una institución activa.

### HU006. Gestionar disciplinas, categorías y modalidades

Como administrador quiero configurar disciplinas, categorías y modalidades para organizar las distintas competencias deportivas.

- Debe existir POST /api/disciplinas y permitir consulta, actualización y cambio de estado.
- Debe registrar nombre, categorías, modalidad de participación y formato de competencia.
- Debe admitir disciplinas por equipos, individuales o relevos, con partidos, pruebas o rondas según corresponda.
- Las modalidades y categorías deben ser coherentes con la disciplina; los deportes inactivos no deben asignarse a nuevos eventos.
- Debe permitir configurar fútbol, baloncesto, voleibol, atletismo, natación u otras disciplinas mediante sus reglas específicas.

### HU007. Gestionar escenarios e instalaciones

Como organizador quiero gestionar escenarios e instalaciones para asignar las competencias a espacios apropiados y disponibles.

- Debe existir POST /api/escenarios con nombre, tipo, ubicación, capacidad, compatibilidad y estado.
- Debe permitir consulta, actualización y revisión de la agenda del escenario.
- Debe admitir canchas, coliseos, pistas, piscinas y otras instalaciones con los atributos que requiera cada tipo.
- Solo deben asignarse escenarios activos y compatibles con la disciplina.
- La programación debe verificar horarios, capacidad y recursos del escenario; desactivarlo no debe borrar competencias históricas.

### HU008. Crear torneos deportivos

Como organizador quiero crear torneos deportivos para gestionar competencias universitarias e intercolegiadas de distintas disciplinas.

- Debe existir POST /api/torneos con nombre, tipo, disciplina, categoría, ubicación, fechas, cupos, responsable y estado.
- La disciplina y el responsable deben existir; las fechas de inicio y fin deben ser válidas y coherentes.
- El torneo debe indicar su formato y unidad de inscripción: equipo, participante o relevo, según sus reglas.
- Los cupos deben corresponder al formato; no se debe exigir un límite de equipos a una prueba individual.
- Debe permitir consulta y edición autorizada sin modificar reglas que reinterpreten resultados ya registrados.

### HU009. Crear hackatones

Como administrador quiero crear hackatones para organizar eventos de innovación tecnológica con equipos, proyectos y jurados.

- Debe existir POST /api/hackatones con nombre, descripción, ciudad, departamento, modalidad, fechas, responsable y estado.
- Debe configurar límite de equipos, tamaño de plantilla, categorías y cantidad de proyectos permitida por equipo.
- Las fechas y ventanas de inscripción, entrega y evaluación deben ser válidas y tener un orden coherente.
- El organizador responsable debe existir y quedar autorizado para gestionar ese evento.
- Debe permitir consulta y edición autorizada; la rúbrica y las asignaciones de jurados se configuran antes de evaluar.

### HU010. Definir el reglamento deportivo

Como organizador quiero definir el reglamento de mi torneo para aplicar elegibilidad, puntuación, fases y desempates según la disciplina.

- Debe configurar categorías, requisitos de participación, límites de integrantes y número permitido de inscripciones.
- Debe definir fases o rondas, formato de competencia y criterios de avance cuando correspondan.
- El resultado puede utilizar goles, puntos, sets, tiempo, distancia u otras métricas definidas para el deporte.
- Debe establecer unidad, precisión, sentido de orden y desempates; las reglas deben estar completas antes de abrir inscripciones.
- El reglamento vigente debe poder consultarse y conservarse sin alteraciones retroactivas sobre resultados registrados.

### HU011. Gestionar etapas y fechas de eventos

Como organizador quiero gestionar las etapas y fechas de mis eventos para habilitar cada operación en el momento correspondiente.

- Los torneos deben manejar borrador, inscripciones, en curso, finalizado y cancelado mediante transiciones válidas.
- Los hackatones deben contemplar inscripción, entrega de proyectos, evaluación y publicación, además del borrador y la cancelación.
- La API debe comprobar estado y ventana de fechas para aceptar inscripciones, entregas, resultados y evaluaciones.
- Cambiar una fecha o cancelar un evento debe exigir autorización, motivo cuando corresponda y conservación de registros.
- Cerrar una etapa debe bloquear los cambios improcedentes; una reapertura debe seguir una política explícita y registrar su motivo.

### HU012. Registrar y gestionar participantes

Como organizador quiero registrar y gestionar participantes para identificar a las personas que competirán en los eventos.

- Debe existir POST /api/participantes con documento, nombre, fecha de nacimiento, usuario, institución y datos de categoría requeridos.
- El documento debe ser único; las fechas y referencias deben ser válidas.
- Debe permitir consulta por institución y categoría y actualización autorizada de los datos permitidos.
- La elegibilidad para una categoría o evento debe verificarse al inscribir, según el reglamento vigente.
- Los listados de agenda y resultados no deben exponer documentos de identidad ni otros datos personales innecesarios.

### HU013. Registrar equipos deportivos y tecnológicos

Como usuario autorizado quiero registrar un equipo para utilizarlo en competencias deportivas o hackatones.

- Debe existir POST /api/equipos con nombre, tipo, responsable y estado.
- Los equipos deportivos deben relacionarse con institución, disciplina y categoría válidas.
- Los equipos tecnológicos deben cumplir los requisitos del hackatón sin exigir una disciplina deportiva.
- Debe permitir consulta y actualización por el responsable autorizado o el organizador correspondiente.
- La creación del equipo debe mantenerse separada de su inscripción en un evento.

### HU014. Gestionar integrantes de equipos

Como responsable autorizado quiero gestionar los integrantes de mi equipo para cumplir los requisitos de participación.

- Debe permitir agregar y retirar participantes existentes sin duplicar integrantes dentro del equipo.
- Deben validarse cantidad, categoría e institución según el tipo de equipo y el evento.
- Debe aplicar la política del evento sobre participación de una persona en varios equipos.
- Los cambios deben permitirse solo en las etapas habilitadas y por usuarios autorizados.
- La plantilla confirmada para una competencia debe conservarse como referencia histórica aunque el equipo cambie posteriormente.

### HU015. Consultar eventos y requisitos

Como participante quiero consultar torneos y hackatones disponibles para conocer sus requisitos y decidir dónde participar.

- Debe existir un catálogo web de torneos y hackatones con filtros por tipo, estado, disciplina o categoría según aplique.
- GET /api/torneos?tipo=intercolegiados&estado=inscripciones debe devolver únicamente coincidencias de ambos filtros.
- El detalle debe mostrar fechas, responsable, requisitos, cupos y reglamento o criterios del evento.
- Las consultas deben permitir paginación y mostrar mensajes de carga, error y ausencia de resultados.
- Los eventos deben identificarse claramente como abiertos, cerrados, en curso, finalizados o cancelados.

### HU016. Inscribir competidores en torneos

Como usuario autorizado quiero inscribir un equipo, participante o relevo en un torneo para formalizar su participación deportiva.

- Debe existir POST /api/inscripciones con torneo, modalidad de participación, competidor, institución, fecha y estado.
- El evento debe estar abierto y el competidor debe existir y cumplir disciplina, categoría, plantilla y requisitos.
- La inscripción debe asociarse a la prueba o categoría específica cuando el formato lo requiera.
- Debe impedir duplicados y exceso de cupos, también ante solicitudes simultáneas.
- Una inscripción válida debe quedar confirmada o pendiente de aprobación según la política definida, sin confundir esos estados.

### HU017. Inscribir equipos en hackatones

Como representante autorizado quiero inscribir mi equipo en un hackatón para habilitar la presentación de su proyecto.

- El hackatón y el equipo deben existir y el usuario debe estar autorizado para representar al equipo.
- La inscripción debe realizarse dentro de la ventana habilitada y cumplir tamaño de plantilla y requisitos del evento.
- Debe existir una única inscripción del equipo por evento y respetarse el límite de equipos ante solicitudes simultáneas.
- La confirmación o aprobación debe seguir la política configurada y mostrarse en el seguimiento del equipo.
- Un equipo sin inscripción confirmada no debe poder entregar un proyecto para evaluación.

### HU018. Revisar y gestionar inscripciones

Como usuario autorizado quiero consultar y gestionar inscripciones para conocer su estado y resolver solicitudes pendientes o retiros.

- El participante debe consultar sus inscripciones y el organizador las del evento que gestiona.
- Si el evento requiere aprobación, el organizador debe poder confirmar o rechazar solicitudes con un motivo.
- El retiro o cancelación debe respetar el plazo permitido y la autorización correspondiente.
- Una cancelación válida debe liberar el cupo conforme a la política y conservar el registro histórico.
- Las inscripciones pendientes, rechazadas o canceladas no deben usarse para programar competencias o presentar proyectos.

### HU019. Programar competencias deportivas

Como organizador quiero programar partidos, pruebas y rondas para asignar competidores, horarios y escenarios según la disciplina.

- Debe registrar torneo, fase o ronda, competidores confirmados, escenario, inicio, fin y estado.
- En enfrentamientos, los rivales deben ser distintos; en pruebas deben asignarse posiciones, series o carriles cuando corresponda.
- La instalación y sus recursos deben ser compatibles, activos y suficientes para la competencia.
- Debe impedir solapamientos del escenario y de los equipos o participantes involucrados, incluyendo integrantes de relevos.
- La reprogramación debe repetir las validaciones y conservar la referencia del cambio; la API debe proteger solicitudes simultáneas.

### HU020. Consultar la agenda deportiva

Como usuario quiero consultar la agenda de un torneo para conocer cuándo, dónde y contra quién o en qué prueba se compite.

- Debe existir GET /api/torneos/:id/partidos y una consulta de programación completa del torneo.
- Debe mostrar competidores, disciplina, fecha, horario, fase o prueba, escenario y estado en orden cronológico.
- Los formatos individuales deben mostrar la asignación de serie, ronda, posición o carril cuando aplique.
- Debe permitir filtrar por fecha, disciplina, equipo o participante autorizado sin exponer información privada innecesaria.
- Las competencias canceladas, reprogramadas y finalizadas deben distinguirse visualmente.

### HU021. Registrar resultados deportivos

Como organizador quiero registrar resultados deportivos para actualizar el seguimiento de cada competencia con las métricas de su disciplina.

- Debe existir POST /api/resultados y comprobar competencia, evento y autorización del usuario.
- Debe validar goles, puntos, sets, tiempo, distancia o puntaje según el reglamento; no debe exigir la misma estructura a todos los deportes.
- Debe admitir estados como descalificación, no presentación o abandono cuando correspondan, sin interpretarlos como resultados ganadores.
- El ganador, posición o avance debe derivarse de las reglas; debe existir un único resultado vigente por participación o competencia y ronda.
- El registro debe actualizar estado y clasificación de forma consistente; repetir la solicitud no debe sumar resultados dos veces.

### HU022. Consultar clasificaciones y avance

Como usuario quiero consultar clasificaciones y avance del torneo para conocer posiciones, estadísticas y competidores clasificados.

- Debe existir GET /api/clasificaciones/:torneoId y permitir consulta por categoría, fase o prueba cuando aplique.
- La tabla debe utilizar las métricas de la disciplina: puntos y estadísticas, sets, tiempos, distancias o puntajes, según el reglamento.
- El orden y los desempates deben corresponder a las reglas configuradas; un empate no resuelto debe mostrarse como tal.
- Debe mostrar grupos, rondas o llaves cuando el formato lo requiera y aplicar los criterios de avance definidos.
- Los resultados pendientes deben distinguirse de valores cero; las correcciones deben actualizar posiciones sin duplicar conteos.

### HU023. Corregir resultados deportivos

Como organizador quiero corregir un resultado con un motivo para subsanar errores y mantener estadísticas y clasificaciones confiables.

- La corrección debe estar limitada al organizador autorizado y a la etapa permitida por el evento.
- El nuevo resultado debe cumplir las mismas validaciones de la disciplina.
- Debe registrar autor, fecha, motivo y valores anterior y nuevo, conservando un único resultado vigente.
- Debe recalcular estadísticas, posiciones y avance afectados sin duplicar puntos ni participaciones.
- Si existen rondas posteriores o un cierre definitivo, debe requerirse un procedimiento explícito que resuelva esos efectos antes de confirmar.

### HU024. Cerrar torneos y publicar resultados

Como organizador quiero cerrar el torneo y publicar sus resultados para comunicar los ganadores y conservar la edición terminada.

- El cierre debe comprobar que las competencias obligatorias estén resueltas o tengan una cancelación documentada.
- Debe validar que la clasificación y los ganadores correspondan al reglamento y a los resultados vigentes.
- La publicación debe mostrar resultados, posiciones y estado final a los usuarios autorizados.
- El torneo cerrado debe bloquear nuevas inscripciones y cambios ordinarios de programación o resultados.
- Una reapertura posterior debe requerir permiso, motivo e historial y volver a validar la publicación.

### HU025. Registrar y actualizar proyectos

Como participante autorizado quiero registrar y actualizar el proyecto de mi equipo para preparar su presentación en un hackatón.

- Debe existir POST /api/proyectos con hackatón, equipo, nombre, categoría, descripción, estado y fecha.
- El evento y el equipo deben existir y su inscripción debe estar confirmada.
- Debe permitir guardar borradores y editar datos durante la ventana de entrega, respetando el límite de proyectos por equipo.
- Debe permitir enlaces de repositorio o demostración cuando el evento los requiera y validar su formato.
- La consulta y edición deben restringirse al equipo o a usuarios autorizados; el organizador debe poder listar proyectos del hackatón.

### HU026. Entregar el proyecto para evaluación

Como participante autorizado quiero entregar la versión final de mi proyecto para que los jurados evalúen una presentación completa y estable.

- La entrega debe ocurrir dentro de la ventana habilitada y por un usuario autorizado del equipo.
- El proyecto debe tener completos los datos y enlaces obligatorios del evento.
- Debe pasar de borrador a entregado y registrar fecha y versión presentada.
- La actualización antes del cierre debe seguir la política del evento y conservar la versión correspondiente.
- Al cerrar las entregas, el equipo no debe modificar silenciosamente los datos que evaluarán los jurados; los borradores no deben evaluarse.

### HU027. Configurar la rúbrica de evaluación

Como organizador quiero configurar la rúbrica del hackatón para que todos los jurados evalúen con criterios y escalas comunes.

- Debe definir criterios como innovación, impacto, viabilidad y presentación, con rangos y pesos válidos.
- Los pesos deben completar el total configurado y la fórmula de puntuación debe quedar documentada.
- Debe establecer cómo se agregan evaluaciones de varios jurados y cuáles son los criterios de empate.
- La rúbrica debe poder consultarse antes de evaluar y conservar su versión utilizada.
- No debe cambiarse la escala de forma que proyectos del mismo evento queden evaluados con reglas incompatibles.

### HU028. Asignar jurados a proyectos

Como organizador quiero asignar jurados a los proyectos para distribuir las evaluaciones y conocer cuáles están pendientes.

- Solo debe permitir asignar cuentas activas con rol de jurado a proyectos del evento gestionado.
- No debe duplicar la asignación de un jurado al mismo proyecto.
- Cada jurado debe consultar sus proyectos asignados y el estado de evaluación.
- El organizador debe conocer el número esperado, recibido y pendiente de evaluaciones por proyecto.
- Retirar una asignación con evaluación enviada debe seguir una política explícita sobre su vigencia y conservar historial.

### HU029. Registrar evaluaciones de proyectos

Como jurado quiero evaluar los proyectos asignados para calificarlos de acuerdo con la rúbrica del hackatón.

- Debe existir POST /api/evaluaciones con proyecto, jurado, criterios, observaciones, estado y total calculado.
- El proyecto debe estar entregado y asignado al jurado; la evaluación debe realizarse en la ventana habilitada.
- Cada criterio debe respetar el rango y peso de la rúbrica vigente; el total debe calcularse en el servidor.
- Debe permitir guardar borrador y enviar la evaluación completa; el borrador no debe participar en el reporte.
- Debe existir una sola evaluación vigente por proyecto y jurado y evitar duplicados ante solicitudes simultáneas.

### HU030. Consultar y corregir mi evaluación

Como jurado quiero consultar y corregir mi evaluación dentro del plazo permitido para subsanar errores sin duplicar puntajes.

- El jurado debe acceder solo a las evaluaciones que tenga autorizadas.
- La corrección debe realizarse durante la ventana habilitada y antes de la publicación definitiva.
- Los criterios deben validarse nuevamente y el total debe recalcularse con la misma versión de rúbrica.
- Debe conservar autor, fecha y valores previos sin crear una segunda evaluación vigente.
- Las evaluaciones cerradas deben bloquear cambios ordinarios; una reapertura debe ser autorizada y quedar registrada.

### HU031. Consultar y publicar el reporte del hackatón

Como organizador quiero consultar y publicar el reporte del hackatón para comparar proyectos y comunicar sus resultados finales.

- Debe existir GET /api/hackatones/:id/reporte que relacione proyectos, equipos y evaluaciones mediante agregación.
- Debe utilizar evaluaciones enviadas y vigentes, calcular el puntaje agregado y ordenar según la rúbrica y los desempates.
- Debe mostrar proyecto, equipo, puntaje y evaluaciones esperadas y recibidas; los proyectos sin evaluar o incompletos deben distinguirse de un cero.
- No debe publicarse un ganador definitivo con evaluaciones obligatorias pendientes; los empates deben tratarse según la regla acordada.
- El organizador debe consultar el reporte durante evaluación; los participantes deben verlo después de publicarlo, bloqueando cambios ordinarios al cierre.

### HU032. Consultar historial de cambios relevantes

Como usuario responsable quiero consultar el historial de cambios relevantes para identificar quién modificó la información de un evento.

- Debe registrar cambios de roles, etapas, inscripciones, programación, resultados, asignaciones y evaluaciones que afecten el evento.
- Cada registro debe identificar autor, fecha, recurso, operación y motivo cuando se requiera.
- Los cambios de resultados y evaluaciones deben conservar los valores anteriores necesarios para explicar una corrección.
- La consulta debe estar limitada a administradores y organizadores autorizados y permitir filtros por evento, fecha u operación.
- El historial no debe exponer contraseñas o tokens ni permitir su modificación desde operaciones ordinarias.

## Reglas implementadas

- Inscripciones: confirmación inmediata por defecto. El evento puede exigir aprobación; pendientes y confirmadas reservan cupo. Rechazo y retiro con motivo conservan historial y liberan cupo. Reinscribir reutiliza el documento histórico, sin crear duplicados.
- Plantillas: se conservan al inscribir. No cambian mientras el evento siga activo; un equipo deportivo puede cambiar tras el cierre sin modificar la plantilla histórica.
- Programación: se comprueba escenario, recursos, capacidad, disponibilidad y cruces de integrantes incluso entre equipos y escenarios diferentes. Una reprogramación exige motivo.
- Resultados: cada competencia tiene un único resultado vigente. Ausencia, abandono y descalificación no se tratan como marca cero ganadora. Las marcas respetan la unidad, precisión y sentido de orden configurados.
- Clasificación: puntos por victoria/empate/derrota, criterios ordenados de desempate y agregación de marcas configurables. En la fase final se identifica un ganador; un empate no resuelto bloquea el cierre. Las fases posteriores se programan explícitamente con los competidores clasificados; no se generan llaves automáticas.
- Correcciones: exigen motivo y no duplican puntos. Si existen rondas posteriores activas, deben cancelarse con motivo antes de corregir la ronda que las afecta.
- Proyectos: solo equipos con inscripción confirmada. Guardar es preparar un borrador; entregar conserva la presentación versionada. Editar una entrega durante su plazo la devuelve a borrador y exige entregarla otra vez.
- Rúbrica: pesos que suman 100 %, escala por criterio, mínimo de jurados, agregación y desempates explícitos. Se bloquea desde la primera evaluación.
- Evaluación: solo jurados activos asignados, durante la etapa y ventana correspondientes. El servidor calcula el total sobre 100. Las correcciones conservan la misma rúbrica y dejan historial.
- Publicación: exige evaluaciones obligatorias completas. Un cero evaluado se distingue de una evaluación pendiente. Los empates se bloquean o comparten según la política de la rúbrica; el reporte publicado conserva una copia estable.
- Historial: autor, fecha, operación, motivo y valores relevantes; consulta restringida a administración y organizadores responsables. No expone credenciales ni tokens.

## Verificación y límites

65 pruebas de integración con MongoDB real y 4 del cliente HTTP verifican acceso, permisos, persistencia, concurrencia, correcciones y renovación. Se revisaron desde el navegador escenarios, resultado deportivo, clasificación, entrega, evaluación del jurado, reporte publicado e historial, usando datos ficticios en una base temporal.

El alcance es una aplicación académica con una instancia de API. La cola de escritura y los índices protegen las invariantes dentro de esa instancia. Un despliegue con varias instancias exige coordinación compartida/transacciones y pruebas adicionales; no se presenta esta versión como arquitectura distribuida.
