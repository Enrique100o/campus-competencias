import { useState } from "react";
import {
  Building2,
  Users,
  UserRound,
  Trophy,
  Medal,
  Code2,
  ClipboardCheck,
  MapPin,
  CalendarDays,
  History,
  ShieldCheck,
  Menu,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { api } from "../../api.js";
import { Brand } from "../../components/ui/Brand.jsx";
import { Notice } from "../../components/ui/Fields.jsx";
import { ProfilePanel } from "../accounts/ProfilePanel.jsx";
import { UsersPanel } from "../accounts/UsersPanel.jsx";
import { InstitutionsPanel } from "../institutions/InstitutionsPanel.jsx";
import { ResourcePanel } from "../competitions/ResourcePanel.jsx";

import { VenuesPanel } from "../venues/VenuesPanel.jsx";
import { SportsPanel } from "../sports/SportsPanel.jsx";
import { RegistrationsPanel } from "../registrations/RegistrationsPanel.jsx";
import { HackathonPanel } from "../hackathons/HackathonPanel.jsx";
import { AuditPanel } from "../audit/AuditPanel.jsx";

const roles = {
  administrador: "Administrador",
  organizador: "Organizador",
  participante: "Participante",
  jurado: "Jurado",
};
const managerRoles = ["administrador", "organizador"];
const navigation = [
  { key: "instituciones", title: "Instituciones", icon: Building2 },
  { key: "usuarios", title: "Usuarios", icon: Users, roles: ["administrador"] },
  { key: "disciplinas", title: "Disciplinas", icon: Medal },
  { key: "escenarios", title: "Escenarios", icon: MapPin },
  { key: "torneos", title: "Torneos", icon: Trophy },
  { key: "hackatones", title: "Hackatones", icon: Code2 },
  {
    key: "participantes",
    title: "Participantes",
    icon: UserRound,
    roles: ["administrador", "organizador", "participante"],
  },
  {
    key: "equipos",
    title: "Equipos",
    icon: Users,
    roles: ["administrador", "organizador", "participante"],
  },
  {
    key: "inscripciones",
    title: "Inscripciones",
    icon: ClipboardCheck,
    roles: ["administrador", "organizador", "participante"],
  },
  { key: "agenda", title: "Agenda y resultados", icon: CalendarDays },
  { key: "proyectos", title: "Proyectos y evaluación", icon: Code2 },
  { key: "historial", title: "Historial", icon: History, roles: managerRoles },
  { key: "perfil", title: "Mi perfil", icon: UserRound },
];

// El menú refleja el rol actual. La autorización real se repite en todos los endpoints del servidor.
export function Workspace({ user, onLogout, onUserChanged }) {
  const [view, setView] = useState(
      user.rol === "jurado" ? "proyectos" : "torneos",
    ),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const visible = navigation.filter(
    (item) => !item.roles || item.roles.includes(user.rol),
  );
  const selected =
    visible.find((item) => item.key === view) ||
    visible.find((item) => item.key === "perfil");
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api("/auth/logout", { method: "POST", body: {} });
      onLogout();
    } catch (e) {
      if (e.status === 401) onLogout();
      else setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function screen() {
    const key = selected.key;
    if (key === "instituciones")
      return <InstitutionsPanel user={user} onLogout={onLogout} />;
    if (key === "usuarios")
      return (
        <UsersPanel
          user={user}
          onUserChanged={onUserChanged}
          onLogout={onLogout}
        />
      );
    if (key === "perfil")
      return (
        <ProfilePanel
          user={user}
          onUserChanged={onUserChanged}
          onLogout={onLogout}
        />
      );
    if (key === "escenarios") return <VenuesPanel user={user} />;
    if (key === "agenda") return <SportsPanel user={user} />;
    if (key === "proyectos") return <HackathonPanel user={user} />;
    if (key === "inscripciones")
      return <RegistrationsPanel user={user} onLogout={onLogout} />;
    if (key === "historial") return <AuditPanel />;
    return (
      <ResourcePanel key={key} type={key} user={user} onLogout={onLogout} />
    );
  }
  return (
    <div className="workspace">
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <Brand />
        <div className="sidebar-section-title">ESPACIO DE TRABAJO</div>
        <nav aria-label="Navegación principal">
          {visible.map(({ key, title, icon: Icon }) => (
            <button
              key={key}
              className={`nav-item ${selected.key === key ? "active" : ""}`}
              onClick={() => {
                setView(key);
                setOpen(false);
              }}
            >
              <Icon size={19} />
              <span>{title}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="avatar">
            {user.nombre
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </span>
          <div>
            <strong>{user.nombre}</strong>
            <small>{roles[user.rol]}</small>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menú"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>Campus</span>
            <ChevronRight size={14} />
            <strong>{selected.title}</strong>
          </div>
          <div className="topbar-right">
            <span className="access-label">
              <ShieldCheck size={15} />
              {roles[user.rol]}
            </span>
            <button className="logout-button" disabled={busy} onClick={logout}>
              <LogOut size={16} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </header>
        <main className="main-content">
          <Notice>{error}</Notice>
          {screen()}
        </main>
      </div>
    </div>
  );
}
