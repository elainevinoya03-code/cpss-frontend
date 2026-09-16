import { useState, useMemo, useEffect } from "react";
import {
  CalendarClock,
  UserCheck,
  UserX,
  Shield,
  Users,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { useToast } from "../hooks/useToast.tsx";
import Modal from "../components/ui/Modal";
import {
  getRoster,
  getTeams,
  getTodaySchedules,
  getOnDutyTanods,
  addCheckInOutRecord,
  updateCheckInOutRecord,
  usePatrolScheduleStore,
} from "./patrolScheduleStore";
import type {
  CheckInOutRecord,
  PatrolSchedule,
  PatrolTeam,
  RosterMember,
} from "./patrolScheduleShared";
import { getApprovedCheckpointPlans } from "./checkpointPlanStore";
import { formatDateTime, formatDay } from "./patrolShared";

interface CheckInOutProps {
  onNavigate?: (page: string) => void;
  role?: string;
}

function CheckInModal({
  schedule,
  team,
  roster,
  availableTanods,
  onClose,
  onConfirm,
}: {
  schedule: PatrolSchedule;
  team: PatrolTeam;
  roster: RosterMember[];
  availableTanods: RosterMember[];
  onClose: () => void;
  onConfirm: (data: {
    tanodId: string;
    photoEvidence?: string;
    notes?: string;
  }) => void;
}) {
  const [selectedTanod, setSelectedTanod] = useState<string>("");
  const [notes, setNotes] = useState("");
  const { flash } = useToast();

  const handleConfirm = () => {
    if (!selectedTanod) {
      flash("Please select a Tanod to check in", { type: "warning" });
      return;
    }
    onConfirm({
      tanodId: selectedTanod,
      notes: notes || undefined,
    });
  };

  const tanodName = (id: string) => roster.find((r) => r.id === id)?.name || id;

  return (
    <Modal
      onClose={onClose}
      title="Check-in Tanod"
      subtitle={`${schedule.code} · ${formatDay(schedule.startDate)}`}
      icon={<UserCheck size={18} />}
      iconClass="bg-emerald-100 text-emerald-600"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedTanod}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
          >
            <UserCheck size={13} /> Confirm Check-in
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Team Info */}
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <p className="text-[10px] font-medium tracking-wider text-stone-400">TEAM</p>
          <p className="mt-0.5 text-[12px] font-medium text-stone-800">{team.name}</p>
        </div>

        {/* Tanod Selection */}
        <div>
          <p className="mb-2 text-[10px] font-medium tracking-wider text-stone-400">SELECT TANOD</p>
          <div className="grid grid-cols-1 gap-2">
            {availableTanods.map((tanod) => (
              <button
                key={tanod.id}
                onClick={() => setSelectedTanod(tanod.id)}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                  selectedTanod === tanod.id
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E9EDFB] text-[#0038A8]">
                  <Users size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-stone-800">{tanod.name}</p>
                  <p className="text-[10px] text-stone-500">{tanod.purok}</p>
                </div>
                {selectedTanod === tanod.id && (
                  <CheckCircle2 size={16} className="text-emerald-600" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className="mb-2 text-[10px] font-medium tracking-wider text-stone-400">
            CHECK-IN NOTES (OPTIONAL)
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Add any observations or special instructions..."
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
          />
        </div>
      </div>
    </Modal>
  );
}

function CheckOutModal({
  record,
  team,
  roster,
  onClose,
  onConfirm,
}: {
  record: CheckInOutRecord;
  team: PatrolTeam;
  roster: RosterMember[];
  onClose: () => void;
  onConfirm: (data: { photoEvidence?: string; notes?: string }) => void;
}) {
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    onConfirm({
      notes: notes || undefined,
    });
  };

  const tanod = roster.find((r) => r.id === record.tanodId);

  return (
    <Modal
      onClose={onClose}
      title="Check-out Tanod"
      subtitle="End duty and record completion"
      icon={<UserX size={18} />}
      iconClass="bg-amber-100 text-amber-600"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-amber-700"
          >
            <UserX size={13} /> Confirm Check-out
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Tanod Info */}
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <p className="text-[10px] font-medium tracking-wider text-stone-400">TANOD</p>
          <p className="mt-0.5 text-[12px] font-medium text-stone-800">{tanod?.name || record.tanodId}</p>
          <p className="text-[10px] text-stone-500">{team.name}</p>
        </div>

        {/* Duty Duration */}
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <p className="text-[10px] font-medium tracking-wider text-stone-400">DUTY DURATION</p>
          <p className="mt-0.5 text-[12px] font-medium text-stone-800">
            {record.checkInTime ? formatDateTime(record.checkInTime) : "Unknown"}
          </p>
          <p className="text-[10px] text-stone-500">Checked in at</p>
        </div>

        {/* Notes */}
        <div>
          <p className="mb-2 text-[10px] font-medium tracking-wider text-stone-400">
            FINAL NOTES (OPTIONAL)
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Add final observations, incidents, or handover notes..."
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[12px] text-stone-700 outline-none transition focus:border-[#0038A8]/50 focus:ring-2 focus:ring-[#0038A8]/10"
          />
        </div>
      </div>
    </Modal>
  );
}

export default function CheckInOut({ onNavigate, role = "chief_tanod" }: CheckInOutProps) {
  const { flash, ToastPortal } = useToast();
  const { roster, teams, schedules, checkInOutRecords } = usePatrolScheduleStore();
  const [activeTab, setActiveTab] = useState<"check_in" | "check_out">("check_in");
  const [selectedSchedule, setSelectedSchedule] = useState<PatrolSchedule | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<CheckInOutRecord | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);

  // All hooks must be above any early return (Rules of Hooks)
  const todaySchedules = useMemo(() => getTodaySchedules(), [schedules]);
  const onDutyRecords = useMemo(() => checkInOutRecords.filter(r => r.status === 'checked_in'), [checkInOutRecords]);
  const checkpointPlans = useMemo(() => getApprovedCheckpointPlans(), []);

  // Access control - only Chief Tanod can access
  if (role !== "chief_tanod") {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
        <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
          <div className="mx-auto max-w-4xl rounded-xl border border-rose-200 bg-rose-50 px-6 py-8 text-center">
            <AlertTriangle size={48} className="mx-auto mb-4 text-rose-600" />
            <h2 className="text-xl font-bold text-stone-900">Access Denied</h2>
            <p className="mt-2 text-stone-600">
              This feature is only accessible to Chief Tanod or authorized Duty Officers.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const handleCheckIn = (data: { tanodId: string; photoEvidence?: string; notes?: string }) => {
    if (!selectedSchedule) return;

    const team = teams.find((t) => t.id === selectedSchedule.teamId);
    if (!team) {
      flash("Team not found", { type: "error" });
      return;
    }

    const record: CheckInOutRecord = {
      id: `CIO-${Date.now()}`,
      scheduleId: selectedSchedule.id,
      tanodId: data.tanodId,
      teamId: team.id,
      checkInTime: new Date().toISOString(),
      confirmedBy: "Chief Tanod", // In real app, this would be the actual user ID
      photoEvidence: data.photoEvidence,
      checkInNotes: data.notes,
      checkpointPlanId: selectedSchedule.planId,
      status: "checked_in",
      createdAt: new Date().toISOString(),
    };

    addCheckInOutRecord(record);
    flash(`Successfully checked in ${roster.find((r) => r.id === data.tanodId)?.name}`, { type: "success" });
    setShowCheckInModal(false);
    setSelectedSchedule(null);
  };

  const handleCheckOut = (data: { photoEvidence?: string; notes?: string }) => {
    if (!selectedRecord) return;

    updateCheckInOutRecord(selectedRecord.id, {
      checkOutTime: new Date().toISOString(),
      photoEvidence: data.photoEvidence,
      checkOutNotes: data.notes,
      status: "checked_out",
    });

    flash(`Successfully checked out ${roster.find((r) => r.id === selectedRecord.tanodId)?.name}`, { type: "success" });
    setShowCheckOutModal(false);
    setSelectedRecord(null);
  };

  const openCheckInModal = (schedule: PatrolSchedule) => {
    setSelectedSchedule(schedule);
    setShowCheckInModal(true);
  };

  const openCheckOutModal = (record: CheckInOutRecord) => {
    setSelectedRecord(record);
    setShowCheckOutModal(true);
  };

  const getAvailableTanodsForSchedule = (schedule: PatrolSchedule) => {
    const team = teams.find((t) => t.id === schedule.teamId);
    if (!team) return [];

    const teamMemberIds = [team.leaderId, ...team.memberIds];
    const alreadyCheckedIn = onDutyRecords
      .filter((r) => r.scheduleId === schedule.id)
      .map((r) => r.tanodId);

    return roster
      .filter((r) => teamMemberIds.includes(r.id))
      .filter((r) => !alreadyCheckedIn.includes(r.id))
      .filter((r) => r.available);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <ToastPortal />
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        {/* Header */}
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Check-in / Check-out</h1>
              <p className="mt-1 text-sm text-stone-500">
                Manage Tanod duty starts and completions
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2">
                <Shield size={16} className="text-[#0038A8]" />
                <span className="text-[12px] font-medium text-stone-700">Chief Tanod Only</span>
              </div>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 border-b border-stone-200">
            <button
              onClick={() => setActiveTab("check_in")}
              className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition ${
                activeTab === "check_in"
                  ? "border-b-2 border-[#0038A8] text-[#0038A8]"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              <UserCheck size={16} />
              Check-in (Start Duty)
            </button>
            <button
              onClick={() => setActiveTab("check_out")}
              className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition ${
                activeTab === "check_out"
                  ? "border-b-2 border-[#0038A8] text-[#0038A8]"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              <UserX size={16} />
              Check-out (End Duty)
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === "check_in" ? (
          <div className="space-y-4">
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 text-blue-600" />
                <div>
                  <p className="text-[12px] font-semibold text-blue-800">Physical Presence Required</p>
                  <p className="text-[11px] text-blue-700">
                    Tanods must personally appear before the Chief Tanod for check-in confirmation.
                  </p>
                </div>
              </div>
            </div>

            {todaySchedules.length === 0 ? (
              <div className="rounded-xl border border-stone-200 bg-white px-6 py-12 text-center">
                <CalendarClock size={48} className="mx-auto mb-4 text-stone-300" />
                <h3 className="text-lg font-semibold text-stone-900">No Scheduled Patrols Today</h3>
                <p className="mt-2 text-stone-500">
                  There are no patrol schedules for today. Check the Patrol Scheduling page to create new schedules.
                </p>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate("patrol_scheduling")}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0038A8] px-4 py-2 text-[12px] font-medium text-white transition hover:bg-[#002A8C]"
                  >
                    Go to Patrol Scheduling
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {todaySchedules.map((schedule) => {
                  const team = teams.find((t) => t.id === schedule.teamId);
                  const plan = checkpointPlans.find((p) => p.id === schedule.planId);
                  const availableTanods = getAvailableTanodsForSchedule(schedule);
                  const checkedInCount = onDutyRecords.filter(
                    (r) => r.scheduleId === schedule.id
                  ).length;

                  return (
                    <div
                      key={schedule.id}
                      className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[14px] font-semibold text-stone-900">{schedule.code}</h3>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              {schedule.status}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] text-stone-600">
                            {team?.name || "Unknown Team"} · {formatDay(schedule.startDate)}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-stone-500">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {schedule.startTime} - {schedule.endTime}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin size={12} />
                              {plan?.targetArea || "Unknown Area"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-[10px] text-stone-400">Checked In</p>
                            <p className="text-[16px] font-bold text-[#0038A8]">
                              {checkedInCount}/{team?.memberIds.length || 0}
                            </p>
                          </div>
                          {availableTanods.length > 0 && (
                            <button
                              onClick={() => openCheckInModal(schedule)}
                              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-[12px] font-medium text-white transition hover:bg-emerald-700"
                            >
                              <UserCheck size={14} />
                              Check-in
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {onDutyRecords.length === 0 ? (
              <div className="rounded-xl border border-stone-200 bg-white px-6 py-12 text-center">
                <Users size={48} className="mx-auto mb-4 text-stone-300" />
                <h3 className="text-lg font-semibold text-stone-900">No Tanods Currently On Duty</h3>
                <p className="mt-2 text-stone-500">
                  There are no Tanods currently checked in. Use the Check-in tab to start duty.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {onDutyRecords.map((record) => {
                  const team = teams.find((t) => t.id === record.teamId);
                  const tanod = roster.find((r) => r.id === record.tanodId);
                  const schedule = schedules.find((s) => s.id === record.scheduleId);

                  return (
                    <div
                      key={record.id}
                      className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[14px] font-semibold text-stone-900">{tanod?.name || record.tanodId}</h3>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              On Duty
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] text-stone-600">
                            {team?.name || "Unknown Team"} · {schedule?.code || "Unknown Schedule"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-stone-500">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              Checked in: {record.checkInTime ? formatDateTime(record.checkInTime) : "Unknown"}
                            </span>
                            {record.checkInNotes && (
                              <span className="flex items-center gap-1">
                                <FileText size={12} />
                                Notes added
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => openCheckOutModal(record)}
                          className="flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-[12px] font-medium text-white transition hover:bg-amber-700"
                        >
                          <UserX size={14} />
                          Check-out
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modals */}
        {showCheckInModal && selectedSchedule && (
          <CheckInModal
            schedule={selectedSchedule}
            team={teams.find((t) => t.id === selectedSchedule.teamId)!}
            roster={roster}
            availableTanods={getAvailableTanodsForSchedule(selectedSchedule)}
            onClose={() => {
              setShowCheckInModal(false);
              setSelectedSchedule(null);
            }}
            onConfirm={handleCheckIn}
          />
        )}

        {showCheckOutModal && selectedRecord && (
          <CheckOutModal
            record={selectedRecord}
            team={teams.find((t) => t.id === selectedRecord.teamId)!}
            roster={roster}
            onClose={() => {
              setShowCheckOutModal(false);
              setSelectedRecord(null);
            }}
            onConfirm={handleCheckOut}
          />
        )}
      </main>
    </div>
  );
}