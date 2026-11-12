import divipola from "../../data/divipola.json";
import { Select } from "./Fields.jsx";

function placeKey(value = "") {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Mantiene el valor guardado al editar, aunque antes se escribiera sin tildes.
function optionsWithSaved(names, saved) {
  const match =
    saved && names.find((name) => placeKey(name) === placeKey(saved));
  const options = names.map((name) => ({
    id: name === match ? saved : name,
    nombre: name,
  }));
  if (saved && !match)
    options.unshift({ id: saved, nombre: saved + " (ubicación guardada)" });
  return options;
}

const departments = divipola.departamentos.map(
  (department) => department.nombre,
);

export function LocationFields({
  departamento,
  ciudad,
  onChange,
  disabled = false,
}) {
  const department = divipola.departamentos.find(
    (entry) => placeKey(entry.nombre) === placeKey(departamento),
  );
  const cities = department?.municipios || [];
  return (
    <div className="form-row">
      <Select
        label="Departamento"
        name="departamento"
        value={departamento}
        options={optionsWithSaved(departments, departamento)}
        onChange={(value) => onChange({ departamento: value, ciudad: "" })}
        disabled={disabled}
      />
      <Select
        label="Ciudad/municipio"
        name="ciudad"
        value={ciudad}
        options={optionsWithSaved(cities, ciudad)}
        placeholder={
          departamento
            ? "Selecciona una ciudad o municipio"
            : "Selecciona primero el departamento"
        }
        onChange={(value) => onChange({ departamento, ciudad: value })}
        disabled={disabled || !departamento}
      />
    </div>
  );
}
