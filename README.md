# Campus: gestión de competencias

Plataforma de torneos, intercolegiados y hackatones. API REST con Node.js, Express y Mongoose sobre MongoDB; interfaz React con Vite, HTML y CSS.

## Requisitos

- Node.js 22.12 o superior y npm.
- Servidor MongoDB iniciado. La conexión local predeterminada usa el puerto 27017.

## Instalación y ejecución

En una copia nueva del repositorio, abre una terminal en la raíz e instala las dependencias:

```powershell
npm ci
```

Crea `backend/.env` a partir de `backend/.env.example`. En PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

En macOS o Linux, el comando equivalente es `cp backend/.env.example backend/.env`. Ajusta `MONGODB_URI` si el servidor MongoDB utiliza otra conexión. El archivo `.env` es local y está excluido de Git.

Inicia la API y la interfaz:

```powershell
npm run dev
```

Abre [la plataforma local](http://127.0.0.1:5173). La API usa el puerto 3001 y la base predeterminada es `torneos_universidad`. En el primer acceso se crea la cuenta de administrador desde la interfaz. Detén ambos procesos con **Ctrl+C**.

## Alcance actual

Acceso, cuentas, perfil, instituciones, disciplinas, torneos, configuración de hackatones, reglamentos, participantes, equipos, catálogo e inscripciones deportivas. Corresponde a 12 historias implementadas de la matriz vigente.

Escenarios, demás etapas, inscripción a hackatones, agenda, resultados, proyectos y evaluación están pendientes. La entrega actual se ejecuta localmente con una instancia de API; los cupos concurrentes requieren coordinación compartida si se despliega con varias instancias.

## Historias del MVP y demostración de la API

La [guía del MVP](docs/parcial-2.md) documenta diez historias de usuario, su funcionalidad, método HTTP, endpoint y resultado esperado. Incluye las instrucciones para Thunder Client y MongoDB Compass, el guion de sustentación y la ubicación de cada parte del código.

Para preparar datos ficticios y peticiones locales del ensayo:

```powershell
npm run parcial:preparar
```

Utiliza la misma API en el puerto 3002 y la base separada `campus_parcial_demo`. Mantén esa terminal abierta y consulta las instrucciones de la guía. Después de ejecutar las diez peticiones, `npm run parcial:verificar` comprueba su persistencia directamente en MongoDB.

## Dónde está cada parte

| Carpeta o archivo | Contenido |
| --- | --- |
| `backend/src` | API, modelos de la base, validaciones, permisos y conexión MongoDB. |
| `backend/tests` | Pruebas de integración con bases temporales. |
| `backend/scripts` y `backend/parcial` | Preparación de datos y peticiones de demostración de la API. |
| `frontend/src` | Pantallas, formularios, solicitudes a la API y estilos. |
| `docs` | Historias del MVP y guía pública de demostración. |
| `frontend/index.html` y `frontend/vite.config.js` | Entrada web y configuración de desarrollo. |
| `package.json` y `package-lock.json` | Comandos y versiones de las dependencias. |
| `documentacion` | Material académico local, excluido de Git. |

Para la base de datos, empieza por [los modelos](backend/src/models.js) y [los modelos de competencias](backend/src/competition-models.js). La conexión está en [server.js](backend/src/server.js).

## Comprobar

```powershell
npm test
npm run build
```

Las pruebas requieren MongoDB y crean bases temporales separadas de la aplicación. La compilación genera `frontend/dist`.

## CRUD con Mongoose

El recurso de instituciones permite demostrar los cuatro métodos solicitados en la materia. Las rutas están en `backend/src/app.js` y el modelo en `backend/src/models.js`.

| Método | Ruta | Operación con Mongoose |
| --- | --- | --- |
| GET | `/api/instituciones` | Listar con `find`, filtros y paginación. |
| GET | `/api/instituciones/:id` | Consultar con `findById`. |
| POST | `/api/instituciones` | Registrar con `create`. |
| PUT | `/api/instituciones/:id` | Actualizar todos los campos editables con `findByIdAndUpdate`. |
| DELETE | `/api/instituciones/:id` | Eliminar con `findByIdAndDelete`, si no tiene relaciones. |

`PATCH` sigue disponible para cambios parciales. Las consultas requieren una sesión; las escrituras requieren administrador y token CSRF. El formulario web de edición de instituciones utiliza `PUT`.

Desde la pantalla **Instituciones**, el administrador puede usar el lápiz para editar o la papelera para eliminar. La eliminación solicita confirmación y actualiza el directorio y sus contadores. Si hay participantes, equipos o inscripciones vinculados, se conserva la institución y se ofrece desactivarla. El campo **Ciudad/municipio** mantiene la propiedad `ciudad` en MongoDB y en la API.

Para probarlo desde un cliente de API:

1. Inicia sesión con `POST http://127.0.0.1:3001/api/auth/login`, enviando tu `correo` y `password` en JSON. El cliente debe conservar la cookie de sesión.
2. Copia `data.csrfToken` de la respuesta y envíalo en el encabezado `X-CSRF-Token` de las solicitudes POST, PUT y DELETE de instituciones.
3. Crea una institución con POST y guarda el `data.id` devuelto. Utiliza ese identificador para GET, PUT y DELETE.

Ejemplo de cuerpo para POST y PUT:

```json
{
  "nombre": "Colegio de demostración",
  "ciudad": "Bogotá",
  "departamento": "Cundinamarca",
  "tipo": "colegio",
  "estado": "activo"
}
```

PUT exige los cinco campos. DELETE no necesita cuerpo; elimina únicamente una institución sin participantes, equipos ni inscripciones relacionadas. Si tiene historial, responde 409 y permite conservarlo desactivando la institución. Estas reglas están comprobadas en las pruebas de integración, incluidas solicitudes simultáneas.

## Visual Studio Code

Abre `Campus.code-workspace` para una vista centrada en el código. Para consultar los documentos desde el explorador, abre la carpeta completa del repositorio. Las dependencias y archivos generados se ocultan mediante `.vscode/settings.json`.

## Archivos locales

El repositorio incluye el código de `backend` y `frontend`, pruebas, configuración de ejemplo, comandos e instrucciones de instalación. La carpeta `documentacion` se conserva solo en la copia local y no se necesita para ejecutar el sistema.

Las dependencias, compilaciones y el archivo privado `backend/.env` también están excluidos de Git. Quien clone el proyecto debe instalar las dependencias, crear su propio `.env` e iniciar MongoDB, siguiendo los pasos anteriores. Los datos guardados en MongoDB no forman parte del repositorio.
