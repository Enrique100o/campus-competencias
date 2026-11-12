import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Field, Notice } from "../../components/ui/Fields.jsx";
import { useResource } from "../../hooks/useResource.js";

export function MemberPicker({
  members,
  onChange,
  institutions,
  institution = "",
  needsInstitution = false,
  selfId,
  max = 100,
  min,
  disabled,
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const term = search.trim();
  useEffect(() => {
    const timer = setTimeout(() => setQuery(term), 250);
    return () => clearTimeout(timer);
  }, [term]);

  const ready = term.length >= 2 && (!needsInstitution || institution);
  const params = new URLSearchParams({ q: query });
  if (institution) params.set("institucion", institution);
  const results = useResource(
    ready && query === term ? `/equipos/integrantes?${params}` : null,
  );
  const options = (results.data || []).filter(
    (person) => !members.some((member) => member.id === person.id),
  );
  const atLimit = members.length >= max;
  const waiting =
    ready &&
    (query !== term || results.loading || (!results.data && !results.error));
  const institutionName = (person) =>
    person.institucionNombre ||
    institutions.find((item) => item.id === person.institucion)?.nombre;

  return (
    <fieldset className="form-section member-picker" disabled={disabled}>
      <legend>
        Integrantes ({members.length}
        {min !== undefined ? ` · mínimo ${min}` : ""})
      </legend>
      {members.length > 0 && (
        <ul className="member-selection" aria-label="Integrantes del equipo">
          {members.map((person) => (
            <li key={person.id}>
              <span>
                {person.id === selfId ? `${person.nombre} (tú)` : person.nombre}
              </span>
              {person.id !== selfId && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Quitar a ${person.nombre}`}
                  onClick={() =>
                    onChange(
                      members.filter((member) => member.id !== person.id),
                    )
                  }
                >
                  <X size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {needsInstitution && !institution ? (
        <p className="form-help">
          Selecciona la institución para buscar compañeros.
        </p>
      ) : atLimit ? (
        <p className="form-help" role="status">
          El equipo ya tiene el máximo de {max} integrantes.
        </p>
      ) : (
        <>
          <Field
            label="Buscar compañeros por nombre"
            type="search"
            placeholder="Escribe al menos 2 letras"
            required={false}
            maxLength={100}
            value={search}
            onChange={setSearch}
          />
          {waiting && (
            <p className="form-help" role="status">
              Buscando…
            </p>
          )}
          {ready && !waiting && results.error && (
            <>
              <Notice>{results.error}</Notice>
              <button
                type="button"
                className="button button-secondary"
                onClick={results.reload}
              >
                Volver a intentar
              </button>
            </>
          )}
          {ready &&
            !waiting &&
            !results.error &&
            (options.length ? (
              <ul
                className="member-results"
                aria-label="Resultados de búsqueda"
              >
                {options.map((person) => (
                  <li key={person.id}>
                    <span>
                      <strong>{person.nombre}</strong>
                      <small>{institutionName(person)}</small>
                    </span>
                    <button
                      type="button"
                      className="button button-secondary"
                      aria-label={`Agregar a ${person.nombre}`}
                      onClick={() => {
                        onChange([...members, person]);
                        setSearch("");
                      }}
                    >
                      <Plus size={16} /> Agregar
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="form-help" role="status">
                No encontramos compañeros disponibles con ese nombre.
              </p>
            ))}
          {!term && (
            <p className="form-help">
              <Search size={14} aria-hidden="true" /> Busca a un compañero con
              ficha activa en Campus.
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}
