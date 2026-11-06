const types = {
  colegio: "Colegio",
  universidad: "Universidad",
  instituto: "Instituto",
  otro: "Otra institución",
};
const roleNames = {
  administrador: "Administrador",
  organizador: "Organizador",
  participante: "Participante",
  jurado: "Jurado",
};
const blankInstitution = {
  nombre: "",
  ciudad: "",
  departamento: "",
  tipo: "colegio",
  estado: "activo",
};
const emptyData = {
  items: [],
  total: 0,
  pages: 1,
  summary: { total: 0, active: 0, cities: 0 },
};

export { types, roleNames, blankInstitution, emptyData };
