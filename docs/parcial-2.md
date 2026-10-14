# MVP: historias y demostración de la API

Campus gestiona competencias intercolegiadas, torneos universitarios y hackatones. Esta guía relaciona diez necesidades del proyecto con operaciones de la API REST en Node.js, Express y MongoDB mediante Mongoose.

Los identificadores HU conservan la numeración de la matriz del proyecto. Los enunciados siguientes delimitan la funcionalidad concreta que se demostrará; no representan la totalidad del desarrollo previsto en esa matriz.

## Registro de las 10 funcionalidades

La URL principal de desarrollo es `http://127.0.0.1:3001/api`. El ensayo preparado con el comando de esta guía utiliza la misma aplicación en `http://127.0.0.1:3002/api` y una base de datos separada.

| N.º | Historia de usuario | Funcionalidad | Endpoint y método HTTP | Resultado esperado |
| --- | --- | --- | --- | --- |
| 1 | **HU004.** Como usuario quiero consultar mi perfil para verificar mis datos y mi rol dentro de la plataforma. | Consultar el perfil del participante autenticado. | `GET /api/usuarios/:id` | 200; nombre, correo, rol y estado. Los hashes no se devuelven. |
| 2 | **HU005.** Como administrador quiero eliminar una institución registrada por error y sin relaciones para mantener un directorio correcto sin perder historial. | Eliminar una institución sin participantes, equipos ni inscripciones. | `DELETE /api/instituciones/:id` | 200; el documento desaparece de MongoDB. Si tiene relaciones, 409 y se conserva. |
| 3 | **HU006.** Como administrador quiero configurar disciplinas, categorías y modalidades para organizar las distintas competencias deportivas. | Registrar voleibol con formatos de competencia y una categoría. | `POST /api/disciplinas` | 201; disciplina persistida con categoría, edades, género y modalidad. |
| 4 | **HU008.** Como organizador quiero crear torneos deportivos para gestionar competencias universitarias e intercolegiadas de distintas disciplinas. | Crear un torneo de fútbol 5 con fechas, cupos, responsable y reglamento. | `POST /api/torneos` | 201; torneo en borrador y referencias válidas. |
| 5 | **HU009.** Como administrador quiero crear un hackatón con fechas, categorías y límites de equipos para preparar un evento de innovación tecnológica. | Configurar un hackatón con ventanas de inscripción, entrega y evaluación. | `POST /api/hackatones` | 201; configuración del evento persistida. |
| 6 | **HU010.** Como organizador quiero actualizar el reglamento de un torneo en borrador para fijar integrantes, fases y criterios deportivos antes de abrir las inscripciones. | Modificar las fases y el avance del reglamento de un borrador asignado. | `PATCH /api/torneos/:id` | 200; reglamento actualizado e incremento de su versión. |
| 7 | **HU012.** Como organizador quiero registrar participantes asociados a una cuenta y a una institución para identificar a las personas que competirán. | Registrar una participante con documento, nacimiento y referencias. | `POST /api/participantes` | 201; documento y cuenta únicos, con institución existente. |
| 8 | **HU013.** Como participante responsable quiero registrar un equipo deportivo con su plantilla para representar a mi institución en los torneos. | Crear un equipo con cinco integrantes, institución, disciplina y categoría. | `POST /api/equipos` | 201; equipo y referencias de sus integrantes persistidos. |
| 9 | **HU015.** Como participante quiero filtrar los torneos con inscripciones abiertas por disciplina para encontrar una competencia disponible. | Buscar eventos deportivos abiertos de una disciplina. | `GET /api/torneos?estado=inscripciones&tipo=intercolegiados&disciplina=:id` | 200; listado filtrado con cupos, requisitos y estado. |
| 10 | **HU016.** Como participante responsable quiero inscribir mi equipo en un torneo abierto para formalizar su participación y conservar la plantilla registrada. | Confirmar la inscripción de un equipo que cumple las reglas. | `POST /api/inscripciones` | 201; inscripción con torneo, competidor y copia de los cinco integrantes. |

La sesión de acceso y los recursos relacionados se preparan antes. La selección incluye consultas, configuración, relaciones, actualización, eliminación e inscripción; la comprobación de errores se presenta como apoyo y no aumenta el conteo de diez funcionalidades.

## Preparar el ensayo local

Requisitos: dependencias instaladas con `npm ci` y servidor MongoDB local iniciado en el puerto 27017.

En la raíz del proyecto:

```powershell
npm.cmd run parcial:preparar
```

Mantén esa terminal abierta. El comando inicia la misma API en el puerto **3002**, crea datos ficticios en **campus_parcial_demo** y prepara sesiones de administrador, organizador y participante. La aplicación habitual continúa usando su configuración de `backend/.env` y su propia base.

Se generan estos archivos locales, excluidos de Git:

| Archivo | Uso |
| --- | --- |
| `tmp/parcial-2/solicitudes.md` | Método, URL, encabezados, JSON, historia y filtro de Compass para cada petición. |
| `tmp/parcial-2/Campus_Parcial_2.import.json` | Colección en formato Postman 2.1, compatible con la importación de Thunder Client. |
| `tmp/parcial-2/contexto.json` | Identificadores y sesiones ficticias de ese ensayo. |

Las sesiones vencen según `SESSION_HOURS` (8 horas en la configuración de ejemplo). Prepara un conjunto nuevo cerca de la exposición. Cada ejecución genera recursos nuevos; no borra ni reinicia una base existente. Para repetir, detén el comando anterior con **Ctrl+C**, ejecútalo de nuevo y actualiza las peticiones con el nuevo archivo.

Los torneos y equipos creados en los pasos 4 y 8 son ejemplos nuevos. El paso 10 utiliza un torneo ya abierto y un equipo base preparado con cinco integrantes. Esa preparación permite demostrar cada necesidad sin copiar identificadores entre respuestas ni depender de funciones de pago del cliente de API.

Los campos `reglamento.fases` y `avance` representan configuración; esta versión todavía no calcula clasificaciones o resultados. El hackatón se crea y configura; las entregas de proyectos y la evaluación por jurados corresponden a funcionalidades posteriores.

## Configurar Thunder Client antes de la exposición

Thunder Client permite crear las peticiones manualmente. La documentación actual indica que la [importación de colecciones](https://docs.thunderclient.com/features/import) es una función de pago, así que hay dos formas de prepararlas:

- Si la importación está disponible: **Collections > menú > Import**, y selecciona `Campus_Parcial_2.import.json`. Abre las diez peticiones de la carpeta de demostración.
- Para la preparación manual: abre `solicitudes.md`, crea cada **New Request**, selecciona el método y copia su URL. En **Headers**, agrega cada encabezado en una fila de clave y valor. Si hay cuerpo, selecciona **Body > JSON** y pega el bloque correspondiente. Guarda la petición con su número y HU antes de iniciar el cronómetro.

El encabezado `Cookie` identifica una sesión real almacenada en MongoDB. `X-CSRF-Token` protege las escrituras. Ambos se generaron mediante el inicio de sesión de las cuentas ficticias y ya están incluidos en las peticiones. Thunder Client admite el [encabezado Cookie](https://docs.thunderclient.com/features/cookies). Cada petición lleva la sesión del rol que realiza la acción.

En la exposición muestra el método, la URL, el JSON cuando corresponda y el estado de la respuesta. Ejecuta cada petición con **Send**. Mostrar una respuesta guardada o solo ejecutar el ensayo de terminal no sustituye la demostración en Thunder Client.

## Ver la persistencia en MongoDB Compass

Conecta Compass a:

```text
mongodb://127.0.0.1:27017
```

Abre **campus_parcial_demo**, entra en las colecciones de la tabla y deja sus filtros preparados. `solicitudes.md` contiene los valores e identificadores de ese ensayo. Los [filtros de Compass](https://www.mongodb.com/docs/compass/query/filter/) aceptan `ObjectId("identificador")`.

| Paso | Colección | Comprobación después de Send |
| --- | --- | --- |
| 2 | `instituciones` | Busca el `_id` preparado antes de eliminar. Tras DELETE, repite la consulta y muestra cero documentos. |
| 3 | `disciplinas` | Filtra por el nombre exacto y muestra `modalidades`, `formatos` y `categorias`. |
| 4 | `torneos` | Filtra por el nombre del torneo nuevo; muestra `disciplina`, fechas y `estado: borrador`. |
| 5 | `hackatones` | Filtra por el nombre nuevo; muestra las ventanas de entrega/evaluación y el responsable. |
| 6 | `torneos` | Filtra por el `_id` del borrador de reglas; muestra las nuevas fases y `reglamentoVersion`. |
| 7 | `participantes` | Filtra por el nombre nuevo; muestra `usuario`, `institucion` y `nacimiento`. |
| 8 | `equipos` | Filtra por el nombre nuevo; muestra los cinco ObjectId de `integrantes`. |
| 10 | `inscripciones` | Filtra por `torneo` y `competidor`; muestra `confirmada` y los cinco integrantes de `plantilla`. |

Abre las consultas antes del cronómetro. Para cada escritura, vuelve a ejecutarlas tras recibir la respuesta. No insertes los documentos de la demostración directamente en Compass: la operación debe hacerse por la API.

Como comprobación adicional, después de ejecutar las diez peticiones puedes abrir otra terminal y usar:

```powershell
npm.cmd run parcial:verificar
```

Consulta MongoDB directamente mediante los modelos de Mongoose y valida los registros del ensayo. Para comprobar una sola petición:

```powershell
npm.cmd run parcial:verificar -- 6
```

Para un ensayo técnico automatizado de las diez peticiones y los casos de reserva:

```powershell
npm.cmd run parcial:preparar -- --ensayar
```

Ese comando ejecuta las operaciones, comprueba MongoDB y termina. Genera un conjunto nuevo con `parcial:preparar` antes de hacer una demostración manual; DELETE ya habrá eliminado su registro de prueba y la inscripción ya estará confirmada en el ensayo automatizado.

## Guion de 4 minutos y 30 segundos

Distribución para dos integrantes. Si el grupo tiene más integrantes, reparte las diez peticiones entre todos.

| Tiempo | Presentador | Acción |
| --- | --- | --- |
| 0:00-0:15 | Integrante 1 | Presentar Campus: torneos intercolegiados, competencias universitarias y hackatones; Node.js, Express, Mongoose y MongoDB. |
| 0:15-0:33 | Integrante 1 | 1. Perfil. |
| 0:33-0:55 | Integrante 1 | 2. Eliminar institución sin vínculos; verificar ausencia en Compass. |
| 0:55-1:21 | Integrante 1 | 3. Disciplina con categoría; verificar el documento. |
| 1:21-1:51 | Integrante 1 | 4. Crear torneo; mostrar relaciones y fechas en MongoDB. |
| 1:51-2:19 | Integrante 1 | 5. Crear hackatón; verificar sus ventanas y límites. |
| 2:19-2:24 | Ambos | Cambio de presentador. |
| 2:24-2:48 | Integrante 2 | 6. Reglamento del borrador; verificar versión y fases. |
| 2:48-3:12 | Integrante 2 | 7. Participante; mostrar las dos referencias. |
| 3:12-3:36 | Integrante 2 | 8. Equipo; mostrar su plantilla. |
| 3:36-3:54 | Integrante 2 | 9. Catálogo filtrado de torneos abiertos. |
| 3:54-4:20 | Integrante 2 | 10. Inscripción; mostrar la plantilla conservada en MongoDB. |
| 4:20-4:30 | Integrante 2 | Cerrar indicando que las operaciones persisten en MongoDB y que la API valida permisos y reglas del dominio. |

Quedan 30 segundos de margen hasta los cinco minutos. El tiempo es un objetivo de ensayo oral, no una duración garantizada por las pruebas técnicas.

En cada paso, sigue esta secuencia: **enuncia la historia completa de la tabla > indica método y endpoint > Send > muestra estado y respuesta > muestra la consulta de MongoDB si hubo una escritura**. Practica con cronómetro y ambas aplicaciones abiertas. La interfaz web sirve de contexto del proyecto; la demostración evaluada se hace en el cliente de API.

## Dónde está cada parte del código

| Parte | Archivo | Qué explicar |
| --- | --- | --- |
| Arranque y conexión | [server.js](../backend/src/server.js) | `mongoose.connect`, inicialización de modelos y `listen` de Express. |
| Variables de entorno | [config.js](../backend/src/config.js) y [.env.example](../backend/.env.example) | Lectura de `MONGODB_URI` y configuración local; el `.env` privado está excluido de Git. |
| Modelos de cuentas e instituciones | [models.js](../backend/src/models.js) | `Schema`, `mongoose.model`, colección, campos, índices y timestamps. |
| Modelos deportivos y tecnológicos | [competition-models.js](../backend/src/competition-models.js) | ObjectId, referencias, categorías/reglamento embebidos, integrantes y plantilla de inscripción. |
| CRUD de instituciones y errores generales | [app.js](../backend/src/app.js) | GET con `find`/`findById`, POST con `create`, PUT con `findByIdAndUpdate`, DELETE con `findByIdAndDelete`, y middleware de errores. |
| Perfil y usuarios | [users.js](../backend/src/users.js) | Consulta de perfil, permisos del titular y administración de cuentas. |
| Rutas de competencias | [competition-routes.js](../backend/src/competition-routes.js) | El bucle de recursos genera rutas para disciplinas, torneos, hackatones, participantes y equipos; inscripciones tiene sus propias rutas. |
| Reglas del dominio | [competition-service.js](../backend/src/competition-service.js) | Referencias activas, fechas, categorías, plantilla, cupos, duplicados y autorización. |
| Sesiones y protección | [security.js](../backend/src/security.js) | Hash de contraseñas, sesiones en MongoDB, roles y CSRF. |
| Validación de entradas | [validation.js](../backend/src/validation.js) | Campos permitidos, formatos, longitudes y errores controlados. |
| Pruebas de integración | [api.test.js](../backend/tests/api.test.js) y [competition.test.js](../backend/tests/competition.test.js) | Persistencia, permisos, entradas inválidas, duplicados, concurrencia y CRUD. |
| Preparación del parcial | [parcial.js](../backend/scripts/parcial.js) y [solicitudes.js](../backend/parcial/solicitudes.js) | Herramientas de ensayo que utilizan la misma API y los modelos del proyecto. |

## Respuestas para preguntas de sustentación

- **¿Dónde se crean la base y las colecciones?** El servidor se conecta con `mongoose.connect`. Los modelos indican el nombre de cada colección. Su inicialización crea colecciones/índices cuando corresponde; `Model.create` o `save` escriben documentos en MongoDB.
- **¿Qué aporta Mongoose?** Modela documentos con esquemas y tipos, ofrece consultas y escrituras, aplica validaciones y permite trabajar con referencias. Las reglas adicionales del torneo se comprueban en el servicio.
- **¿Cómo se relacionan los datos?** Un participante referencia usuario e institución; un torneo referencia disciplina y responsable; un equipo tiene ObjectId de integrantes; una inscripción referencia torneo y competidor. `ref` no equivale a una clave foránea automática: la API comprueba existencia, estado y compatibilidad.
- **¿Por qué hay objetos y arreglos dentro de documentos?** Categorías y reglamentos pertenecen a su disciplina o torneo. La inscripción conserva una copia de su plantilla para mantener el historial aunque después cambie el equipo.
- **¿Cómo evitan duplicados?** Índices únicos y validaciones: correo, documento del participante, claves normalizadas e inscripción por torneo/modalidad/competidor/prueba. Los conflictos se devuelven con 409.
- **¿Qué pasa con una petición incorrecta?** Se valida y responde con un JSON de error; 400 para entrada inválida, 401/403 para acceso, 404 si no existe, 409 para conflicto. Un error inesperado se maneja con 500 sin divulgar detalles internos. La petición R05 permite comprobar que la API sigue activa después de los ejemplos inválidos.
- **¿Dónde están PUT y DELETE?** En instituciones. R01 demuestra PUT con los cinco campos; la petición 2 demuestra DELETE y R02 confirma el 404 posterior. Cada recurso tiene sus operaciones propias; esta versión no ofrece DELETE para todas las entidades.
- **¿Los datos son archivos o arreglos locales?** Los datos del dominio y las sesiones se guardan en MongoDB. Los archivos del ensayo contienen peticiones, sesiones ficticias e identificadores de apoyo; las comprobaciones consultan MongoDB. La cola del servidor ordena escrituras, pero no sustituye la base de datos.
- **¿Necesitan Atlas, transacciones o replicación para este alcance?** La demostración utiliza MongoDB local y una instancia de API. Esas ampliaciones no forman parte del alcance de esta entrega. Un despliegue con varias instancias necesitaría coordinación compartida para invariantes como cupos.

## Casos de reserva

Después de los diez pasos, o si el evaluador pregunta, están preparados: PUT de institución (200), consulta de la eliminada (404), datos inválidos (400), inscripción repetida (409), estado de la API (200), protección de una institución con relaciones (409), inicio de sesión (200), identificador inválido (400) y perfil ajeno (403).

Al repetir una petición POST ya exitosa puede aparecer 409 por duplicado; no significa que la primera operación haya fallado. Para repetir el ensayo completo, prepara un conjunto nuevo.

## Comprobaciones antes de presentar

- Subir esta guía y las herramientas junto con el código al repositorio público.
- Confirmar que la copia utilizada para presentar tiene esos cambios y las dependencias instaladas.
- Preparar datos y sesiones cerca de la exposición, guardar las diez peticiones en Thunder Client y preparar los filtros de Compass.
- Ensayar las diez ejecuciones con historias, respuestas y comprobaciones de persistencia dentro del tiempo asignado.
- Repartir la intervención entre todos los integrantes y realizar la entrega del enlace por el medio y plazo indicados por el docente.
