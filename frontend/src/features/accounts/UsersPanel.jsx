import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api } from "../../api.js";
import { useResource } from "../../hooks/useResource.js";
import { BirthDateDialog } from "./BirthDateDialog.jsx";

const roles = {
  administrador: "Administrador",
  organizador: "Organizador",
  participante: "Participante",
  jurado: "Jurado",
};
const emptyUsers = {
  items: [],
  total: 0,
  pages: 1,
  summary: { total: 0, active: 0, admins: 0 },
};
const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

function Notice({ children }) {
  return (
    children && (
      <div className="error-notice" role="alert">
        <AlertCircle size={18} />
        <span>{children}</span>
      </div>
    )
  );
}

import { UserDialog } from "./UserDialog.jsx";
export function UsersPanel({ user, onUserChanged, onLogout }) {
  const [data, setData] = useState(emptyUsers);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [state, setState] = useState("");
  const [institution, setInstitution] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [birthDateAccount, setBirthDateAccount] = useState(null);
  const [toast, setToast] = useState("");
  const institutions = useResource("/usuarios/instituciones");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      q: search,
      page,
      limit: 8,
      ...(role ? { rol: role } : {}),
      ...(state ? { estado: state } : {}),
      ...(institution ? { institucion: institution } : {}),
    });
    api(`/usuarios?${params}`, { signal: controller.signal })
      .then((result) => {
        setData(result);
        if (page > result.pages) setPage(result.pages);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        if (err.status === 401) onLogout();
        else setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [search, role, state, institution, page, refresh, onLogout]);
  async function saved(message) {
    setDialog(null);
    setToast(message);
    setRefresh((value) => value + 1);
    try {
      onUserChanged(await api("/auth/me"));
    } catch (err) {
      if (err.status === 401) onLogout();
      else setError(err.message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LAS PERSONAS DE CAMPUS</span>
          <h1>Usuarios</h1>
          <p className="page-description">
            Cada persona, con el acceso que necesita.
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setDialog({ account: null })}
        >
          <Plus size={18} />
          Nuevo usuario
        </button>
      </div>
      <section className="summary-grid" aria-label="Resumen de usuarios">
        <div className="summary-card">
          <span className="summary-icon">
            <Users size={21} />
          </span>
          <div>
            <span>Usuarios registrados</span>
            <strong>
              {loading && !data.summary.total ? "—" : data.summary.total}
            </strong>
          </div>
          <small>Las personas de tu comunidad</small>
        </div>
        <div className="summary-card">
          <span className="summary-icon mint">
            <Check size={21} />
          </span>
          <div>
            <span>Cuentas activas</span>
            <strong>
              {loading && !data.summary.total ? "—" : data.summary.active}
            </strong>
          </div>
          <small>Con acceso a la plataforma</small>
        </div>
        <div className="summary-card">
          <span className="summary-icon sand">
            <ShieldCheck size={21} />
          </span>
          <div>
            <span>Administradores activos</span>
            <strong>
              {loading && !data.summary.total ? "—" : data.summary.admins}
            </strong>
          </div>
          <small>Responsables de los accesos</small>
        </div>
      </section>
      <section
        className="directory-card"
        aria-labelledby="users-directory-title"
      >
        <div className="directory-title">
          <div>
            <h2 id="users-directory-title">Directorio de usuarios</h2>
            <p>Gestiona sus datos, roles y estado de cuenta.</p>
          </div>
          <span className="records-label">
            {data.total} {data.total === 1 ? "registro" : "registros"}
          </span>
        </div>
        <div className="toolbar users-toolbar">
          <label className="search-box">
            <Search size={18} />
            <input
              aria-label="Buscar usuarios"
              placeholder="Buscar por nombre o correo…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select
            aria-label="Filtrar por rol"
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los roles</option>
            {Object.entries(roles).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar usuarios por estado"
            value={state}
            onChange={(event) => {
              setState(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los estados</option>
            <option value="activo">Activas</option>
            <option value="inactivo">Inactivas</option>
          </select>
          <select
            aria-label="Filtrar por institución"
            value={institution}
            disabled={institutions.loading || Boolean(institutions.error)}
            onChange={(event) => {
              setInstitution(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas las instituciones</option>
            {institutions.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre} · {item.ciudad}
              </option>
            ))}
          </select>
          <button
            className="icon-button refresh-button"
            aria-label="Actualizar usuarios"
            disabled={loading}
            onClick={() => {
              setRefresh((value) => value + 1);
              institutions.reload();
            }}
          >
            <RefreshCw size={17} className={loading ? "spin" : ""} />
          </button>
        </div>
        <Notice>{error}</Notice>
        <Notice>
          {institutions.error &&
            "No se pudieron cargar las instituciones. Pulsa Actualizar usuarios para reintentar."}
        </Notice>
        {loading ? (
          <div className="loading-area" role="status">
            <LoaderCircle size={25} className="spin" />
            <span>Cargando usuarios…</span>
          </div>
        ) : error ? (
          <div className="empty-state">
            <AlertCircle size={31} />
            <h3>No pudimos cargar los usuarios</h3>
            <p>Intenta actualizar el directorio.</p>
            <button
              className="button button-secondary"
              onClick={() => setRefresh((value) => value + 1)}
            >
              Volver a intentar
            </button>
          </div>
        ) : !data.items.length ? (
          <div className="empty-state">
            <span className="empty-icon">
              <Users size={35} />
            </span>
            <h3>No encontramos coincidencias</h3>
            <p>Prueba con otra búsqueda o cambia los filtros.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Correo electrónico</th>
                  <th>Rol</th>
                  <th>Institución</th>
                  <th>Edad</th>
                  <th>Estado</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <div className="account-name">
                        <span className="avatar">
                          {initials(account.nombre)}
                        </span>
                        <div>
                          <strong>{account.nombre}</strong>
                          {account.id === user.id && <small>Tu cuenta</small>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="account-email">{account.correo}</span>
                    </td>
                    <td>
                      <span className="role-pill account-role">
                        {roles[account.rol]}
                      </span>
                    </td>
                    <td>{account.institucionNombre || "Sin institución"}</td>
                    <td>
                      {account.nacimiento ? (
                        <div className="row-actions">
                          <span>{account.edad} años</span>
                          <button
                            type="button"
                            className="icon-button edit-button"
                            aria-label={`Editar edad de ${account.nombre}`}
                            onClick={() => setBirthDateAccount(account)}
                          >
                            <Pencil size={15} />
                          </button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${account.estado === "activo" ? "badge-active" : "badge-inactive"}`}
                      >
                        <span />
                        {account.estado === "activo" ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="icon-button edit-button"
                        aria-label={`Editar usuario ${account.nombre}`}
                        onClick={() => setDialog({ account })}
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          <span>
            {data.total
              ? `Página ${page} de ${data.pages}`
              : "Sin registros para mostrar"}
          </span>
          <div>
            <button
              className="pagination-button"
              aria-label="Página anterior de usuarios"
              disabled={loading || page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              className="pagination-button"
              aria-label="Página siguiente de usuarios"
              disabled={loading || page >= data.pages}
              onClick={() => setPage((value) => value + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
      <div className="bottom-note">
        <ShieldCheck size={15} />
        <span>Los permisos se aplican en cada operación de la plataforma.</span>
        <span className="bottom-note-brand">campus.</span>
      </div>
      {dialog && (
        <UserDialog
          account={dialog.account}
          currentUser={user}
          onClose={() => setDialog(null)}
          onSaved={saved}
          onLogout={onLogout}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {birthDateAccount && (
        <BirthDateDialog
          account={birthDateAccount}
          onClose={() => setBirthDateAccount(null)}
          onSaved={() => {
            setBirthDateAccount(null);
            setToast("Fecha de nacimiento actualizada.");
            setRefresh((value) => value + 1);
          }}
        />
      )}
    </>
  );
}
