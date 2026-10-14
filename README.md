# Campus: gestión de competencias

Plataforma para gestionar torneos universitarios, intercolegiados y hackatones. Desarrollada con Node.js, Express, MongoDB y Mongoose; interfaz web con React y Vite.

## Historias de usuario del MVP

| ID | Historia de usuario |
| --- | --- |
| HU001 | Como usuario quiero iniciar y cerrar sesión para acceder a las funciones que me corresponden en la plataforma. |
| HU003 | Como administrador quiero registrar y administrar usuarios para habilitar las cuentas que utilizarán la plataforma. |
| HU004 | Como usuario quiero consultar y actualizar los datos permitidos de mi perfil para mantener mi información correcta. |
| HU005 | Como administrador quiero gestionar instituciones educativas para asociarlas a los participantes y equipos de los eventos. |
| HU006 | Como administrador quiero configurar disciplinas, categorías y modalidades para organizar las distintas competencias deportivas. |
| HU008 | Como organizador quiero crear torneos deportivos para gestionar competencias universitarias e intercolegiadas de distintas disciplinas. |
| HU009 | Como administrador quiero crear hackatones con fechas, categorías y límites de equipos para organizar eventos de innovación tecnológica. |
| HU010 | Como organizador quiero definir el reglamento de mi torneo para aplicar elegibilidad, puntuación, fases y desempates según la disciplina. |
| HU012 | Como organizador quiero registrar y gestionar participantes para identificar a las personas que competirán en los eventos. |
| HU013 | Como usuario autorizado quiero registrar un equipo para utilizarlo en competencias deportivas o hackatones. |
| HU015 | Como participante quiero consultar torneos y hackatones disponibles para conocer sus requisitos y decidir dónde participar. |
| HU016 | Como usuario autorizado quiero inscribir un equipo, participante o relevo en un torneo para formalizar su participación deportiva. |

La inscripción a hackatones, la agenda, los resultados, las entregas de proyectos y la evaluación corresponden a etapas posteriores del desarrollo.

## Instalación y ejecución

Requisitos: Node.js 22.12 o superior, npm y un servidor MongoDB iniciado.

En una copia nueva del repositorio, ejecuta desde la carpeta del proyecto:

```powershell
npm ci
Copy-Item backend/.env.example backend/.env
npm run dev
```

En macOS o Linux, utiliza `cp backend/.env.example backend/.env` para crear el archivo de configuración. Ajusta `MONGODB_URI` en `backend/.env` si tu conexión es diferente.

- Interfaz web: `http://127.0.0.1:5173`.
- API REST: `http://127.0.0.1:3001/api`.
- Base de datos local predeterminada: `torneos_universidad`.

En el primer acceso, crea la cuenta de administrador desde la interfaz. Para detener el sistema, pulsa **Ctrl+C** en la terminal.

## Organización

- `backend/src`: API REST, modelos de Mongoose, validaciones y conexión a MongoDB.
- `frontend/src`: pantallas, formularios y estilos de la interfaz.
- `backend/tests`: pruebas de integración.

Para ejecutar las pruebas utiliza `npm test`; para compilar la interfaz, `npm run build`.
