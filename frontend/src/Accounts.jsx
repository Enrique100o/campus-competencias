import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronLeft, ChevronRight, LoaderCircle, Pencil, Plus, RefreshCw, Search, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import { api } from './api.js';

const roles = { administrador: 'Administrador', organizador: 'Organizador', participante: 'Participante', jurado: 'Jurado' };
const emptyUsers = { items: [], total: 0, pages: 1, summary: { total: 0, active: 0, admins: 0 } };
const blankUser = { nombre: '', correo: '', rol: 'participante', estado: 'activo', password: '' };
const initials = name => name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();

function Notice({ children }) {
  return children && <div className="error-notice" role="alert"><AlertCircle size={18} /><span>{children}</span></div>;
}

function UserDialog({ account, currentUser, onClose, onSaved, onLogout }) {
  const dialog = useRef(null);
  const [form, setForm] = useState(account ? { ...account, password: '' } : blankUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ownAccount = account?.id === currentUser.id;
  useEffect(() => { dialog.current.showModal(); }, []);
  const update = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = { nombre: form.nombre, correo: form.correo, rol: form.rol, estado: form.estado };
      if (!account || form.password) body.password = form.password;
      await api(account ? `/usuarios/${account.id}` : '/usuarios', { method: account ? 'PATCH' : 'POST', body });
      onSaved(account ? 'Cuenta actualizada.' : 'Cuenta registrada.');
    } catch (err) { if (err.status === 401) onLogout(); else setError(err.message); }
    finally { setBusy(false); }
  }
  return <dialog className="institution-dialog" ref={dialog} aria-labelledby="user-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="dialog-heading"><span className="dialog-icon"><UserRound size={24} /></span><button className="icon-button" type="button" aria-label="Cerrar formulario de usuario" onClick={onClose} disabled={busy}><X size={20} /></button></div>
    <h2 id="user-dialog-title">{account ? 'Editar usuario' : 'Un nuevo usuario'}</h2>
    <p>{account ? 'Actualiza la información y los permisos de esta cuenta.' : 'Crea una cuenta para que otra persona pueda acceder a Campus.'}</p>
    <form onSubmit={submit}>
      <label>Nombre completo<input name="nombre" autoComplete="off" required minLength={2} maxLength={100} value={form.nombre} onChange={update} placeholder="Nombre de la persona" /></label>
      <label>Correo electrónico<input name="correo" type="email" autoComplete="off" required maxLength={254} value={form.correo} onChange={update} placeholder="nombre@institucion.edu.co" /></label>
      <div className="form-row">
        <label>Rol<select name="rol" value={form.rol} onChange={update}>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Estado<select name="estado" value={form.estado} onChange={update} disabled={ownAccount}><option value="activo">Activa</option><option value="inactivo">Inactiva</option></select></label>
      </div>
      <label>{account ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}<input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required={!account} value={form.password} onChange={update} placeholder={account ? 'Déjala vacía para conservar la actual' : 'Al menos 10 caracteres'} /></label>
      <div className="form-hint"><ShieldCheck size={16} /><span>{ownAccount ? 'Tu propia cuenta debe permanecer activa. ' : ''}{account ? 'Cambiar la contraseña cierra las sesiones de esa cuenta.' : 'La persona podrá ingresar con este correo y su contraseña inicial.'}</span></div>
      <Notice>{error}</Notice>
      <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</button><button className="button button-primary" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <><Check size={17} />{account ? 'Guardar cambios' : 'Registrar usuario'}</>}</button></div>
    </form>
  </dialog>;
}

export function UsersPanel({ user, onUserChanged, onLogout }) {
  const [data, setData] = useState(emptyUsers);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ q: search, page, limit: 8, ...(role ? { rol: role } : {}), ...(state ? { estado: state } : {}) });
    api(`/usuarios?${params}`, { signal: controller.signal }).then(result => {
      setData(result);
      if (page > result.pages) setPage(result.pages);
    }).catch(err => {
      if (err.name === 'AbortError') return;
      if (err.status === 401) onLogout(); else setError(err.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, role, state, page, refresh, onLogout]);
  async function saved(message) {
    setDialog(null);
    setToast(message);
    setRefresh(value => value + 1);
    try { onUserChanged(await api('/auth/me')); }
    catch (err) { if (err.status === 401) onLogout(); else setError(err.message); }
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">LAS PERSONAS DE CAMPUS</span><h1>Usuarios</h1><p className="page-description">Cada persona, con el acceso que necesita.</p></div><button className="button button-primary" onClick={() => setDialog({ account: null })}><Plus size={18} />Nuevo usuario</button></div>
    <section className="summary-grid" aria-label="Resumen de usuarios">
      <div className="summary-card"><span className="summary-icon"><Users size={21} /></span><div><span>Usuarios registrados</span><strong>{loading && !data.summary.total ? '—' : data.summary.total}</strong></div><small>Las personas de tu comunidad</small></div>
      <div className="summary-card"><span className="summary-icon mint"><Check size={21} /></span><div><span>Cuentas activas</span><strong>{loading && !data.summary.total ? '—' : data.summary.active}</strong></div><small>Con acceso a la plataforma</small></div>
      <div className="summary-card"><span className="summary-icon sand"><ShieldCheck size={21} /></span><div><span>Administradores activos</span><strong>{loading && !data.summary.total ? '—' : data.summary.admins}</strong></div><small>Responsables de los accesos</small></div>
    </section>
    <section className="directory-card" aria-labelledby="users-directory-title">
      <div className="directory-title"><div><h2 id="users-directory-title">Directorio de usuarios</h2><p>Gestiona sus datos, roles y estado de cuenta.</p></div><span className="records-label">{data.total} {data.total === 1 ? 'registro' : 'registros'}</span></div>
      <div className="toolbar users-toolbar"><label className="search-box"><Search size={18} /><input aria-label="Buscar usuarios" placeholder="Buscar por nombre o correo…" value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Filtrar por rol" value={role} onChange={event => { setRole(event.target.value); setPage(1); }}><option value="">Todos los roles</option>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Filtrar usuarios por estado" value={state} onChange={event => { setState(event.target.value); setPage(1); }}><option value="">Todos los estados</option><option value="activo">Activas</option><option value="inactivo">Inactivas</option></select><button className="icon-button refresh-button" aria-label="Actualizar usuarios" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={17} className={loading ? 'spin' : ''} /></button></div>
      <Notice>{error}</Notice>
      {loading ? <div className="loading-area" role="status"><LoaderCircle size={25} className="spin" /><span>Cargando usuarios…</span></div> : error ? <div className="empty-state"><AlertCircle size={31} /><h3>No pudimos cargar los usuarios</h3><p>Intenta actualizar el directorio.</p><button className="button button-secondary" onClick={() => setRefresh(value => value + 1)}>Volver a intentar</button></div> : !data.items.length ? <div className="empty-state"><span className="empty-icon"><Users size={35} /></span><h3>No encontramos coincidencias</h3><p>Prueba con otra búsqueda o cambia los filtros.</p></div> : <div className="table-scroll"><table><thead><tr><th>Persona</th><th>Correo electrónico</th><th>Rol</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{data.items.map(account => <tr key={account.id}><td><div className="account-name"><span className="avatar">{initials(account.nombre)}</span><div><strong>{account.nombre}</strong>{account.id === user.id && <small>Tu cuenta</small>}</div></div></td><td><span className="account-email">{account.correo}</span></td><td><span className="role-pill account-role">{roles[account.rol]}</span></td><td><span className={`badge ${account.estado === 'activo' ? 'badge-active' : 'badge-inactive'}`}><span />{account.estado === 'activo' ? 'Activa' : 'Inactiva'}</span></td><td><button className="icon-button edit-button" aria-label={`Editar usuario ${account.nombre}`} onClick={() => setDialog({ account })}><Pencil size={16} /></button></td></tr>)}</tbody></table></div>}
      <div className="table-footer"><span>{data.total ? `Página ${page} de ${data.pages}` : 'Sin registros para mostrar'}</span><div><button className="pagination-button" aria-label="Página anterior de usuarios" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={17} /></button><button className="pagination-button" aria-label="Página siguiente de usuarios" disabled={loading || page >= data.pages} onClick={() => setPage(value => value + 1)}><ChevronRight size={17} /></button></div></div>
    </section>
    <div className="bottom-note"><ShieldCheck size={15} /><span>Los permisos se aplican en cada operación de la plataforma.</span><span className="bottom-note-brand">campus.</span></div>
    {dialog && <UserDialog account={dialog.account} currentUser={user} onClose={() => setDialog(null)} onSaved={saved} onLogout={onLogout} />}
    {toast && <div className="toast" role="status"><Check size={18} />{toast}</div>}
  </>;
}

export function ProfilePanel({ user, onUserChanged, onLogout }) {
  const [form, setForm] = useState({ nombre: user.nombre, correo: user.correo, currentPassword: '' });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const emailChanged = form.correo.trim().toLowerCase() !== user.correo;
  const update = event => { setForm(previous => ({ ...previous, [event.target.name]: event.target.value })); setSaved(false); };
  useEffect(() => { setForm({ nombre: user.nombre, correo: user.correo, currentPassword: '' }); }, [user.nombre, user.correo]);
  function edit() { setEditing(true); setError(''); setSaved(false); }
  function cancel() { setEditing(false); setError(''); setForm({ nombre: user.nombre, correo: user.correo, currentPassword: '' }); }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/usuarios/me', { method: 'PATCH', body: { nombre: form.nombre, correo: form.correo, ...(emailChanged ? { currentPassword: form.currentPassword } : {}) } });
      onUserChanged(await api('/auth/me'));
      setEditing(false);
      setForm(previous => ({ ...previous, currentPassword: '' }));
      setSaved(true);
    } catch (err) { if (err.status === 401) onLogout(); else setError(err.message); }
    finally { setBusy(false); }
  }
  return <>
    <span className="eyebrow">TU CUENTA</span><h1>Mi perfil</h1><p className="page-description">Mantén actualizada tu información personal.</p>
    <section className="profile-card">
      <div className="profile-heading"><span className="avatar profile-avatar">{initials(user.nombre)}</span>{!editing && <button className="button button-secondary" onClick={edit}><Pencil size={15} />Editar perfil</button>}</div>
      <h2>{user.nombre}</h2><span className="role-pill">{roles[user.rol]}</span>
      {editing ? <form className="profile-form" onSubmit={submit}>
        <label>Nombre completo<input name="nombre" autoComplete="name" required minLength={2} maxLength={100} value={form.nombre} onChange={update} /></label>
        <label>Correo electrónico<input name="correo" type="email" autoComplete="username" required maxLength={254} value={form.correo} onChange={update} /></label>
        {emailChanged && <><label>Contraseña actual<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} value={form.currentPassword} onChange={update} /></label><div className="form-hint"><ShieldCheck size={16} /><span>Confirma tu contraseña actual para cambiar el correo con el que ingresas.</span></div></>}
        <Notice>{error}</Notice>
        <div className="dialog-actions"><button className="button button-secondary" type="button" disabled={busy} onClick={cancel}>Cancelar</button><button className="button button-primary" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <><Check size={17} />Guardar mi perfil</>}</button></div>
      </form> : <dl><div><dt>Correo electrónico</dt><dd>{user.correo}</dd></div><div><dt>Estado de la cuenta</dt><dd><span className="badge badge-active"><span />Activa</span></dd></div></dl>}
      {saved && <div className="success-notice" role="status"><Check size={17} /><span>Tu perfil fue actualizado.</span></div>}
    </section>
  </>;
}
