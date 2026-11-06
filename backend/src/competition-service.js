// Fachada de compatibilidad: los servicios se organizan por responsabilidad en modules/.
export * from "./modules/shared/access.js";
export { disciplineInput } from "./modules/catalogs/disciplines.js";
export {
  eventDates,
  tournamentInput,
  hackathonInput,
} from "./modules/events/input.js";
export { participantInput } from "./modules/participants/input.js";
export { teamInput } from "./modules/teams/input.js";
export { registerCompetitor } from "./modules/registrations/sports.js";
