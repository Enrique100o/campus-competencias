import { Field, Select, Checks } from "../../../components/ui/Fields.jsx";
import { Plus } from "lucide-react";

// Categorías, modalidades y formatos de una disciplina.
export function DisciplineFields({ form, set }) {
  return (
    <>
      <Checks
        label="Modalidades de participación"
        values={form.modalidades}
        options={["equipo", "individual", "relevo"]}
        onChange={(value) => set("modalidades", value)}
      />
      <Checks
        label="Formatos de competencia"
        values={form.formatos}
        options={["liga", "grupos", "eliminacion", "pruebas", "rondas"]}
        onChange={(value) => set("formatos", value)}
      />
      <fieldset className="form-section">
        <legend>Categorías</legend>
        <p>
          La edad se comprueba en la fecha de inicio del torneo. Deja las edades
          vacías para una categoría sin límite.
        </p>
        {form.categorias.map((cat, index) => {
          const change = (key, value) =>
            set(
              "categorias",
              form.categorias.map((c, i) =>
                i === index ? { ...c, [key]: value } : c,
              ),
            );
          return (
            <div className="category-row" key={cat.id || index}>
              <Field
                label={`Categoría ${index + 1}`}
                value={cat.nombre}
                onChange={(v) => change("nombre", v)}
                minLength={2}
                maxLength={80}
              />
              <div className="form-row">
                <Field
                  label={`Edad mínima ${index + 1}`}
                  value={cat.edadMin}
                  onChange={(v) => change("edadMin", v)}
                  type="number"
                  min={0}
                  max={100}
                  required={false}
                />
                <Field
                  label={`Edad máxima ${index + 1}`}
                  value={cat.edadMax}
                  onChange={(v) => change("edadMax", v)}
                  type="number"
                  min={0}
                  max={100}
                  required={false}
                />
              </div>
              <Select
                label={`Género de categoría ${index + 1}`}
                value={cat.genero}
                onChange={(v) => change("genero", v)}
                options={["cualquiera", "femenino", "masculino"]}
              />
              <button
                type="button"
                className="button button-secondary"
                disabled={form.categorias.length === 1}
                onClick={() =>
                  set(
                    "categorias",
                    form.categorias.filter((_, i) => i !== index),
                  )
                }
              >
                Retirar categoría {index + 1}
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="button button-secondary"
          onClick={() =>
            set("categorias", [
              ...form.categorias,
              {
                nombre: "",
                edadMin: "",
                edadMax: "",
                genero: "cualquiera",
              },
            ])
          }
        >
          <Plus size={15} />
          Agregar categoría
        </button>
      </fieldset>
    </>
  );
}
