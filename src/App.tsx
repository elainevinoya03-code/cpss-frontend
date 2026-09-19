import { useState, useEffect, useRef } from "react";
import Login from "./pages/login";
import OtpVerification from "./pages/otp";
import LandingPage from "./landing-page/LandingPage";
import { Sidebar, Header } from "./components/layout";
import {
  Dashboard,
  UserManagement,
  IotProvisioning as Provisioning,
  CctvPlacement,
  DigitalBoundaries,
  SystemLogs,
  SystemSettings,
  DataRequests,
  MassBroadcast,
} from "./admin";
import {
  CaptainDashboard,
  LivePatrol,
  EmergencyBroadcast,
  IncidentArchive,
  CCTVEvidenceViewer,
  BulletinPublisher,
  CheckpointPlans,
} from "./captain";
import {
  DeskOfficerDashboard,
  IncidentTriage,
  ActiveDispatches,
  DigitalBlotter,
  OperationsChatCenter,
  AlertManagement,
  CctvRequests,
} from "./desk_officer";
import {
  ChiefTanodDashboard,
  PatrolScheduling,
  CheckInOut,
  LiveTanodTracking,
  IncidentOversight,
  TeamPerformance,
  NeighborhoodWatchCoordination,
  ReportsAnalytics,
} from "./chief_tanod";
import {
  SurveillanceMatrix,
  RecordedFootageEvidence,
  CctvFootageRequests,
} from "./cctv_operator";
import {
  LocalReports,
  EscalatedCases,
  PurokAnnouncements,
  PurokContacts,
} from "./purok_leader";
import { ExOfficerDashboard } from "./ex_o";
import { PatrolConfiguration } from "./chief_tanod";
import { PurokIncidentsProvider } from "./purok_leader/incidentStore";


const ADMIN_NAV = ["dashboard", "users", "iot", "cctv", "boundaries", "broadcasts", "logs", "data_requests", "settings"];
const CAPTAIN_NAV = ["dashboard", "analytics", "broadcasts", "patrol", "checkpoint_plans", "evidence", "bulletins", "cases"];
const DESK_OFFICER_NAV = ["dashboard", "incident_triage", "alert_management", "dispatches", "blotter", "chat", "footage_requests"];
const CCTV_OPERATOR_NAV = ["surveillance", "recorded_footage", "footage_requests"];
const PUROK_LEADER_NAV = ["reports", "escalated", "announcements", "contacts"];
const CHIEF_TANOD_NAV = ["dashboard", "patrol_scheduling", "check_in_out", "checkpoint_planning", "live_tracking", "incidents", "team_performance", "neighborhood_watch", "reports_analytics"];
const TANOD_NAV = ["dashboard", "patrol_scheduling", "live_tracking", "incidents"];
const EX_O_NAV = ["dashboard", "patrol"];

function defaultNav(role) {
  if (role === "cctv_operator") return "surveillance";
  if (role === "purok_leader") return "reports";
  if (role === "chief_tanod") return "dashboard";
  if (role === "tanod") return "dashboard";
  if (role === "ex_o") return "dashboard";
  return "dashboard";
}

function canAccess(role, key) {
  if (role === "captain") return CAPTAIN_NAV.includes(key);
  if (role === "desk_officer") return DESK_OFFICER_NAV.includes(key);
  if (role === "cctv_operator") return CCTV_OPERATOR_NAV.includes(key);
  if (role === "purok_leader") return PUROK_LEADER_NAV.includes(key);
  if (role === "chief_tanod") return CHIEF_TANOD_NAV.includes(key);
  if (role === "tanod") {
    // Tanods cannot access check_in_out feature
    if (key === "check_in_out") return false;
    return TANOD_NAV.includes(key);
  }
  if (role === "ex_o") return EX_O_NAV.includes(key);
  return ADMIN_NAV.includes(key);
}

const STORAGE_KEY = "bgyauth";
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.page && data.role) {
        // Check if session has expired
        if (data.lastActivity && Date.now() - data.lastActivity > SESSION_TIMEOUT) {
          return null;
        }
        // Guard against stale purok-leader nav keys from before the streamlined prototype.
        if (data.role === "purok_leader" && !PUROK_LEADER_NAV.includes(data.activeNav)) return null;
        if (data.role === "tanod" && !TANOD_NAV.includes(data.activeNav)) return null;
        // If page is "login", migrate to "landing"
        if (data.page === "login") {
          data.page = "landing";
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
        return data;
      }
    }
  } catch {}
  return null;
}

function saveSession(page, role, activeNav, operatorName) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ page, role, activeNav, operatorName, lastActivity: Date.now() }));
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
  const [page, setPage] = useState(saved?.page ?? "landing");
  const [role, setRole] = useState(saved?.role ?? "admin");
  const [activeNav, setActiveNav] = useState(saved?.activeNav ?? "dashboard");
  const [operatorName, setOperatorName] = useState(saved?.operatorName ?? "CO-01");
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const navGuardRef = useRef<(() => boolean) | null>(null);
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingUserData, setPendingUserData] = useState<any>(null);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Session timeout logic
  useEffect(() => {
    if (page === "landing" || page === "login") return;

    const handleSessionTimeout = () => {
      clearSession();
      setPage("landing");
      setRole("admin");
      setActiveNav("dashboard");
      setPendingNav(null);
      setPendingUserData(null);
    };

    const resetActivityTimer = () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      activityTimeoutRef.current = setTimeout(() => {
        handleSessionTimeout();
      }, SESSION_TIMEOUT);
      
      // Update last activity in session storage
      const session = loadSession();
      if (session) {
        saveSession(session.page, session.role, session.activeNav, session.operatorName);
      }
    };

    const handleActivity = () => {
      resetActivityTimer();
    };

    // Track user activity
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity);

    // Initial timer setup
    resetActivityTimer();

    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
    };
  }, [page]);

  const handleLogin = (e, userData) => {
    e.preventDefault();
    // Store user data and redirect to OTP verification
    setPendingUserData(userData);
    setPage("otp");
  };

  const handleOtpVerify = (otp: string) => {
    // OTP verification successful, proceed with login
    const userData = pendingUserData;
    const backendRole = userData.role || "Resident";
    const roleMap = {
      "Admin": "admin",
      "Captain": "captain",
      "Desk Officer": "desk_officer",
      "CCTV Operator": "cctv_operator",
      "Chief Tanod": "chief_tanod",
      "Tanod": "tanod",
      "Purok Leader": "purok_leader",
      "Executive Officer": "ex_o",
      "Resident": "admin",
    };
    const validRole = roleMap[backendRole] || "admin";
    const nav = defaultNav(validRole);
    const name = userData.name || userData.email;
    setRole(validRole);
    setActiveNav(nav);
    setOperatorName(name);
    setPage("admin");
    setPendingUserData(null);
    saveSession("admin", validRole, nav, name);
  };

  const handleOtpBack = () => {
    // Go back to login page
    setPendingUserData(null);
    setPage("login");
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
    setPendingUserData(null);
    setPage("landing");
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

  if (page === "landing") {
    return <LandingPage onNavigateToLogin={() => setPage("login")} />;
  }

  if (page === "login") {
    return <Login onLogin={handleLogin} onNavigateToLanding={() => setPage("landing")} />;
  }

  if (page === "otp") {
    return (
      <OtpVerification
        onVerify={handleOtpVerify}
        onBack={handleOtpBack}
        userData={pendingUserData}
      />
    );
  }

  const currentInitials = role === "captain" ? "CA" : role === "desk_officer" ? "DO" : role === "cctv_operator" ? "CO" : role === "purok_leader" ? "PL" : role === "chief_tanod" ? "CT" : role === "tanod" ? "TA" : role === "ex_o" ? "EO" : "BA";
  const currentLabel = role === "captain" ? "Captain" : role === "desk_officer" ? "Desk Officer" : role === "cctv_operator" ? "CCTV Operator" : role === "purok_leader" ? "Purok Leader" : role === "chief_tanod" ? "Chief Tanod" : role === "tanod" ? "Tanod" : role === "ex_o" ? "Executive Officer" : "System Admin";
  const currentSubLabel = role === "captain" ? "Executive Oversight" : role === "desk_officer" ? "Operations Desk" : role === "cctv_operator" ? "Surveillance Unit" : role === "purok_leader" ? "Community Lead" : role === "chief_tanod" ? "Tanod Operations" : role === "tanod" ? "Field Operations" : role === "ex_o" ? "Executive Staff" : "Barangay Admin";

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
              {activeNav === "checkpoint_plans" && <CheckpointPlans />}
              {activeNav === "evidence" && <CCTVEvidenceViewer />}
              {activeNav === "bulletins" && <BulletinPublisher />}
              {activeNav === "cases" && <IncidentArchive />}
            </>
          ) : role === "desk_officer" ? (
            <>
              {activeNav === "dashboard" && <DeskOfficerDashboard onNavigate={handleNavigate} />}
              {activeNav === "incident_triage" && <IncidentTriage onNavigate={handleNavigate} />}
              {activeNav === "dispatches" && <ActiveDispatches />}
              {activeNav === "blotter" && <DigitalBlotter />}
              {activeNav === "chat" && <OperationsChatCenter />}
              {activeNav === "footage_requests" && <CctvRequests />}
              {activeNav === "alert_management" && <AlertManagement />}
            </>
          ) : role === "cctv_operator" ? (
            <>
              {activeNav === "surveillance" && <SurveillanceMatrix operatorName={operatorName} />}
              {activeNav === "recorded_footage" && <RecordedFootageEvidence operatorName={operatorName} />}
              {activeNav === "footage_requests" && <CctvFootageRequests operatorName={operatorName} />}
            </>
          ) : role === "purok_leader" ? (
            <>
              {activeNav === "reports" && <LocalReports />}
              {activeNav === "escalated" && <EscalatedCases />}
              {activeNav === "announcements" && <PurokAnnouncements />}
              {activeNav === "contacts" && <PurokContacts />}
            </>
          ) : role === "chief_tanod" ? (
            <>
              {activeNav === "dashboard" && <ChiefTanodDashboard onNavigate={handleNavigate} />}
              {activeNav === "patrol_scheduling" && <PatrolScheduling onNavigate={handleNavigate} role="chief_tanod" />}
              {activeNav === "check_in_out" && <CheckInOut onNavigate={handleNavigate} role="chief_tanod" />}
              {activeNav === "checkpoint_planning" && (
                <PatrolConfiguration onNavigate={handleNavigate} />
              )}
              {activeNav === "live_tracking" && <LiveTanodTracking onNavigate={handleNavigate} />}
              {activeNav === "incidents" && <IncidentOversight onNavigate={handleNavigate} />}
              {activeNav === "team_performance" && <TeamPerformance onNavigate={handleNavigate} />}
              {activeNav === "neighborhood_watch" && <NeighborhoodWatchCoordination onNavigate={handleNavigate} />}
              {activeNav === "reports_analytics" && <ReportsAnalytics onNavigate={handleNavigate} />}
            </>
          ) : role === "tanod" ? (
            <>
              {activeNav === "dashboard" && <ChiefTanodDashboard onNavigate={handleNavigate} />}
              {activeNav === "patrol_scheduling" && <PatrolScheduling onNavigate={handleNavigate} role="tanod" />}
              {activeNav === "live_tracking" && <LiveTanodTracking onNavigate={handleNavigate} />}
              {activeNav === "incidents" && <IncidentOversight onNavigate={handleNavigate} />}
            </>
          ) : role === "ex_o" ? (
            <>
              {activeNav === "dashboard" && <ExOfficerDashboard />}
              {activeNav === "patrol" && (
                <PatrolConfiguration />
              )}
            </>
          ) : (
            <>
              {activeNav === "dashboard" && <Dashboard onNavigate={handleNavigate} />}
              {activeNav === "users" && <UserManagement />}
              {activeNav === "iot" && <Provisioning />}
              {activeNav === "cctv" && <CctvPlacement />}
              {activeNav === "boundaries" && <DigitalBoundaries />}
              {activeNav === "broadcasts" && <MassBroadcast />}
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
