# Campus: diez funcionalidades del sistema

La exposición utiliza el proyecto habitual: interfaz web, API REST con Node.js y Express y MongoDB mediante Mongoose. Cada fila delimita la acción concreta que se muestra y conserva el identificador HU del proyecto.

## Registro de las 10 funcionalidades

Ejecuta `npm run dev` en la raíz del proyecto. La configuración del repositorio usa web `http://127.0.0.1:5173`, API `http://127.0.0.1:3001/api` y base `torneos_universidad`. Si modificaste `backend/.env`, comprueba sus valores. Web, Thunder Client y Compass trabajan con los mismos registros.

| N.º | Historia de usuario | Funcionalidad | Endpoint y método HTTP | Resultado esperado |
| --- | --- | --- | --- | --- |
| 1 | **HU004.** Como usuario quiero consultar mi perfil para verificar mis datos y mi rol dentro de la plataforma. | Consultar el perfil de la cuenta que inició sesión. | `GET /api/usuarios/:id` | 200; nombre, correo, rol y estado. Los hashes no se devuelven. |
| 2 | **HU005.** Como administrador quiero eliminar una institución registrada por error y sin relaciones para mantener un directorio correcto sin perder historial. | Eliminar una institución sin participantes, equipos ni inscripciones. | `DELETE /api/instituciones/:id` | 200; el documento desaparece de MongoDB. Si tiene relaciones, 409 y se conserva. |
| 3 | **HU006.** Como administrador quiero configurar disciplinas, categorías y modalidades para organizar las distintas competencias deportivas. | Registrar voleibol con modalidad de equipo, formatos y categoría Abierta. | `POST /api/disciplinas` | 201; disciplina persistida con categoría y modalidad. |
| 4 | **HU008.** Como organizador quiero crear torneos deportivos para gestionar competencias universitarias e intercolegiadas de distintas disciplinas. | Crear un torneo con la disciplina y categoría registradas en la fila 3. | `POST /api/torneos` | 201; torneo en borrador con referencias válidas, fechas y reglamento. |
| 5 | **HU009.** Como administrador quiero crear un hackatón con fechas, categorías y límites de equipos para preparar un evento de innovación tecnológica. | Configurar un hackatón con ventanas de inscripción, entrega y evaluación. | `POST /api/hackatones` | 201; configuración del evento persistida. |
| 6 | **HU010.** Como organizador quiero actualizar el reglamento de un torneo en borrador para fijar integrantes, fases y criterios deportivos antes de abrir las inscripciones. | Modificar las fases y el avance del torneo creado en la fila 4. | `PATCH /api/torneos/:id` | 200; reglamento actualizado e incremento de su versión. |
| 7 | **HU012.** Como organizador quiero registrar participantes asociados a una cuenta y a una institución para identificar a las personas que competirán. | Registrar un participante con documento, nacimiento y referencias existentes. | `POST /api/participantes` | 201; participante persistido con cuenta e institución válidas. |
| 8 | **HU013.** Como usuario autorizado quiero registrar un equipo deportivo con su plantilla para representar a mi institución en los torneos. | Registrar un equipo con cinco participantes, incluido el creado en la fila 7. | `POST /api/equipos` | 201; equipo persistido con integrantes, disciplina y categoría. |
| 9 | **HU015.** Como participante quiero filtrar los torneos con inscripciones abiertas por disciplina para encontrar una competencia disponible. | Consultar torneos abiertos, incluyendo el creado en la fila 4. | `GET /api/torneos?estado=inscripciones&tipo=intercolegiados&disciplina=:id` | 200; listado filtrado con el torneo disponible. |
| 10 | **HU016.** Como usuario autorizado quiero inscribir un equipo en un torneo abierto para formalizar su participación y conservar la plantilla registrada. | Inscribir el equipo de la fila 8 en el torneo de la fila 4. | `POST /api/inscripciones` | 201; inscripción confirmada y copia de sus cinco integrantes. |

Para agilizar el recorrido, utiliza tu administrador: tiene permisos para gestionar eventos, equipos e inscripciones. Las historias describen necesidades de distintos roles; esta exposición no comprueba por sí sola todos sus permisos.

## Abrir el proyecto habitual

1. Inicia MongoDB, abre la carpeta en Visual Studio Code y ejecuta `npm run dev`.
2. Abre la web del puerto 5173 e inicia sesión con tu administrador.
3. En Compass conecta a `mongodb://127.0.0.1:27017` y abre **torneos_universidad**, según MONGODB_URI.
4. Guarda las peticiones en Thunder Client con la API del puerto **3001**. Sustituye `:id` por los identificadores reales.

Los comandos `parcial:preparar` y `parcial:verificar` permanecen como herramientas opcionales para ensayos separados. No se utilizan en este recorrido.

## Datos necesarios antes del cronómetro

Reutiliza los registros existentes. Si faltan, créalos desde los formularios normales:

- Una institución activa para los deportistas y otra sin relaciones para eliminar. Conserva la institución del equipo.
- Cinco cuentas activas con rol participante. Cuatro ya deben tener un registro en **Participantes**, asociado a la misma institución. La quinta cuenta estará libre para la fila 7.
- Correo y documento distintos para cada persona. `usuario` referencia la cuenta; `integrantes` referencia los documentos de participantes.

La categoría Abierta del ejemplo no restringe edad ni género. El reglamento exige entre cinco y ocho integrantes. Si eligen otra categoría o plantilla, ajusten las personas y las reglas de forma compatible.

Guarda los JSON antes del cronómetro. Durante el recorrido solo reemplaza los ids devueltos por las creaciones previas. No ejecutes antes las creaciones y la eliminación que vas a mostrar; para repetir usa nombres/documentos nuevos y otra institución eliminable.

## Sesión de Thunder Client

La web y Thunder Client tienen sesiones independientes. Antes del cronómetro ejecuta:

`POST http://127.0.0.1:3001/api/auth/login`

Body > JSON:

```json
{ "correo": "<TU_CORREO_DE_ADMINISTRADOR>", "password": "<TU_CONTRASEÑA>" }
```

Cuando responda 200:

- Conserva `data.user.id` para consultar tu perfil y como responsable de torneo, hackatón y equipo.
- En los encabezados de respuesta copia de `Set-Cookie` solo `campus_session=...`, sin los atributos posteriores al punto y coma. Ponlo en el encabezado **Cookie** de las diez peticiones.
- Copia `data.csrfToken` y añádelo como **X-CSRF-Token** en POST, PATCH, PUT y DELETE. Los cuerpos JSON llevan **Content-Type: application/json**.
- Si vuelves a iniciar sesión, usa Cookie y token de esa misma respuesta. Conserva estos valores y las credenciales en tu cliente local; no los publiques en GitHub.

## JSON y referencias de cada fila

Los textos entre `<...>` son marcadores: complétalos antes de enviar. Las fechas ISO deben incluir zona horaria, por ejemplo `2026-10-14T08:00:00-05:00`, ajustada al día real de la exposición.

**Filas 1 y 2:** sin Body. Usa tu id de cuenta en el GET y el id de la institución sin relaciones en el DELETE. Antes de eliminar, comprueba que existe en Compass.

**Fila 3:** elige un nombre no utilizado. Guarda `data.id` y `data.categorias[0].id`.

```json
{
  "nombre": "Voleibol universitario", "modalidades": ["equipo"], "formatos": ["liga", "grupos"],
  "categorias": [{ "nombre": "Abierta", "edadMin": null, "edadMax": null, "genero": "cualquiera" }],
  "estado": "activo"
}
```

**Fila 4:** usa los ids de la fila 3. Las fechas deben cumplir `inscripcionInicio <= ahora < inscripcionFin <= inicio <= fin`. Guarda el id del torneo para las filas 6 y 10.

```json
{
  "nombre": "Copa universitaria de voleibol", "descripcion": "Competencia deportiva universitaria.",
  "tipo": "intercolegiados", "disciplina": "<ID_DISCIPLINA_FILA_3>", "categoria": "<ID_CATEGORIA_FILA_3>",
  "unidadInscripcion": "equipo", "formato": "grupos", "ciudad": "Barranquilla", "departamento": "Atlántico",
  "inscripcionInicio": "<FECHA_ISO_ANTERIOR_A_AHORA>", "inscripcionFin": "<FECHA_ISO_POSTERIOR_A_AHORA>",
  "inicio": "<FECHA_ISO_DESPUES_DEL_CIERRE>", "fin": "<FECHA_ISO_DESPUES_DEL_INICIO>",
  "cupos": 8, "responsable": "<ID_ADMINISTRADOR>",
  "reglamento": {
    "integrantesMin": 5, "integrantesMax": 8, "maxInscripciones": 1,
    "metrica": "sets", "unidad": "sets", "precision": 0, "orden": "descendente",
    "fases": ["Clasificación", "Final"], "avance": "Los dos mejores equipos avanzan a la final.",
    "desempates": ["Sets a favor", "Puntos a favor"], "pruebas": [],
    "requisitos": "Cuenta e institución activas.", "permiteMultiplesEquipos": false
  }
}
```

**Fila 5:** las ventanas deben cumplir `inscripcionInicio <= inscripcionFin <= inicio <= entregaInicio <= entregaFin <= evaluacionInicio <= evaluacionFin <= fin`.

```json
{
  "nombre": "Hackatón universitario", "descripcion": "Soluciones para la comunidad universitaria.",
  "ciudad": "Barranquilla", "departamento": "Atlántico", "modalidad": "presencial",
  "inscripcionInicio": "<FECHA_ISO_APERTURA>", "inscripcionFin": "<FECHA_ISO_CIERRE>",
  "inicio": "<FECHA_ISO_INICIO>", "entregaInicio": "<FECHA_ISO_ENTREGA_INICIO>",
  "entregaFin": "<FECHA_ISO_ENTREGA_FIN>", "evaluacionInicio": "<FECHA_ISO_EVALUACION_INICIO>",
  "evaluacionFin": "<FECHA_ISO_EVALUACION_FIN>", "fin": "<FECHA_ISO_FIN>",
  "cupos": 12, "integrantesMin": 2, "integrantesMax": 4, "proyectosPorEquipo": 1,
  "categorias": ["Educación", "Ambiente"], "requisitos": "Proyecto original del equipo.",
  "responsable": "<ID_ADMINISTRADOR>"
}
```

**Fila 6:** envía el reglamento completo al mismo torneo de la fila 4, todavía en borrador.

```json
{
  "reglamento": {
    "integrantesMin": 5, "integrantesMax": 8, "maxInscripciones": 1,
    "metrica": "sets", "unidad": "sets", "precision": 0, "orden": "descendente",
    "fases": ["Fase de grupos", "Semifinal", "Final"],
    "avance": "Los cuatro mejores equipos avanzan a semifinales.",
    "desempates": ["Sets a favor", "Puntos a favor"], "pruebas": [],
    "requisitos": "Cuenta e institución activas.", "permiteMultiplesEquipos": false
  }
}
```

**A continuación abre las inscripciones del mismo torneo.** Es un paso de apoyo y no una undécima historia. La ruta existente es `PATCH /api/torneos/:id/estado`, con respuesta 200:

```json
{ "estado": "inscripciones" }
```

En la web corresponde al botón **Abrir inscripciones**. Durante el recorrido utiliza Thunder Client y comprueba el estado en Compass. Edita el reglamento antes de abrir; después queda protegido.

**Fila 7:** usa la quinta cuenta sin participante asociado y la institución activa. Ajusta nombre, documento y nacimiento; guarda `data.id`.

```json
{
  "documento": "DEP-005", "nombre": "Deportista cinco", "nacimiento": "2005-06-01",
  "genero": "femenino", "usuario": "<ID_QUINTA_CUENTA_PARTICIPANTE>",
  "institucion": "<ID_INSTITUCION_ACTIVA>", "categoria": "Abierta", "estado": "activo"
}
```

**Fila 8:** usa los ids de cuatro participantes existentes y el de la fila 7; no los ids de sus cuentas. Guarda el id del equipo.

```json
{
  "nombre": "Equipo universitario de voleibol", "tipo": "deportivo", "responsable": "<ID_ADMINISTRADOR>",
  "estado": "activo", "institucion": "<ID_INSTITUCION_ACTIVA>",
  "disciplina": "<ID_DISCIPLINA_FILA_3>", "categoria": "<ID_CATEGORIA_FILA_3>", "modalidad": "equipo",
  "integrantes": ["<ID_PARTICIPANTE_1>", "<ID_PARTICIPANTE_2>", "<ID_PARTICIPANTE_3>", "<ID_PARTICIPANTE_4>", "<ID_PARTICIPANTE_FILA_7>"]
}
```

**Fila 9:** sin Body. Usa la disciplina de la fila 3 en `GET /api/torneos?estado=inscripciones&tipo=intercolegiados&disciplina=:id`. Debe aparecer el torneo creado en la fila 4 y abierto después de la fila 6.

**Fila 10:** utiliza ese mismo torneo y el equipo de la fila 8.

```json
{ "torneo": "<ID_TORNEO_FILA_4>", "modalidad": "equipo", "competidor": "<ID_EQUIPO_FILA_8>", "prueba": "" }
```

## Web y Compass: dónde comprobar cada acción

La web sirve para presentar el proyecto y comprobar los mismos registros al actualizar sus listas. Durante el tiempo de las diez historias ejecuta cada operación en Thunder Client; no vuelvas a crearla en la web.

| Fila | Pantalla web | Colección de Compass | Qué comprobar |
| --- | --- | --- | --- |
| 1 | Mi perfil | usuarios | La respuesta corresponde a la cuenta autenticada. |
| 2 | Instituciones | instituciones | Antes existe; después del DELETE su _id no encuentra documentos. |
| 3 | Disciplinas | disciplinas | Modalidades, formatos y categorias del nuevo documento. |
| 4 | Torneos | torneos | Disciplina, responsable, fechas y estado borrador. |
| 5 | Hackatones | hackatones | Ventanas de entrega y evaluación. |
| 6 | Torneos > Editar | torneos | Nuevas fases y reglamentoVersion; después de abrir, estado inscripciones. |
| 7 | Participantes | participantes | ObjectId de usuario e institucion. |
| 8 | Equipos | equipos | Cinco ids de integrantes. |
| 9 | Torneos > filtros | torneos | Respuesta filtrada que incluye el torneo de la fila 4; no escribe datos. |
| 10 | Inscripciones | inscripciones | Referencias a ese torneo/equipo y cinco integrantes en plantilla. |

Filtros: `{ nombre: "NOMBRE_EXACTO" }` para creaciones o `{ _id: ObjectId("ID") }` para un documento. Guarda las consultas con tus nombres y vuelve a ejecutarlas después de Send. Para la inscripción puedes filtrar por `torneo` y `competidor`. Compass comprueba lo que guardó la API; no insertes ni modifiques allí los documentos durante la demostración.

## Guion de cinco minutos

| Tiempo | Presentador | Acción |
| --- | --- | --- |
| 0:00-0:15 | Integrante 1 | Presentar la web y el stack; pasar a Thunder Client. |
| 0:15-0:33 | Integrante 1 | 1. Perfil. |
| 0:33-0:55 | Integrante 1 | 2. Eliminar institución y comprobar ausencia. |
| 0:55-1:21 | Integrante 1 | 3. Disciplina; conservar sus ids. |
| 1:21-1:51 | Integrante 1 | 4. Torneo; conservar su id. |
| 1:51-2:19 | Integrante 1 | 5. Hackatón. |
| 2:19-2:24 | Ambos | Cambio de presentador. |
| 2:24-2:58 | Integrante 2 | 6. Reglamento y apertura de inscripciones del mismo torneo. |
| 2:58-3:22 | Integrante 2 | 7. Participante; conservar su id. |
| 3:22-3:46 | Integrante 2 | 8. Equipo; conservar su id. |
| 3:46-4:04 | Integrante 2 | 9. Consultar el torneo abierto. |
| 4:04-4:30 | Integrante 2 | 10. Inscribir ese equipo en ese torneo. |
| 4:30-4:40 | Integrante 2 | Cierre: persistencia, referencias y validación. |
| 4:40-5:00 | Ambos | Margen para cambios de pantalla. |

En cada fila: di la historia completa, señala método y URL, muestra Body si existe, pulsa Send, indica estado HTTP y respuesta y comprueba la persistencia cuando haya una escritura. Practiquen también la copia de ids y la apertura con cronómetro: el tiempo es un objetivo, no una garantía. La consulta no necesita demostrar una nueva escritura. Eviten recorrer todas las pantallas web durante las diez peticiones.

## Dónde está el código

| Parte | Archivo | Qué explicar |
| --- | --- | --- |
| Conexión | [server.js](../backend/src/server.js), [config.js](../backend/src/config.js) | mongoose.connect, MONGODB_URI y arranque de Express. |
| Cuentas e instituciones | [models.js](../backend/src/models.js) | Schema, modelos, colecciones, tipos e índices. |
| Competencias | [competition-models.js](../backend/src/competition-models.js) | Modelos de disciplinas, eventos, participantes, equipos e inscripciones. |
| Instituciones y errores | [app.js](../backend/src/app.js) | GET, POST, PUT, PATCH, DELETE y middleware de errores. |
| Perfil y usuarios | [users.js](../backend/src/users.js) | Consulta de perfil y gestión de cuentas. |
| Rutas deportivas | [competition-routes.js](../backend/src/competition-routes.js) | Consultas, creaciones, modificaciones, apertura e inscripción. |
| Reglas | [competition-service.js](../backend/src/competition-service.js) | Referencias, ventanas, elegibilidad, cupos, duplicados y plantilla. |
| Seguridad | [security.js](../backend/src/security.js) | Sesiones de MongoDB, hash, permisos y CSRF. |
| Web | [App.jsx](../frontend/src/App.jsx), [Competitions.jsx](../frontend/src/Competitions.jsx), [Accounts.jsx](../frontend/src/Accounts.jsx) | Formularios que llaman a la misma API. |

## PUT y errores, si el profesor pregunta

PUT ya existe: `PUT /api/instituciones/:id` requiere los cinco campos siguientes. Usa una institución que conserves y comprueba la ubicación actualizada en Compass. Es una comprobación adicional, no una historia extra.

```json
{
  "nombre": "<NOMBRE_INSTITUCION>", "ciudad": "<CIUDAD_O_MUNICIPIO>",
  "departamento": "<DEPARTAMENTO>", "tipo": "colegio", "estado": "activo"
}
```

La API devuelve JSON: 200 para consulta/actualización correcta, 201 para creación, 400 para datos inválidos, 401/403 para acceso, 404 para recurso inexistente y 409 para conflicto. Consultar la institución eliminada devuelve 404; repetir la inscripción devuelve 409.

Mongoose modela y valida documentos; MongoDB los guarda. ObjectId identifica las referencias y la API verifica su existencia y compatibilidad. La inscripción conserva una copia de la plantilla. Las fases son configuración: aún no se calculan resultados; las entregas y la evaluación de hackatones siguen pendientes.
