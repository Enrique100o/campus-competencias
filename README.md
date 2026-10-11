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

## Dónde está cada parte

| Carpeta o archivo | Contenido |
| --- | --- |
| `backend/src` | API, modelos de la base, validaciones, permisos y conexión MongoDB. |
| `backend/tests` | Pruebas de integración con bases temporales. |
| `frontend/src` | Pantallas, formularios, solicitudes a la API y estilos. |
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

## Visual Studio Code

Abre `Campus.code-workspace` para una vista centrada en el código. Para consultar los documentos desde el explorador, abre la carpeta completa del repositorio. Las dependencias y archivos generados se ocultan mediante `.vscode/settings.json`.

## Archivos locales

El repositorio incluye el código de `backend` y `frontend`, pruebas, configuración de ejemplo, comandos e instrucciones de instalación. La carpeta `documentacion` se conserva solo en la copia local y no se necesita para ejecutar el sistema.

Las dependencias, compilaciones y el archivo privado `backend/.env` también están excluidos de Git. Quien clone el proyecto debe instalar las dependencias, crear su propio `.env` e iniciar MongoDB, siguiendo los pasos anteriores. Los datos guardados en MongoDB no forman parte del repositorio.
