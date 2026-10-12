import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle, ArrowRight, Building2, Check, ChevronLeft, ChevronRight,
  GraduationCap, LoaderCircle, LogOut, MapPin, Menu, Pencil, Plus,
  RefreshCw, Search, ShieldCheck, UserRound, Users, X, Trophy, Medal, Code2, ClipboardCheck, Trash2,
} from 'lucide-react';
import { api, setCsrf } from './api.js';
import { ProfilePanel, UsersPanel } from './Accounts.jsx';
import { ResourcePanel, resourceNames } from './Competitions.jsx';

const types = { colegio: 'Colegio', universidad: 'Universidad', instituto: 'Instituto', otro: 'Otra institución' };
const roleNames = { administrador: 'Administrador', organizador: 'Organizador', participante: 'Participante', jurado: 'Jurado' };
const blankInstitution = { nombre: '', ciudad: '', departamento: '', tipo: 'colegio', estado: 'activo' };
const emptyData = { items: [], total: 0, pages: 1, summary: { total: 0, active: 0, cities: 0 } };

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
}

function Brand({ light = false }) {
  return <div className={`brand ${light ? 'brand-light' : ''}`}>
    <span className="brand-mark"><GraduationCap size={25} strokeWidth={1.8} /></span>
    <span><strong>campus<span className="brand-dot">.</span></strong><small>GESTIÓN DE COMPETENCIAS</small></span>
  </div>;
}

function ErrorNotice({ children }) {
  return children && <div className="error-notice" role="alert"><AlertCircle size={18} /><span>{children}</span></div>;
}

function Auth({ setup, onAuthenticated }) {
  const [form, setForm] = useState({ nombre: '', correo: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = event => setForm(old => ({ ...old, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    setError('');
    if (setup && form.password !== form.confirm) return setError('Las contraseñas deben coincidir.');
    setBusy(true);
    try {
      const session = await api(setup ? '/setup/administrador' : '/auth/login', {
        method: 'POST', body: { nombre: form.nombre, correo: form.correo, password: form.password },
      });
      onAuthenticated(session);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="auth-layout">
    <section className="auth-story">
      <Brand light />
      <div className="auth-story-content">
        <span className="eyebrow light-eyebrow">CONECTA. ORGANIZA. COMPITE.</span>
        <h1>Las grandes ideas<br />y las grandes<br /><em>competencias.</em></h1>
        <p>Un punto de encuentro para las instituciones y los equipos que hacen posible cada evento.</p>
        <div className="auth-pills"><span>Intercolegiados</span><span>Torneos</span><span>Hackatones</span></div>
      </div>
      <div className="auth-story-footer"><span className="status-dot" /> Juntos llegamos más lejos</div>
      <div className="auth-orbit orbit-one" /><div className="auth-orbit orbit-two" />
    </section>
    <section className="auth-form-area">
      <div className="auth-mobile-brand"><Brand /></div>
      <div className="auth-card">
        <div className="auth-icon"><ShieldCheck size={27} /></div>
        <span className="eyebrow">{setup ? 'BIENVENIDO A CAMPUS' : 'TU ESPACIO DE TRABAJO'}</span>
        <h2>{setup ? 'Comencemos.' : 'Qué bueno verte.'}</h2>
        <p className="auth-description">{setup ? 'Crea tu cuenta de administrador para empezar a organizar tu comunidad.' : 'Ingresa con tu cuenta para continuar.'}</p>
        <form onSubmit={submit} className="auth-form">
          {setup && <label>Nombre completo<input autoComplete="name" name="nombre" value={form.nombre} onChange={update} minLength={2} maxLength={100} required placeholder="Tu nombre" /></label>}
          <label>Correo electrónico<input autoComplete="username" type="email" name="correo" value={form.correo} onChange={update} maxLength={254} required placeholder="nombre@institucion.edu.co" /></label>
          <label>Contraseña<input autoComplete={setup ? 'new-password' : 'current-password'} type="password" name="password" value={form.password} onChange={update} minLength={setup ? 10 : 1} maxLength={128} required placeholder={setup ? 'Al menos 10 caracteres' : 'Tu contraseña'} /></label>
          {setup && <label>Confirmar contraseña<input autoComplete="new-password" type="password" name="confirm" value={form.confirm} onChange={update} minLength={10} maxLength={128} required placeholder="Repite tu contraseña" /></label>}
          <ErrorNotice>{error}</ErrorNotice>
          <button className="button button-primary auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <>{setup ? 'Crear mi cuenta' : 'Iniciar sesión'}<ArrowRight size={18} /></>}</button>
        </form>
        <p className="auth-note"><ShieldCheck size={14} />Tu cuenta y tus datos, en un espacio seguro.</p>
      </div>
      <footer className="auth-bottom">Campus · Gestión de competencias universitarias</footer>
    </section>
  </main>;
}

function InstitutionDialog({ institution, onClose, onSaved }) {
  const dialog = useRef(null);
  const [form, setForm] = useState(institution || blankInstitution);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current.showModal(); }, []);
  const update = event => setForm(old => ({ ...old, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(institution ? `/instituciones/${institution.id}` : '/instituciones', {
        method: institution ? 'PUT' : 'POST',
        body: { nombre: form.nombre, ciudad: form.ciudad, departamento: form.departamento, tipo: form.tipo, estado: form.estado },
      });
      onSaved(institution ? 'Institución actualizada.' : 'Institución registrada.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <dialog className="institution-dialog" ref={dialog} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="institution-dialog-title">
    <div className="dialog-heading"><span className="dialog-icon"><Building2 size={24} /></span><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Cerrar formulario"><X size={20} /></button></div>
    <h2 id="institution-dialog-title">{institution ? 'Editar institución' : 'Una nueva institución'}</h2>
    <p>Agrega la información de la institución educativa.</p>
    <form onSubmit={submit}>
      <label>Nombre de la institución<input autoFocus name="nombre" value={form.nombre} onChange={update} required minLength={2} maxLength={150} placeholder="Ej. Universidad del Norte" /></label>
      <div className="form-row">
        <label>Ciudad/municipio<input name="ciudad" value={form.ciudad} onChange={update} required minLength={2} maxLength={100} placeholder="Ej. Barranquilla" /></label>
        <label>Departamento<input name="departamento" value={form.departamento} onChange={update} required minLength={2} maxLength={100} placeholder="Ej. Atlántico" /></label>
      </div>
      <div className="form-row">
        <label>Tipo de institución<select name="tipo" value={form.tipo} onChange={update}>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Estado<select name="estado" value={form.estado} onChange={update}><option value="activo">Activa</option><option value="inactivo">Inactiva</option></select></label>
      </div>
      <div className="form-hint"><ShieldCheck size={16} /><span>Una institución inactiva permanece en el historial.</span></div>
      <ErrorNotice>{error}</ErrorNotice>
      <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</button><button className="button button-primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <><Check size={17} />{institution ? 'Guardar cambios' : 'Registrar institución'}</>}</button></div>
    </form>
  </dialog>;
}

function InstitutionDeleteDialog({ institution, onClose, onSaved, onLogout }) {
  const dialog = useRef(null);
  const cancel = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  useEffect(() => { dialog.current.showModal(); cancel.current.focus(); }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy || blocked && institution.estado === 'inactivo') return;
    setBusy(true);
    setError('');
    try {
      await api(`/instituciones/${institution.id}`, blocked
        ? { method: 'PATCH', body: { estado: 'inactivo' } }
        : { method: 'DELETE' });
      onSaved(blocked ? 'Institución desactivada.' : 'Institución eliminada.');
    } catch (err) {
      if (err.status === 401) onLogout();
      else if (err.status === 404) onSaved('La institución ya no está disponible.');
      else {
        if (err.code === 'INSTITUTION_IN_USE') setBlocked(true);
        setError(err.message);
      }
    } finally { setBusy(false); }
  }
  return <dialog className="institution-dialog delete-dialog" ref={dialog} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="institution-delete-title" aria-describedby="institution-delete-description">
    <div className="dialog-heading"><span className="dialog-icon"><Trash2 size={24} /></span><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Cerrar confirmación"><X size={20} /></button></div>
    <h2 id="institution-delete-title">{blocked ? 'Conservar el historial' : '¿Eliminar institución?'}</h2>
    <p id="institution-delete-description">{blocked ? <>La institución <strong>{institution.nombre}</strong> tiene registros relacionados y debe permanecer en la base de datos.</> : <>Se eliminará <strong>{institution.nombre}</strong> de la base de datos. Esta acción no se puede deshacer.</>}</p>
    <form onSubmit={submit}>
      <ErrorNotice>{error}</ErrorNotice>
      {blocked && <p className="form-help">{institution.estado === 'activo' ? 'Puedes desactivarla para impedir nuevas participaciones y mantener los registros existentes.' : 'La institución ya está inactiva y conserva sus registros existentes.'}</p>}
      <div className="dialog-actions"><button className="button button-secondary" type="button" ref={cancel} onClick={onClose} disabled={busy}>{blocked ? 'Cerrar' : 'Cancelar'}</button>{(!blocked || institution.estado === 'activo') && <button className={`button ${blocked ? 'button-primary' : 'button-danger'}`} disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : blocked ? <><Check size={17} />Desactivar institución</> : <><Trash2 size={17} />Eliminar institución</>}</button>}</div>
    </form>
  </dialog>;
}

function Workspace({ user, onLogout, onUserChanged }) {
  const [view, setView] = useState('instituciones');
  const [menuOpen, setMenuOpen] = useState(false);
  const [data, setData] = useState(emptyData);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const admin = user.rol === 'administrador';
  const currentView = view === 'usuarios' && !admin || ['participantes', 'equipos', 'inscripciones'].includes(view) && user.rol === 'jurado' ? 'perfil' : view;
  const competitionView = Object.hasOwn(resourceNames, currentView);
  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(query); setPage(1); }, 250);
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
    const params = new URLSearchParams({ page, limit: 8, q: debounced, ...(state ? { estado: state } : {}) });
    api(`/instituciones?${params}`, { signal: controller.signal }).then(result => {
      setData(result);
      if (page > result.pages) setPage(result.pages);
    }).catch(err => {
      if (err.name === 'AbortError') return;
      if (err.status === 401) onLogout(); else setError(err.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [debounced, state, page, refresh, onLogout]);
  async function logout() {
    setLoggingOut(true);
    setLogoutError('');
    try { await api('/auth/logout', { method: 'POST', body: {} }); onLogout(); }
    catch (err) { if (err.status === 401) onLogout(); else setLogoutError(err.message); }
    finally { setLoggingOut(false); }
  }
  function changeView(next) { setView(next); setMenuOpen(false); }
  function saved(message) { setDialog(null); setDeleting(null); setToast(message); setRefresh(value => value + 1); }
  return <div className="workspace">
    {menuOpen && <button className="sidebar-scrim" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <Brand />
      <div className="sidebar-section-title">ESPACIO DE TRABAJO</div>
      <nav aria-label="Navegación principal">
        <button className={`nav-item ${currentView === 'instituciones' ? 'active' : ''}`} onClick={() => changeView('instituciones')}><Building2 size={19} /><span>Instituciones</span><span className="nav-count">{data.summary.total}</span></button>
        {admin && <button className={`nav-item ${currentView === 'usuarios' ? 'active' : ''}`} onClick={() => changeView('usuarios')}><Users size={19} /><span>Usuarios</span></button>}
        {Object.entries(resourceNames).filter(([key]) => user.rol !== 'jurado' || !['participantes', 'equipos', 'inscripciones'].includes(key)).map(([key, title]) => {
          const Icon = { disciplinas: Medal, torneos: Trophy, hackatones: Code2, participantes: UserRound, equipos: Users, inscripciones: ClipboardCheck }[key];
          return <button key={key} className={`nav-item ${currentView === key ? 'active' : ''}`} onClick={() => changeView(key)}><Icon size={19} /><span>{title}</span></button>;
        })}
        <button className={`nav-item ${currentView === 'perfil' ? 'active' : ''}`} onClick={() => changeView('perfil')}><UserRound size={19} /><span>Mi perfil</span></button>
      </nav>
      <div className="sidebar-community"><div className="community-visual"><GraduationCap size={31} /><span /><span /><span /></div><strong>Una comunidad.<br />Muchas posibilidades.</strong><p>Todo comienza con las personas y las instituciones.</p></div>
      <div className="sidebar-footer"><span className="avatar">{initials(user.nombre)}</span><div><strong>{user.nombre}</strong><small>{roleNames[user.rol]}</small></div></div>
    </aside>
    <div className="workspace-body">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={21} /></button><span>Campus</span><ChevronRight size={14} /><strong>{{ instituciones: 'Instituciones', usuarios: 'Usuarios', perfil: 'Mi perfil', ...resourceNames }[currentView]}</strong></div><div className="topbar-right"><span className="access-label"><ShieldCheck size={15} />{roleNames[user.rol]}</span><button className="logout-button" onClick={logout} disabled={loggingOut}><LogOut size={16} /><span>Cerrar sesión</span></button></div></header>
      <main className="main-content">
        <ErrorNotice>{logoutError}</ErrorNotice>
        {competitionView ? <ResourcePanel key={currentView} type={currentView} user={user} onLogout={onLogout} /> : currentView === 'perfil' ? <ProfilePanel user={user} onUserChanged={onUserChanged} onLogout={onLogout} /> : currentView === 'usuarios' ? <UsersPanel user={user} onUserChanged={onUserChanged} onLogout={onLogout} /> : <>
          <div className="page-heading"><div><span className="eyebrow">NUESTRA COMUNIDAD</span><h1>Instituciones</h1><p className="page-description">Las instituciones que dan vida a cada competencia.</p></div>{admin && <button className="button button-primary" onClick={() => setDialog({ institution: null })}><Plus size={18} />Nueva institución</button>}</div>
          <section className="summary-grid" aria-label="Resumen de instituciones">
            <div className="summary-card"><span className="summary-icon"><Building2 size={21} /></span><div><span>Instituciones registradas</span><strong>{loading && !data.summary.total ? '—' : data.summary.total}</strong></div><small>Una red que sigue creciendo</small></div>
            <div className="summary-card"><span className="summary-icon mint"><Check size={21} /></span><div><span>Instituciones activas</span><strong>{loading && !data.summary.total ? '—' : data.summary.active}</strong></div><small>Disponibles para participar</small></div>
            <div className="summary-card"><span className="summary-icon sand"><MapPin size={21} /></span><div><span>Ciudades/municipios representados</span><strong>{loading && !data.summary.total ? '—' : data.summary.cities}</strong></div><small>Conectando nuevas comunidades</small></div>
          </section>
          <section className="directory-card" aria-labelledby="directory-heading">
            <div className="directory-title"><div><h2 id="directory-heading">Directorio de instituciones</h2><p>Consulta y organiza tu comunidad educativa.</p></div><span className="records-label">{data.total} {data.total === 1 ? 'registro' : 'registros'}</span></div>
            <div className="toolbar"><label className="search-box"><Search size={18} /><input aria-label="Buscar instituciones" placeholder="Buscar por nombre, ciudad/municipio o departamento…" value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Filtrar por estado" value={state} onChange={event => { setState(event.target.value); setPage(1); }}><option value="">Todos los estados</option><option value="activo">Activas</option><option value="inactivo">Inactivas</option></select><button className="icon-button refresh-button" aria-label="Actualizar instituciones" onClick={() => setRefresh(value => value + 1)} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /></button></div>
            <ErrorNotice>{error}</ErrorNotice>
            {loading ? <div className="loading-area" role="status"><LoaderCircle size={25} className="spin" /><span>Cargando instituciones…</span></div> : error ? <div className="empty-state"><AlertCircle size={31} /><h3>No pudimos cargar el directorio</h3><p>Intenta actualizar la información.</p><button className="button button-secondary" onClick={() => setRefresh(value => value + 1)}>Volver a intentar</button></div> : !data.items.length ? <div className="empty-state"><span className="empty-icon"><Building2 size={35} strokeWidth={1.5} /></span><h3>{query || state ? 'No encontramos coincidencias' : admin ? 'Tu comunidad comienza aquí' : 'Todavía no hay instituciones'}</h3><p>{query || state ? 'Prueba con otro nombre o cambia los filtros.' : admin ? 'Registra la primera institución para empezar a construir tu directorio.' : 'Las instituciones aparecerán aquí cuando el administrador las registre.'}</p>{admin && !query && !state && <button className="button button-secondary" onClick={() => setDialog({ institution: null })}><Plus size={16} />Registrar una institución</button>}</div> : <div className="table-scroll"><table><thead><tr><th>Institución</th><th>Ciudad/municipio</th><th>Tipo</th><th>Estado</th>{admin && <th><span className="sr-only">Acciones</span></th>}</tr></thead><tbody>{data.items.map(item => <tr key={item.id}><td><div className="institution-name"><span className={`institution-avatar type-${item.tipo}`}><Building2 size={19} /></span><strong>{item.nombre}</strong></div></td><td><div className="location-cell"><span>{item.ciudad}</span><small>{item.departamento}</small></div></td><td><span className="type-label">{types[item.tipo]}</span></td><td><span className={`badge ${item.estado === 'activo' ? 'badge-active' : 'badge-inactive'}`}><span />{item.estado === 'activo' ? 'Activa' : 'Inactiva'}</span></td>{admin && <td><div className="row-actions"><button className="icon-button edit-button" title="Editar institución" aria-label={`Editar ${item.nombre}`} onClick={() => setDialog({ institution: item })}><Pencil size={16} /></button><button className="icon-button delete-button" title="Eliminar institución" aria-label={`Eliminar ${item.nombre}`} onClick={() => setDeleting(item)}><Trash2 size={16} /></button></div></td>}</tr>)}</tbody></table></div>}
            <div className="table-footer"><span>{data.total ? `Página ${page} de ${data.pages}` : 'Sin registros para mostrar'}</span><div><button className="pagination-button" aria-label="Página anterior" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}><ChevronLeft size={17} /></button><button className="pagination-button" aria-label="Página siguiente" disabled={page >= data.pages || loading} onClick={() => setPage(value => value + 1)}><ChevronRight size={17} /></button></div></div>
          </section>
          <div className="bottom-note"><ShieldCheck size={15} /><span>La información de tu comunidad, organizada en un solo lugar.</span><span className="bottom-note-brand">campus.</span></div>
        </>}
      </main>
    </div>
    {dialog && <InstitutionDialog institution={dialog.institution} onClose={() => setDialog(null)} onSaved={saved} />}
    {deleting && <InstitutionDeleteDialog institution={deleting} onClose={() => setDeleting(null)} onSaved={saved} onLogout={onLogout} />}
    {toast && <div className="toast" role="status"><Check size={18} />{toast}</div>}
  </div>;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [setup, setSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    async function load() {
      try {
        const status = await api('/setup/status');
        if (!active) return;
        setSetup(status.needsSetup);
        try {
          const current = await api('/auth/me');
          if (active) { setCsrf(current.csrfToken); setSession(current); }
        } catch (err) { if (err.status !== 401) throw err; }
      } catch (err) { if (active) setError(err.message); }
      finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [retry]);
  function authenticated(current) { setCsrf(current.csrfToken); setSession(current); setSetup(false); }
  // Una referencia estable evita reiniciar la consulta del directorio en cada render.
  const loggedOut = useRef(() => { setCsrf(null); setSession(null); }).current;
  if (loading) return <main className="start-screen"><Brand /><LoaderCircle className="spin" size={29} /><p>Preparando tu espacio…</p></main>;
  if (error) return <main className="start-screen"><Brand /><div className="connection-card"><AlertCircle size={29} /><h1>No pudimos conectar</h1><p>{error}</p><button className="button button-primary" onClick={() => setRetry(value => value + 1)}><RefreshCw size={17} />Volver a intentar</button></div></main>;
  return session ? <Workspace user={session.user} onLogout={loggedOut} onUserChanged={authenticated} /> : <Auth setup={setup} onAuthenticated={authenticated} />;
}
