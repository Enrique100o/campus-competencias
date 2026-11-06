# Campus: gestión de competencias

Plataforma para torneos universitarios, intercolegiados multideportivos y hackatones. React con Vite, API REST con Node.js y Express, y MongoDB mediante Mongoose.

**Estado: entrega académica finalizada — 6 de noviembre de 2026.** Alcance de 32 historias de usuario implementadas, con interfaz web, API REST y persistencia en MongoDB. Verificación: 69 pruebas automatizadas y compilación de la interfaz aprobadas.

La entrega está preparada para ejecución local con una instancia de API. El despliegue público y la coordinación entre varias instancias corresponden a una etapa posterior.

## Historias de usuario

Las siguientes funcionalidades corresponden a las **32 historias del alcance acordado**:

| ID | Funcionalidad |
| --- | --- |
| HU001 | Iniciar y cerrar sesión |
| HU002 | Controlar acceso por rol y recurso |
| HU003 | Registrar y administrar usuarios |
| HU004 | Consultar y actualizar mi perfil |
| HU005 | Gestionar instituciones educativas |
| HU006 | Gestionar disciplinas, categorías y modalidades |
| HU007 | Gestionar escenarios e instalaciones |
| HU008 | Crear torneos deportivos |
| HU009 | Crear hackatones |
| HU010 | Definir el reglamento deportivo |
| HU011 | Gestionar etapas y fechas de eventos |
| HU012 | Registrar y gestionar participantes |
| HU013 | Registrar equipos deportivos y tecnológicos |
| HU014 | Gestionar integrantes de equipos |
| HU015 | Consultar eventos y requisitos |
| HU016 | Inscribir competidores en torneos |
| HU017 | Inscribir equipos en hackatones |
| HU018 | Revisar y gestionar inscripciones |
| HU019 | Programar competencias deportivas |
| HU020 | Consultar la agenda deportiva |
| HU021 | Registrar resultados deportivos |
| HU022 | Consultar clasificaciones y avance |
| HU023 | Corregir resultados deportivos |
| HU024 | Cerrar torneos y publicar resultados |
| HU025 | Registrar y actualizar proyectos |
| HU026 | Entregar el proyecto para evaluación |
| HU027 | Configurar la rúbrica de evaluación |
| HU028 | Asignar jurados a proyectos |
| HU029 | Registrar evaluaciones de proyectos |
| HU030 | Consultar y corregir mi evaluación |
| HU031 | Consultar y publicar el reporte del hackatón |
| HU032 | Consultar historial de cambios relevantes |

Consulta los [criterios, endpoints y pantallas de las 32 historias](docs/historias-usuario.md) y la [organización y arquitectura](docs/arquitectura.md).

## Instalación y ejecución

Requisitos: Node.js 22.12 o superior, npm y MongoDB iniciado. En un clon nuevo:

```powershell
npm ci
Copy-Item backend/.env.example backend/.env
npm run dev
```

En macOS/Linux usa `cp backend/.env.example backend/.env`. Ajusta `MONGODB_URI` cuando corresponda. En el primer acceso crea el administrador desde la web.

- Web: http://127.0.0.1:5173
- API: http://127.0.0.1:3001/api
- Base local: `torneos_universidad`

Las ventanas de inscripción, entrega y evaluación se configuran por evento. Para pasar de etapa también se deben cumplir sus fechas y requisitos.

## Organización

- `frontend/src/features`: pantallas y formularios por funcionalidad.
- `frontend/src/components/ui`: campos, diálogos y componentes compartidos.
- `backend/src/modules`: servicios, permisos y rutas por área de negocio.
- `backend/src/app.js`: composición de la API.
- `backend/tests` y `frontend/tests`: pruebas con datos ficticios.

## Verificación

```powershell
npm test
npm run build
```

Las pruebas de API utilizan bases temporales aisladas. `npm run format` mantiene un formato de código uniforme. En producción configura `JWT_SECRET` con al menos 32 caracteres aleatorios y utiliza HTTPS.
