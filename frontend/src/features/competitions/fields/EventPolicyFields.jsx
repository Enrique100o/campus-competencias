// Política de aprobación y enlaces exigidos al entregar proyectos.
export function EventPolicyFields({ form, set, type }) {
  return (
    <fieldset>
      <legend>Política de inscripción</legend>
      <label className="check-line">
        <input
          type="checkbox"
          checked={Boolean(form.requiereAprobacion)}
          onChange={(e) => set("requiereAprobacion", e.target.checked)}
        />
        Requiere aprobación del organizador
      </label>
      {type === "hackatones" && (
        <>
          <label className="check-line">
            <input
              type="checkbox"
              checked={Boolean(form.requiereRepositorio)}
              onChange={(e) => set("requiereRepositorio", e.target.checked)}
            />
            Repositorio obligatorio al entregar
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              checked={Boolean(form.requiereDemostracion)}
              onChange={(e) => set("requiereDemostracion", e.target.checked)}
            />
            Demostración obligatoria al entregar
          </label>
        </>
      )}
    </fieldset>
  );
}
