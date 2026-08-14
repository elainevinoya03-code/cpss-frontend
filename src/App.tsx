import { useState, useEffect, useRef } from "react";
import Login from "./pages/login";
import { Sidebar, Header } from "./components/layout";
import {
  Dashboard,
  UserManagement,
  IotProvisioning as Provisioning,
  CctvPlacement,
  DigitalBoundaries,
  PatrolConfiguration,
  SystemLogs,
  SystemSettings,
  DataRequests,
} from "./admin";
import {
  CaptainDashboard,
  LivePatrol,
  EmergencyBroadcast,
  IncidentArchive,
  CCTVEvidenceViewer,
  BulletinPublisher,
} from "./captain";
import {
  DeskOfficerDashboard,
  IotAlertCommandCenter,
  ActiveDispatches,
  PatrolSchedulerRoutes,
  DigitalBlotter,
  OperationsChatCenter,
} from "./desk_officer";
import {
  SurveillanceMatrix,
  ManualThreatFlags,
  EscalatedClipsDispatches,
  VideoArchivesPlayback,
} from "./cctv_operator";
import {
  PurokIncidentsQueue,
  CommunityBulletinBoard,
  EscalateToDeskOfficer,
  PurokDirectory,
  PurokIotAlerts,
} from "./purok_leader";
import { PurokIncidentsProvider } from "./purok_leader/incidentStore";

const ADMIN_NAV = ["dashboard", "users", "iot", "cctv", "boundaries", "patrol", "logs", "data_requests", "settings"];
const CAPTAIN_NAV = ["dashboard", "analytics", "broadcasts", "patrol", "evidence", "bulletins", "cases"];
const DESK_OFFICER_NAV = ["dashboard", "iot_alerts", "dispatches", "patrol", "blotter", "chat"];
const CCTV_OPERATOR_NAV = ["surveillance", "threat_flags", "escalated", "archives"];
const PUROK_LEADER_NAV = ["incidents", "bulletins", "escalate", "directory", "iot_alerts"];

function defaultNav(role) {
  if (role === "cctv_operator") return "surveillance";
  if (role === "purok_leader") return "incidents";
  return "dashboard";
}

function canAccess(role, key) {
  if (role === "captain") return CAPTAIN_NAV.includes(key);
  if (role === "desk_officer") return DESK_OFFICER_NAV.includes(key);
  if (role === "cctv_operator") return CCTV_OPERATOR_NAV.includes(key);
  if (role === "purok_leader") return PUROK_LEADER_NAV.includes(key);
  return ADMIN_NAV.includes(key);
}

const STORAGE_KEY = "bgyauth";

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.page && data.role) return data;
    }
  } catch {}
  return null;
}

function saveSession(page, role, activeNav, operatorName) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ page, role, activeNav, operatorName }));
}

function displayName(username, role) {
  if (role !== "cctv_operator") return username;
  if (username === "cctv") return "CO-01";
  return username
    .split(/[._\- ]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export default function App() {
  const saved = loadSession();
  const [page, setPage] = useState(saved?.page ?? "login");
  const [role, setRole] = useState(saved?.role ?? "admin");
  const [activeNav, setActiveNav] = useState(saved?.activeNav ?? "dashboard");
  const [operatorName, setOperatorName] = useState(saved?.operatorName ?? "CO-01");
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const navGuardRef = useRef<(() => boolean) | null>(null);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleLogin = (e, username = "") => {
    e.preventDefault();
    const validRole = username === "captain" ? "captain" : username.startsWith("desk") ? "desk_officer" : username.startsWith("cctv") ? "cctv_operator" : username.startsWith("purok") ? "purok_leader" : "admin";
    const nav = defaultNav(validRole);
    const name = displayName(username, validRole);
    setRole(validRole);
    setActiveNav(nav);
    setOperatorName(name);
    setPage("admin");
    saveSession("admin", validRole, nav, name);
  };

  const doNavigate = (key) => {
    setActiveNav(key);
    setPendingNav(null);
    saveSession(page, role, key, operatorName);
  };

  const handleNavigate = (key) => {
    if (!canAccess(role, key)) return;
    if (activeNav === key) return;
    if (navGuardRef.current && !navGuardRef.current()) {
      setPendingNav(key);
      return;
    }
    doNavigate(key);
  };

  const doLogout = () => {
    clearSession();
    setPendingNav(null);
    setPage("login");
    setRole("admin");
    setActiveNav("dashboard");
  };

  const handleLogout = () => {
    if (navGuardRef.current && !navGuardRef.current()) {
      setPendingNav("__logout__");
      return;
    }
    doLogout();
  };

  const handleDiscardNavigate = () => {
    const key = pendingNav;
    if (key === "__logout__") {
      doLogout();
      return;
    }
    if (key) doNavigate(key);
  };

  if (page === "login") {
    return <Login onLogin={handleLogin} />;
  }

  const currentInitials = role === "captain" ? "CA" : role === "desk_officer" ? "DO" : role === "cctv_operator" ? "CO" : role === "purok_leader" ? "PL" : "BA";
  const currentLabel = role === "captain" ? "Captain" : role === "desk_officer" ? "Desk Officer" : role === "cctv_operator" ? "CCTV Operator" : role === "purok_leader" ? "Purok Leader" : "System Admin";
  const currentSubLabel = role === "captain" ? "Patrol Lead" : role === "desk_officer" ? "Operations Desk" : role === "cctv_operator" ? "Surveillance Unit" : role === "purok_leader" ? "Community Lead" : "Barangay Admin";

  return (
    <PurokIncidentsProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar activeKey={activeNav} onNavigate={handleNavigate} collapsed={!sidebarOpen} role={role} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            onToggleSidebar={() => setSidebarOpen((o) => !o)}
            initials={currentInitials}
            label={currentLabel}
            sublabel={currentSubLabel}
            onLogout={handleLogout}
          />
          {role === "captain" ? (
            <>
              {activeNav === "dashboard" && <CaptainDashboard activeKey="dashboard" />}
              {activeNav === "analytics" && <CaptainDashboard activeKey="analytics" />}
              {activeNav === "broadcasts" && <EmergencyBroadcast />}
              {activeNav === "patrol" && <LivePatrol />}
              {activeNav === "evidence" && <CCTVEvidenceViewer />}
              {activeNav === "bulletins" && <BulletinPublisher />}
              {activeNav === "cases" && <IncidentArchive />}
            </>
          ) : role === "desk_officer" ? (
            <>
              {activeNav === "dashboard" && <DeskOfficerDashboard onNavigate={handleNavigate} />}
              {activeNav === "iot_alerts" && <IotAlertCommandCenter />}
              {activeNav === "dispatches" && <ActiveDispatches />}
              {activeNav === "patrol" && <PatrolSchedulerRoutes />}
              {activeNav === "blotter" && <DigitalBlotter />}
              {activeNav === "chat" && <OperationsChatCenter />}
            </>
          ) : role === "cctv_operator" ? (
            <>
              {activeNav === "surveillance" && <SurveillanceMatrix operatorName={operatorName} />}
              {activeNav === "threat_flags" && <ManualThreatFlags operatorName={operatorName} />}
              {activeNav === "escalated" && <EscalatedClipsDispatches operatorName={operatorName} />}
              {activeNav === "archives" && <VideoArchivesPlayback operatorName={operatorName} />}
            </>
          ) : role === "purok_leader" ? (
            <>
              {activeNav === "incidents" && <PurokIncidentsQueue />}
              {activeNav === "bulletins" && <CommunityBulletinBoard />}
              {activeNav === "escalate" && <EscalateToDeskOfficer />}
              {activeNav === "directory" && <PurokDirectory />}
              {activeNav === "iot_alerts" && <PurokIotAlerts />}
            </>
          ) : (
            <>
              {activeNav === "dashboard" && <Dashboard onNavigate={handleNavigate} />}
              {activeNav === "users" && <UserManagement />}
              {activeNav === "iot" && <Provisioning />}
              {activeNav === "cctv" && <CctvPlacement />}
              {activeNav === "boundaries" && <DigitalBoundaries />}
              {activeNav === "patrol" && (
                <PatrolConfiguration navGuardRef={navGuardRef} onDiscardNavigate={handleDiscardNavigate} />
              )}
              {activeNav === "logs" && <SystemLogs />}
              {activeNav === "data_requests" && <DataRequests />}
              {activeNav === "settings" && <SystemSettings />}
            </>
          )}
        </div>
      </div>
    </PurokIncidentsProvider>
  );
}
