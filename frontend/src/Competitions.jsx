import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Eye, LoaderCircle, Pencil, Plus, RefreshCw, Search, Trophy, X } from 'lucide-react';
import { api } from './api.js';

export const resourceNames = { disciplinas: 'Disciplinas', torneos: 'Torneos', hackatones: 'Hackatones', participantes: 'Participantes', equipos: 'Equipos', inscripciones: 'Inscripciones' };
const singular = { disciplinas: 'disciplina', torneos: 'torneo', hackatones: 'hackatón', participantes: 'participante', equipos: 'equipo', inscripciones: 'inscripción' };
const labels = { activo: 'Activo', inactivo: 'Inactivo', borrador: 'Borrador', inscripciones: 'Inscripciones abiertas', en_curso: 'En curso', finalizado: 'Finalizado', cancelado: 'Cancelado', entrega: 'Entrega de proyectos', evaluacion: 'Evaluación', publicado: 'Publicado', equipo: 'Equipo', individual: 'Individual', relevo: 'Relevo', liga: 'Liga', grupos: 'Grupos', eliminacion: 'Eliminación', pruebas: 'Pruebas', rondas: 'Rondas', intercolegiados: 'Intercolegiados', universitario: 'Universitario', deportivo: 'Deportivo', tecnologico: 'Tecnológico', cualquiera: 'Sin restricción', femenino: 'Femenino', masculino: 'Masculino', otro: 'Otro', presencial: 'Presencial', virtual: 'Virtual', hibrida: 'Híbrida', ascendente: 'Menor resultado primero', descendente: 'Mayor resultado primero', goles: 'Goles', puntos: 'Puntos', sets: 'Sets', tiempo: 'Tiempo', distancia: 'Distancia', otra: 'Otra', confirmada: 'Confirmada' };
const empty = { items: [], total: 0, pages: 1, summary: { total: 0, active: 0 } };
const catalogsEmpty = { instituciones: [], disciplinas: [], usuarios: [], participantes: [], equipos: [], torneos: [], hackatones: [] };
const fields = {
  disciplinas: ['nombre', 'modalidades', 'formatos', 'categorias', 'estado'],
  torneos: ['nombre', 'descripcion', 'tipo', 'disciplina', 'categoria', 'unidadInscripcion', 'formato', 'ciudad', 'departamento', 'inicio', 'fin', 'inscripcionInicio', 'inscripcionFin', 'cupos', 'responsable', 'reglamento'],
  hackatones: ['nombre', 'descripcion', 'ciudad', 'departamento', 'modalidad', 'inicio', 'fin', 'inscripcionInicio', 'inscripcionFin', 'entregaInicio', 'entregaFin', 'evaluacionInicio', 'evaluacionFin', 'cupos', 'integrantesMin', 'integrantesMax', 'proyectosPorEquipo', 'categorias', 'requisitos', 'responsable'],
  participantes: ['documento', 'nombre', 'nacimiento', 'genero', 'usuario', 'institucion', 'categoria', 'estado'],
  equipos: ['nombre', 'tipo', 'responsable', 'estado', 'institucion', 'disciplina', 'categoria', 'modalidad', 'hackaton', 'categoriaTecnologica', 'integrantes'],
  inscripciones: ['torneo', 'modalidad', 'competidor', 'prueba'],
};
const ruleFields = ['integrantesMin', 'integrantesMax', 'maxInscripciones', 'metrica', 'unidad', 'precision', 'orden', 'fases', 'avance', 'desempates', 'pruebas', 'requisitos', 'permiteMultiplesEquipos'];
const dateFields = ['inicio', 'fin', 'inscripcionInicio', 'inscripcionFin', 'entregaInicio', 'entregaFin', 'evaluacionInicio', 'evaluacionFin'];
const pick = (item, keys) => Object.fromEntries(keys.filter(key => item[key] !== undefined).map(key => [key, item[key]]));
const lines = value => value.split('\n').map(item => item.trim()).filter(Boolean);
function localDate(value) { if (!value) return ''; const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
const readableDate = value => value ? new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha';
const nameOf = (list, id) => list.find(item => item.id === id)?.nombre || 'Registro no disponible';
function eventStatus(item) { if (item.estado !== 'inscripciones') return labels[item.estado]; const now = Date.now(); return now < Date.parse(item.inscripcionInicio) ? 'Inscripciones próximas' : now > Date.parse(item.inscripcionFin) ? 'Inscripciones cerradas' : 'Inscripciones abiertas'; }
function canEdit(type, item, user) { if (user.rol === 'administrador') return true; if (['torneos', 'hackatones'].includes(type)) return user.rol === 'organizador' && item.responsable === user.id; if (type === 'participantes') return user.rol === 'organizador' && item.creadoPor === user.id; if (type === 'equipos') return item.responsable === user.id || user.rol === 'organizador' && item.creadoPor === user.id; return false; }
function canCreate(type, user) { if (['disciplinas', 'hackatones'].includes(type)) return user.rol === 'administrador'; if (['torneos', 'participantes'].includes(type)) return ['administrador', 'organizador'].includes(user.rol); return ['administrador', 'organizador', 'participante'].includes(user.rol); }
function initial(type, item, user) {
  const common = { nombre: '', estado: 'activo', responsable: user.id };
  const defaults = {
    disciplinas: { ...common, modalidades: [], formatos: [], categorias: [{ nombre: '', edadMin: '', edadMax: '', genero: 'cualquiera' }] },
    torneos: { ...common, descripcion: '', tipo: 'intercolegiados', disciplina: '', categoria: '', unidadInscripcion: '', formato: '', ciudad: '', departamento: '', inicio: '', fin: '', inscripcionInicio: '', inscripcionFin: '', cupos: '', reglamento: { integrantesMin: '', integrantesMax: '', maxInscripciones: 1, metrica: 'puntos', unidad: '', precision: 0, orden: 'descendente', fases: [], avance: '', desempates: [], pruebas: [], requisitos: '', permiteMultiplesEquipos: false } },
    hackatones: { ...common, descripcion: '', modalidad: 'presencial', ciudad: '', departamento: '', inicio: '', fin: '', inscripcionInicio: '', inscripcionFin: '', entregaInicio: '', entregaFin: '', evaluacionInicio: '', evaluacionFin: '', cupos: '', integrantesMin: '', integrantesMax: '', proyectosPorEquipo: 1, categorias: [], requisitos: '' },
    participantes: { ...common, documento: '', nacimiento: '', genero: 'otro', usuario: '', institucion: '', categoria: '' },
    equipos: { ...common, tipo: 'deportivo', institucion: '', disciplina: '', categoria: '', modalidad: '', hackaton: '', categoriaTecnologica: '', integrantes: [] },
    inscripciones: { torneo: '', modalidad: '', competidor: '', prueba: '' },
  };
  if (!item) return defaults[type];
  const form = { ...defaults[type], ...pick(item, fields[type]) };
  if (type === 'torneos') form.reglamento = pick(item.reglamento, ruleFields);
  if (type === 'disciplinas') form.categorias = item.categorias.map(cat => ({ ...cat, edadMin: cat.edadMin ?? '', edadMax: cat.edadMax ?? '' }));
  if (type === 'participantes') form.nacimiento = item.nacimiento.slice(0, 10);
  for (const key of dateFields) if (form[key]) form[key] = localDate(form[key]);
  return form;
}
function Notice({ children }) { return children && <div className="error-notice" role="alert"><AlertCircle size={18} /><span>{children}</span></div>; }
function Field({ label, value, onChange, type = 'text', required = true, ...props }) { return <label>{label}<input type={type} value={value ?? ''} onChange={event => onChange(event.target.value)} required={required} {...props} /></label>; }
function Select({ label, value, onChange, options, required = true, ...props }) { return <label>{label}<select value={value || ''} onChange={event => onChange(event.target.value)} required={required} {...props}><option value="">Selecciona una opción</option>{options.map(item => <option key={item.id ?? item} value={item.id ?? item} disabled={item.disabled}>{item.nombre ?? labels[item] ?? item}</option>)}</select></label>; }
function TextArea({ label, value, onChange, required = false, ...props }) { return <label>{label}<textarea value={value || ''} onChange={event => onChange(event.target.value)} required={required} rows={3} maxLength={2000} {...props} /></label>; }
function Checks({ label, values, options, onChange }) { return <fieldset className="choice-field"><legend>{label}</legend><div className="choice-options">{options.map(option => <label key={option}><input type="checkbox" checked={values.includes(option)} onChange={event => onChange(event.target.checked ? [...values, option] : values.filter(value => value !== option))} />{labels[option]}</label>)}</div></fieldset>; }

function ResourceForm({ type, item, catalogs, user, onClose, onSaved, onLogout }) {
  const dialog = useRef(null);
  const [form, setForm] = useState(() => initial(type, item, user));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { dialog.current.showModal(); }, []);
  const set = (key, value) => setForm(old => {
    const next = { ...old, [key]: value };
    if (key === 'disciplina') Object.assign(next, { categoria: '', modalidad: '', unidadInscripcion: '', formato: '' });
    if (key === 'hackaton') next.categoriaTecnologica = '';
    if (key === 'tipo' && type === 'equipos') Object.assign(next, { institucion: '', disciplina: '', categoria: '', modalidad: '', hackaton: '', categoriaTecnologica: '' });
    if (key === 'unidadInscripcion' && value === 'individual') next.reglamento = { ...old.reglamento, integrantesMin: 1, integrantesMax: 1 };
    if (key === 'torneo') { const event = catalogs.torneos.find(t => t.id === value); Object.assign(next, { modalidad: event?.unidadInscripcion || '', competidor: '', prueba: '' }); }
    return next;
  });
  const rule = (key, value) => setForm(old => ({ ...old, reglamento: { ...old.reglamento, [key]: value } }));
  const field = (key, label, options = {}) => <Field label={label} value={form[key]} onChange={value => set(key, value)} {...options} />;
  const select = (key, label, options, props = {}) => <Select label={label} value={form[key]} onChange={value => set(key, value)} options={options} {...props} />;
  const available = (list, key) => list.map(record => ({ ...record, nombre: `${record.nombre}${record.estado === 'inactivo' ? ' (inactivo)' : ''}`, disabled: record.estado === 'inactivo' && form[key] !== record.id }));
  const discipline = catalogs.disciplinas.find(d => d.id === form.disciplina);
  const hack = catalogs.hackatones.find(h => h.id === form.hackaton);
  const event = catalogs.torneos.find(t => t.id === form.torneo);
  const locked = type === 'torneos' && item && item.estado !== 'borrador';
  const owners = catalogs.usuarios.filter(u => ['administrador', 'organizador', ...(type === 'equipos' ? ['participante'] : [])].includes(u.rol) && (user.rol !== 'organizador' || type === 'equipos' || u.id === user.id) && (user.rol !== 'participante' || u.id === user.id));
  const competitors = !event ? [] : event.unidadInscripcion === 'individual' ? catalogs.participantes.filter(p => p.estado === 'activo' && (user.rol === 'administrador' || event.responsable === user.id || p.usuario === user.id)) : catalogs.equipos.filter(t => t.tipo === 'deportivo' && t.estado === 'activo' && t.disciplina === event.disciplina && t.categoria === event.categoria && t.modalidad === event.unidadInscripcion && (user.rol === 'administrador' || event.responsable === user.id || t.responsable === user.id));
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const body = pick(form, fields[type]);
      if (type === 'hackatones') body.categorias = lines(body.categorias.join('\n'));
      if (type === 'torneos') body.reglamento = { ...body.reglamento, ...Object.fromEntries(['fases', 'desempates', 'pruebas'].map(key => [key, lines(body.reglamento[key].join('\n'))])) };
      for (const key of dateFields) if (body[key]) body[key] = new Date(body[key]).toISOString();
      if (type === 'equipos') { const omit = body.tipo === 'deportivo' ? ['hackaton', 'categoriaTecnologica'] : ['institucion', 'disciplina', 'categoria', 'modalidad']; omit.forEach(key => delete body[key]); }
      await api(`/${type}${item ? `/${item.id}` : ''}`, { method: item ? 'PATCH' : 'POST', body });
      onSaved(type === 'inscripciones' ? 'Inscripción confirmada.' : 'Información guardada.');
    } catch (err) { if (err.status === 401) onLogout(); else setError(err.message); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="institution-dialog resource-dialog" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} aria-labelledby="resource-form-title">
    <div className="dialog-heading"><span className="dialog-icon"><Trophy size={24} /></span><button className="icon-button" aria-label="Cerrar formulario" onClick={onClose} disabled={busy}><X size={20} /></button></div>
    <h2 id="resource-form-title">{item ? 'Editar' : type === 'inscripciones' ? 'Confirmar' : 'Crear'} {singular[type]}</h2>
    <p>{type === 'inscripciones' ? 'La plataforma comprobará requisitos, fechas y disponibilidad antes de confirmar.' : 'Completa los datos. Los campos y relaciones se validan al guardar.'}</p>
    <form onSubmit={submit}>
      {type !== 'inscripciones' && field('nombre', 'Nombre', { minLength: 2, maxLength: 100 })}
      {type === 'disciplinas' && <>
        <Checks label="Modalidades de participación" values={form.modalidades} options={['equipo', 'individual', 'relevo']} onChange={value => set('modalidades', value)} />
        <Checks label="Formatos de competencia" values={form.formatos} options={['liga', 'grupos', 'eliminacion', 'pruebas', 'rondas']} onChange={value => set('formatos', value)} />
        <fieldset className="form-section"><legend>Categorías</legend><p>La edad se comprueba en la fecha de inicio del torneo. Deja las edades vacías para una categoría sin límite.</p>
          {form.categorias.map((cat, index) => {
            const change = (key, value) => set('categorias', form.categorias.map((c, i) => i === index ? { ...c, [key]: value } : c));
            return <div className="category-row" key={cat.id || index}><Field label={`Categoría ${index + 1}`} value={cat.nombre} onChange={v => change('nombre', v)} minLength={2} maxLength={80} /><div className="form-row"><Field label={`Edad mínima ${index + 1}`} value={cat.edadMin} onChange={v => change('edadMin', v)} type="number" min={0} max={100} required={false} /><Field label={`Edad máxima ${index + 1}`} value={cat.edadMax} onChange={v => change('edadMax', v)} type="number" min={0} max={100} required={false} /></div><Select label={`Género de categoría ${index + 1}`} value={cat.genero} onChange={v => change('genero', v)} options={['cualquiera', 'femenino', 'masculino']} /><button type="button" className="button button-secondary" disabled={form.categorias.length === 1} onClick={() => set('categorias', form.categorias.filter((_, i) => i !== index))}>Retirar categoría {index + 1}</button></div>;
          })}<button type="button" className="button button-secondary" onClick={() => set('categorias', [...form.categorias, { nombre: '', edadMin: '', edadMax: '', genero: 'cualquiera' }])}><Plus size={15} />Agregar categoría</button>
        </fieldset>
      </>}
      {['torneos', 'hackatones'].includes(type) && <>
        <TextArea label="Descripción" value={form.descripcion} onChange={v => set('descripcion', v)} required={type === 'hackatones'} />
        {type === 'torneos' ? <>
          {select('tipo', 'Tipo de torneo', ['intercolegiados', 'universitario'])}
          <fieldset className="form-section" disabled={locked}><legend>Disciplina y formato</legend>{select('disciplina', 'Disciplina', available(catalogs.disciplinas, 'disciplina'))}{select('categoria', 'Categoría deportiva', discipline?.categorias || [])}<div className="form-row">{select('unidadInscripcion', 'Modalidad de inscripción', discipline?.modalidades || [])}{select('formato', 'Formato de competencia', discipline?.formatos || [])}</div></fieldset>
        </> : select('modalidad', 'Modalidad del hackatón', ['presencial', 'virtual', 'hibrida'])}
        <div className="form-row">{field('ciudad', 'Ciudad/municipio', { minLength: 2 })}{field('departamento', 'Departamento', { minLength: 2 })}</div>
        <fieldset className="form-section"><legend>Fechas y ventanas</legend><div className="form-row">{field('inscripcionInicio', 'Apertura de inscripciones', { type: 'datetime-local' })}{field('inscripcionFin', 'Cierre de inscripciones', { type: 'datetime-local' })}</div><div className="form-row">{field('inicio', 'Inicio del evento', { type: 'datetime-local' })}{field('fin', 'Fin del evento', { type: 'datetime-local' })}</div>
          {type === 'hackatones' && <><div className="form-row">{field('entregaInicio', 'Inicio de entregas', { type: 'datetime-local' })}{field('entregaFin', 'Fin de entregas', { type: 'datetime-local' })}</div><div className="form-row">{field('evaluacionInicio', 'Inicio de evaluación', { type: 'datetime-local' })}{field('evaluacionFin', 'Fin de evaluación', { type: 'datetime-local' })}</div></>}
        </fieldset>
        <div className="form-row">{field('cupos', type === 'hackatones' ? 'Cupos de equipos' : 'Cupos de inscripciones', { type: 'number', min: 1, max: 10000 })}{select('responsable', 'Responsable del evento', available(owners, 'responsable'))}</div>
        {type === 'hackatones' && <><div className="form-row">{field('integrantesMin', 'Integrantes mínimos', { type: 'number', min: 1, max: 100 })}{field('integrantesMax', 'Integrantes máximos', { type: 'number', min: 1, max: 100 })}</div>{field('proyectosPorEquipo', 'Proyectos por equipo', { type: 'number', min: 1, max: 10 })}<TextArea label="Categorías tecnológicas (una por línea)" value={form.categorias.join('\n')} onChange={v => set('categorias', v.split('\n'))} required /><TextArea label="Requisitos de participación" value={form.requisitos} onChange={v => set('requisitos', v)} /></>}
        {type === 'torneos' && <fieldset className="form-section" disabled={locked}><legend>Reglamento deportivo</legend><p>{locked ? 'El reglamento queda conservado al abrir inscripciones.' : 'Define las reglas de esta competencia antes de abrir las inscripciones.'}</p>
          <div className="form-row"><Field label="Integrantes mínimos" type="number" min={1} max={100} value={form.reglamento.integrantesMin} onChange={v => rule('integrantesMin', v)} disabled={form.unidadInscripcion === 'individual'} /><Field label="Integrantes máximos" type="number" min={1} max={100} value={form.reglamento.integrantesMax} onChange={v => rule('integrantesMax', v)} disabled={form.unidadInscripcion === 'individual'} /></div>
          <Field label="Inscripciones por competidor" type="number" min={1} max={30} value={form.reglamento.maxInscripciones} onChange={v => rule('maxInscripciones', v)} />
          <div className="form-row"><Select label="Métrica del resultado" value={form.reglamento.metrica} onChange={v => rule('metrica', v)} options={['goles', 'puntos', 'sets', 'tiempo', 'distancia', 'otra']} /><Field label="Unidad del resultado" value={form.reglamento.unidad} onChange={v => rule('unidad', v)} maxLength={40} /></div>
          <div className="form-row"><Field label="Decimales" type="number" min={0} max={6} value={form.reglamento.precision} onChange={v => rule('precision', v)} /><Select label="Orden de clasificación" value={form.reglamento.orden} onChange={v => rule('orden', v)} options={['ascendente', 'descendente']} /></div>
          <TextArea label="Fases o rondas (una por línea)" value={form.reglamento.fases.join('\n')} onChange={v => rule('fases', v.split('\n'))} required />
          <TextArea label="Criterios de avance" value={form.reglamento.avance} onChange={v => rule('avance', v)} required maxLength={1000} />
          <TextArea label="Desempates (uno por línea, en orden)" value={form.reglamento.desempates.join('\n')} onChange={v => rule('desempates', v.split('\n'))} required />
          <TextArea label="Pruebas (una por línea)" value={form.reglamento.pruebas.join('\n')} onChange={v => rule('pruebas', v.split('\n'))} required={form.formato === 'pruebas'} />
          <TextArea label="Requisitos de participación" value={form.reglamento.requisitos} onChange={v => rule('requisitos', v)} />
          <label className="check-label"><input type="checkbox" checked={form.reglamento.permiteMultiplesEquipos} onChange={e => rule('permiteMultiplesEquipos', e.target.checked)} />Permitir un integrante en varios equipos del torneo</label>
        </fieldset>}
      </>}
      {type === 'participantes' && <>
        <div className="form-row">{field('documento', 'Documento de identidad', { maxLength: 30 })}{field('nacimiento', 'Fecha de nacimiento', { type: 'date' })}</div>
        {select('genero', 'Género del participante', ['femenino', 'masculino', 'otro'])}
        {select('usuario', 'Cuenta de acceso del participante', available(catalogs.usuarios.filter(u => u.rol === 'participante'), 'usuario'))}
        {select('institucion', 'Institución', available(catalogs.instituciones, 'institucion'))}
        {field('categoria', 'Categoría de referencia', { maxLength: 80 })}
        <p className="form-help">La categoría de referencia ayuda a organizar el registro. La elegibilidad se verifica con las reglas de cada torneo.</p>
      </>}
      {type === 'equipos' && <>
        {select('tipo', 'Tipo de equipo', ['deportivo', 'tecnologico'], { disabled: Boolean(item) })}
        {select('responsable', 'Responsable del equipo', available(owners, 'responsable'))}
        {form.tipo === 'deportivo' ? <>{select('institucion', 'Institución', available(catalogs.instituciones, 'institucion'))}{select('disciplina', 'Disciplina', available(catalogs.disciplinas, 'disciplina'))}{select('categoria', 'Categoría deportiva', discipline?.categorias || [])}{select('modalidad', 'Modalidad del equipo', discipline?.modalidades.filter(m => m !== 'individual') || [])}</> : <>{select('hackaton', 'Hackatón de referencia', catalogs.hackatones.filter(h => !['cancelado', 'publicado'].includes(h.estado)))}{select('categoriaTecnologica', 'Categoría tecnológica', hack?.categorias || [])}<p className="form-help">{hack ? `Plantilla requerida: ${hack.integrantesMin} a ${hack.integrantesMax} integrantes. ` : ''}Crear el equipo todavía no lo inscribe en el hackatón.</p></>}
        <fieldset className="form-section"><legend>Integrantes ({form.integrantes.length})</legend><div className="member-options">{catalogs.participantes.filter(p => p.estado === 'activo' || form.integrantes.includes(p.id)).map(p => <label key={p.id} className="check-label"><input type="checkbox" checked={form.integrantes.includes(p.id)} onChange={e => set('integrantes', e.target.checked ? [...form.integrantes, p.id] : form.integrantes.filter(id => id !== p.id))} />{p.nombre}<small>{nameOf(catalogs.instituciones, p.institucion)}</small></label>)}{!catalogs.participantes.length && <p>Registra los participantes antes de agregar integrantes.</p>}</div></fieldset>
      </>}
      {type === 'inscripciones' && <>
        {select('torneo', 'Torneo', catalogs.torneos.filter(t => t.estado === 'inscripciones' && Date.now() >= Date.parse(t.inscripcionInicio) && Date.now() <= Date.parse(t.inscripcionFin)))}
        {event && <div className="form-hint">{labels[event.unidadInscripcion]} · {event.categoriaNombre} · {event.cupos} cupos de inscripciones · Cierre: {readableDate(event.inscripcionFin)}</div>}
        {select('competidor', event?.unidadInscripcion === 'individual' ? 'Participante' : 'Equipo o relevo', competitors)}
        {event?.reglamento.pruebas.length > 0 && select('prueba', 'Prueba', event.reglamento.pruebas)}
        {event && <p className="form-help">Plantilla: {event.reglamento.integrantesMin} a {event.reglamento.integrantesMax}. Límite: {event.reglamento.maxInscripciones} inscripciones por competidor. {event.reglamento.requisitos}</p>}
        {!competitors.length && event && <p className="form-help">No tienes competidores compatibles disponibles. Revisa los participantes o equipos registrados y su categoría.</p>}
      </>}
      {['disciplinas', 'participantes', 'equipos'].includes(type) && select('estado', 'Estado', ['activo', 'inactivo'])}
      <Notice>{error}</Notice>
      <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>Cancelar</button><button className="button button-primary" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}{type === 'inscripciones' ? 'Confirmar inscripción' : 'Guardar'}</button></div>
    </form>
  </dialog>;
}

function ResourceDetail({ type, item, catalogs, onClose }) {
  const ref = useRef(null); useEffect(() => { ref.current.showModal(); }, []);
  const row = (title, value) => <div><dt>{title}</dt><dd>{value ?? '—'}</dd></div>;
  const rules = item.reglamento;
  return <dialog ref={ref} className="institution-dialog resource-dialog detail-dialog" onCancel={e => { e.preventDefault(); onClose(); }} aria-labelledby="resource-detail-title"><div className="dialog-heading"><span className="dialog-icon"><Eye size={24} /></span><button className="icon-button" aria-label="Cerrar detalle" onClick={onClose}><X size={20} /></button></div><h2 id="resource-detail-title">{item.nombre || item.competidorNombre}</h2><p>{item.descripcion || `Detalle de ${singular[type]}`}</p><dl className="resource-details">
    {row('Estado', item.inicio ? eventStatus(item) : labels[item.estado] || item.estado)}
    {item.tipo && row('Tipo', labels[item.tipo])}
    {item.responsable && row('Responsable', item.responsableNombre || nameOf(catalogs.usuarios, item.responsable))}
    {item.institucion && row('Institución', item.institucionNombre || nameOf(catalogs.instituciones, item.institucion))}
    {item.disciplina && row('Disciplina', item.disciplinaNombre || nameOf(catalogs.disciplinas, item.disciplina))}
    {item.categoria && row('Categoría', item.categoriaNombre || item.categoria)}
    {item.modalidad && row('Modalidad', labels[item.modalidad])}
    {item.ciudad && row('Ubicación', `${item.ciudad}, ${item.departamento}`)}
    {item.inicio && <>{row('Inicio', readableDate(item.inicio))}{row('Fin', readableDate(item.fin))}{row('Ventana de inscripción', `${readableDate(item.inscripcionInicio)} — ${readableDate(item.inscripcionFin)}`)}{row('Cupos', type === 'torneos' ? `${item.inscritos} confirmadas / ${item.cupos} inscripciones` : `${item.cupos} equipos`)}{type === 'hackatones' && <>{row('Ventana de entrega', `${readableDate(item.entregaInicio)} — ${readableDate(item.entregaFin)}`)}{row('Ventana de evaluación', `${readableDate(item.evaluacionInicio)} — ${readableDate(item.evaluacionFin)}`)}{row('Plantilla', `${item.integrantesMin} a ${item.integrantesMax} integrantes`)}{row('Proyectos por equipo', item.proyectosPorEquipo)}{row('Categorías tecnológicas', item.categorias.join(', '))}{row('Requisitos', item.requisitos || 'Sin requisitos adicionales')}</>}</>}
    {type === 'disciplinas' && <>{row('Modalidades', item.modalidades.map(m => labels[m]).join(', '))}{row('Formatos', item.formatos.map(m => labels[m]).join(', '))}{item.categorias.map(cat => <div key={cat.id}><dt>{cat.nombre}</dt><dd>Edad: {cat.edadMin ?? 'sin mínimo'} a {cat.edadMax ?? 'sin máximo'} · {labels[cat.genero]}</dd></div>)}</>}
    {type === 'participantes' && <>{row('Documento', item.documento)}{row('Nacimiento', item.nacimiento.slice(0, 10))}{row('Género', labels[item.genero])}{row('Cuenta de acceso', item.usuarioNombre)}</>}
    {type === 'equipos' && <>{item.hackaton && row('Hackatón de referencia', item.hackatonNombre)}{item.categoriaTecnologica && row('Categoría tecnológica', item.categoriaTecnologica)}{row('Integrantes', item.integrantes.map(id => nameOf(catalogs.participantes, id)).join(', ') || 'Sin integrantes')}</>}
    {type === 'inscripciones' && <>{row('Torneo', item.torneoNombre)}{row('Prueba', item.prueba || 'Competencia general')}{row('Confirmada el', readableDate(item.createdAt))}{row('Plantilla confirmada', item.plantilla.map(p => p.nombre).join(', '))}{row('Versión del reglamento', item.reglamentoVersion)}</>}
  </dl>{rules && <section className="rules-detail"><h3>Reglamento · versión {item.reglamentoVersion}</h3><dl className="resource-details">{row('Modalidad y formato', `${labels[item.unidadInscripcion]} · ${labels[item.formato]}`)}{row('Elegibilidad', `Edad: ${rules.edadMin ?? 'sin mínimo'} a ${rules.edadMax ?? 'sin máximo'} · ${labels[rules.genero]}`)}{row('Plantilla', `${rules.integrantesMin} a ${rules.integrantesMax} integrantes`)}{row('Inscripciones por competidor', rules.maxInscripciones)}{row('Resultado', `${labels[rules.metrica]} · ${rules.unidad} · ${rules.precision} decimales`)}{row('Orden', labels[rules.orden])}{row('Fases', rules.fases.join(' → '))}{row('Avance', rules.avance)}{row('Desempates', rules.desempates.join(' → '))}{row('Pruebas', rules.pruebas.join(', ') || 'Competencia general')}{row('Requisitos', rules.requisitos || 'Sin requisitos adicionales')}{row('Participación en varios equipos', rules.permiteMultiplesEquipos ? 'Permitida' : 'Un solo equipo por torneo')}</dl></section>}<div className="dialog-actions"><button className="button button-secondary" onClick={onClose}>Cerrar detalle</button></div></dialog>;
}

export function ResourcePanel({ type, user, onLogout }) {
  const [data, setData] = useState(empty), [catalogs, setCatalogs] = useState(catalogsEmpty);
  const [query, setQuery] = useState(''), [debounced, setDebounced] = useState(''), [filters, setFilters] = useState({}), [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true), [catalogReady, setCatalogReady] = useState(false), [error, setError] = useState(''), [form, setForm] = useState(null), [detail, setDetail] = useState(null), [toast, setToast] = useState(''), [publishing, setPublishing] = useState('');
  useEffect(() => { const timer = setTimeout(() => { setDebounced(query); setPage(1); }, 250); return () => clearTimeout(timer); }, [query]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setCatalogReady(false);
    const params = new URLSearchParams({ page, limit: 8, q: debounced, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
    Promise.all([api(`/${type}?${params}`, { signal: controller.signal }), api('/catalogos', { signal: controller.signal })]).then(([list, catalogs]) => { setData(list); setCatalogs(catalogs); setCatalogReady(true); }).catch(err => { if (err.name === 'AbortError') return; if (err.status === 401) onLogout(); else setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [type, debounced, filters, page, refresh, onLogout]);
  const filter = (key, value) => { setFilters(old => ({ ...old, [key]: value })); setPage(1); };
  function saved(message) { setForm(null); setToast(message); setRefresh(v => v + 1); }
  async function publish(item) { setPublishing(item.id); setError(''); try { await api(`/${type}/${item.id}/estado`, { method: 'PATCH', body: { estado: 'inscripciones' } }); saved('Inscripciones abiertas.'); } catch (err) { setError(err.message); } finally { setPublishing(''); } }
  const isEvent = ['torneos', 'hackatones'].includes(type);
  const states = type === 'torneos' ? ['borrador', 'inscripciones', 'en_curso', 'finalizado', 'cancelado'] : type === 'hackatones' ? ['borrador', 'inscripciones', 'entrega', 'evaluacion', 'publicado', 'cancelado'] : ['activo', 'inactivo'];
  const descriptions = { disciplinas: 'Un catálogo para todos los deportes, con sus categorías y formatos.', torneos: 'Organiza competencias y consulta sus fechas, cupos y reglamentos.', hackatones: 'Innovación, equipos y requisitos en un espacio propio.', participantes: 'Personas, instituciones y datos necesarios para competir.', equipos: 'Equipos deportivos y tecnológicos con sus responsables e integrantes.', inscripciones: 'Participación deportiva confirmada con requisitos y cupos verificados.' };
  const secondary = item => type === 'disciplinas' ? item.modalidades.map(m => labels[m]).join(' · ') : type === 'participantes' ? `${item.institucionNombre} · ${item.categoria}` : type === 'equipos' ? `${labels[item.tipo]} · ${item.institucionNombre || item.hackatonNombre}` : type === 'inscripciones' ? `${item.torneoNombre} · ${item.prueba || labels[item.modalidad]}` : '';
  return <>
    <div className="page-heading"><div><span className="eyebrow">GESTIÓN DE COMPETENCIAS</span><h1>{resourceNames[type]}</h1><p className="page-description">{descriptions[type]}</p></div>{canCreate(type, user) && <button className="button button-primary" disabled={!catalogReady} onClick={() => setForm({ item: null })}><Plus size={18} />{type === 'inscripciones' ? 'Nueva inscripción' : `Crear ${singular[type]}`}</button>}</div>
    <section className="resource-summary"><div><Trophy size={23} /><span>{isEvent ? 'Eventos disponibles para tu cuenta' : 'Registros disponibles para tu cuenta'}<strong>{loading ? '—' : data.summary.total}</strong></span></div><div><Check size={23} /><span>{isEvent ? 'En etapa de inscripciones' : type === 'inscripciones' ? 'Confirmadas' : 'Activos'}<strong>{loading ? '—' : data.summary.active}</strong></span></div></section>
    <section className="directory-card"><div className="directory-title"><div><h2>{isEvent ? 'Explora los eventos' : `Directorio de ${resourceNames[type].toLowerCase()}`}</h2><p>{isEvent ? 'Abre el detalle para conocer las condiciones de participación.' : 'Consulta la información y gestiona tus registros autorizados.'}</p></div><span className="records-label">{data.total} registros</span></div>
      <div className="toolbar resource-toolbar">
        {type !== 'inscripciones' && <label className="search-box"><Search size={18} /><input aria-label={`Buscar ${type}`} placeholder="Buscar por nombre…" value={query} onChange={e => setQuery(e.target.value)} /></label>}
        {type !== 'inscripciones' && <select aria-label="Filtrar por estado" value={filters.estado || ''} onChange={e => filter('estado', e.target.value)}><option value="">Todos los estados</option>{states.map(s => <option key={s} value={s}>{labels[s]}</option>)}</select>}
        {['torneos', 'equipos'].includes(type) && <select aria-label="Filtrar por tipo" value={filters.tipo || ''} onChange={e => filter('tipo', e.target.value)}><option value="">Todos los tipos</option>{(type === 'torneos' ? ['intercolegiados', 'universitario'] : ['deportivo', 'tecnologico']).map(t => <option key={t} value={t}>{labels[t]}</option>)}</select>}
        {type === 'torneos' && <><select aria-label="Filtrar por disciplina" value={filters.disciplina || ''} onChange={e => { setFilters(old => ({ ...old, disciplina: e.target.value, categoria: '' })); setPage(1); }}><option value="">Todas las disciplinas</option>{catalogs.disciplinas.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select>{filters.disciplina && <select aria-label="Filtrar por categoría deportiva" value={filters.categoria || ''} onChange={e => filter('categoria', e.target.value)}><option value="">Todas las categorías</option>{catalogs.disciplinas.find(d => d.id === filters.disciplina)?.categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>}</>}
        {type === 'hackatones' && <select aria-label="Filtrar por categoría tecnológica" value={filters.categoria || ''} onChange={e => filter('categoria', e.target.value)}><option value="">Todas las categorías</option>{[...new Set(catalogs.hackatones.flatMap(h => h.categorias))].map(c => <option key={c} value={c}>{c}</option>)}</select>}
        {type === 'participantes' && <><select aria-label="Filtrar por institución" value={filters.institucion || ''} onChange={e => filter('institucion', e.target.value)}><option value="">Todas las instituciones</option>{catalogs.instituciones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select><input className="category-filter" aria-label="Filtrar categoría de referencia" placeholder="Categoría exacta" value={filters.categoria || ''} onChange={e => filter('categoria', e.target.value)} /></>}
        {type === 'inscripciones' && <select aria-label="Filtrar por torneo" value={filters.torneo || ''} onChange={e => filter('torneo', e.target.value)}><option value="">Todos los torneos</option>{catalogs.torneos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>}
        <button className="icon-button refresh-button" aria-label={`Actualizar ${type}`} onClick={() => setRefresh(v => v + 1)} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /></button>
      </div><Notice>{error}</Notice>
      {loading ? <div className="loading-area" role="status"><LoaderCircle className="spin" size={24} />Cargando {resourceNames[type].toLowerCase()}…</div> : error ? <div className="empty-state"><h3>No pudimos cargar la información</h3><p>Actualiza para volver a intentar.</p></div> : !data.items.length ? <div className="empty-state"><Trophy size={35} /><h3>No hay registros para mostrar</h3><p>{Object.values(filters).some(Boolean) || query ? 'Cambia la búsqueda o los filtros.' : 'Los registros disponibles aparecerán aquí.'}</p></div> : isEvent ? <div className="event-grid">{data.items.map(item => <article className="event-card" key={item.id}><div className="event-card-top"><span className="event-symbol"><Trophy size={23} /></span><span className={`badge ${item.estado === 'inscripciones' ? 'badge-active' : 'badge-inactive'}`}>{eventStatus(item)}</span></div><span className="eyebrow">{type === 'torneos' ? `${labels[item.tipo]} · ${item.disciplinaNombre}` : labels[item.modalidad]}</span><h3>{item.nombre}</h3><p>{item.descripcion || 'Consulta los requisitos de este evento.'}</p><div className="event-meta"><span>{item.ciudad}, {item.departamento}</span><span>Inicio: {readableDate(item.inicio)}</span><span>{type === 'torneos' ? `${item.inscritos} / ${item.cupos} inscripciones` : `${item.cupos} equipos · ${item.integrantesMin}–${item.integrantesMax} integrantes`}</span></div><div className="event-actions"><button className="button button-secondary" aria-label={`Ver ${item.nombre}`} onClick={() => setDetail(item)}><Eye size={15} />Ver requisitos</button>{canEdit(type, item, user) && <><button className="icon-button edit-button" aria-label={`Editar ${item.nombre}`} onClick={() => setForm({ item })}><Pencil size={16} /></button>{item.estado === 'borrador' && <button className="button button-primary" disabled={Boolean(publishing)} onClick={() => publish(item)}>{publishing === item.id ? <LoaderCircle size={15} className="spin" /> : 'Abrir inscripciones'}</button>}</>}</div></article>)}</div> : <div className="table-scroll"><table><thead><tr><th>{type === 'inscripciones' ? 'Competidor' : 'Nombre'}</th><th>Referencia</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{data.items.map(item => <tr key={item.id}><td><strong>{item.nombre || item.competidorNombre}</strong></td><td><span className="resource-reference">{secondary(item)}</span></td><td><span className={`badge ${['activo', 'confirmada'].includes(item.estado) ? 'badge-active' : 'badge-inactive'}`}>{labels[item.estado]}</span></td><td><div className="row-actions"><button className="icon-button" aria-label={`Ver ${item.nombre || item.competidorNombre}`} onClick={() => setDetail(item)}><Eye size={17} /></button>{type !== 'inscripciones' && canEdit(type, item, user) && <button className="icon-button edit-button" aria-label={`Editar ${item.nombre}`} onClick={() => setForm({ item })}><Pencil size={16} /></button>}</div></td></tr>)}</tbody></table></div>}
      <div className="table-footer"><span>{data.total ? `Página ${page} de ${data.pages}` : 'Sin registros'}</span><div><button className="pagination-button" aria-label="Página anterior" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={17} /></button><button className="pagination-button" aria-label="Página siguiente" disabled={loading || page >= data.pages} onClick={() => setPage(p => p + 1)}><ChevronRight size={17} /></button></div></div>
    </section>
    {form && <ResourceForm type={type} item={form.item} catalogs={catalogs} user={user} onClose={() => setForm(null)} onSaved={saved} onLogout={onLogout} />}
    {detail && <ResourceDetail type={type} item={detail} catalogs={catalogs} onClose={() => setDetail(null)} />}
    {toast && <div className="toast" role="status"><Check size={18} />{toast}</div>}
  </>;
}
