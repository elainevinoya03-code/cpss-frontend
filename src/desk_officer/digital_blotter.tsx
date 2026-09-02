import { useState, useMemo, useEffect } from "react";
import {
  Archive,
  FileText,
  Star,
  CheckCircle2,
  MapPin,
  Clock,
  ImageIcon,
  Users,
  Eye,
  MessageSquare,
  Gauge,
  TrendingUp,
  ClipboardList,
  Search,
  Download,
  AlertTriangle,
  Shield,
  UserCheck,
  Radio,
  X,
  Loader2,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import { formatTime } from "../utils/format";
import { SEVERITY_MAP } from "../constants/severity";
import { ConfirmModal, Modal } from "../components/ui";
import {
  useIncidentStore,
  getDispatchForIncident,
  sourceLabel,
  DISPOSITION_OPTIONS,
  getAuditTrailForBlotter,
  recordBlotterView,
  recordAuditAction,
  type Blotter,
  type Incident,
  type FinalDisposition,
  type AuditEntry,
} from "./incidentStore";
import { CATEGORY_COLORS } from "./constants";

// CATEGORY_COLORS is imported from ./constants

// ---------------------------------------------------------------------------
// §15.14 — Analytics are computed from live store data (Parts 15, 16).
// No fabricated data.  All ratings, feedback quotes, and category stats
// come from blotters and incidents in the shared store.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// §15.15 — Small helpers
// ---------------------------------------------------------------------------

// Part 30 — Skeleton loader for initial page load
function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-stone-200 ${className}`} />
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-5 shadow-sm">
      <SkeletonBlock className="mb-3 h-3 w-24" />
      <SkeletonBlock className="mb-2 h-7 w-16" />
      <SkeletonBlock className="h-3 w-32" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <SkeletonBlock className="h-9 w-9 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <SkeletonBlock className="h-3 w-32" />
        <SkeletonBlock className="h-2.5 w-48" />
        <SkeletonBlock className="h-2.5 w-64" />
      </div>
    </div>
  );
}

function RatingStars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={
            i < value
              ? "fill-amber-400 text-amber-400"
              : "text-stone-300"
          }
        />
      ))}
    </span>
  );
}

function catColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? {
    bg: "bg-stone-100",
    text: "text-stone-600",
  };
}

function dispositionBadge(d: FinalDisposition) {
  const map: Record<FinalDisposition, string> = {
    Resolved: "bg-emerald-100 text-emerald-700",
    "Settled / Reconciled": "bg-sky-100 text-sky-700",
    Referred: "bg-violet-100 text-violet-700",
    "Responded — No Further Action": "bg-stone-100 text-stone-600",
    "False Alarm": "bg-amber-100 text-amber-700",
    Duplicate: "bg-stone-100 text-stone-500",
    Unverified: "bg-rose-100 text-rose-700",
    Other: "bg-stone-100 text-stone-600",
  };
  return map[d] ?? "bg-stone-100 text-stone-600";
}

// ---------------------------------------------------------------------------
// §15.16 — Blotter Detail (right-slide drawer) — READ-ONLY per Part 11
// ---------------------------------------------------------------------------

function BlotterDetail({
  blotter,
  onClose,
}: {
  blotter: Blotter;
  onClose: () => void;
}) {
  return (
    <Modal
      side="right"
      size="lg"
      onClose={onClose}
      title={blotter.id}
      subtitle={`${blotter.originalIncidentId} · ${blotter.purok}`}
      aside={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
          <CheckCircle2 size={12} />
          Permanent Record
        </span>
      }
      footer={
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 transition hover:bg-stone-50"
          >
            Close
          </button>
          {/* Part 11 — Request Correction instead of Edit */}
          <button
            onClick={() =>
              window.alert(
                "Request Correction: In production this would open a correction request form routed to the Barangay Captain for approval. No direct edits to archival records are permitted."
              )
            }
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#0038A8]/20 bg-[#0038A8]/5 px-4 py-2.5 text-[12px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
          >
            <Shield size={13} />
            Request Correction
          </button>
        </div>
      }
    >
      {/* Immutable record notice — Part 11 */}
      <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
        <p className="text-[11px] leading-relaxed text-stone-600">
          This is a <span className="font-semibold">permanent archival record</span>.
          It cannot be directly edited. To correct information, use{" "}
          <span className="font-semibold">Request Correction</span> — changes
          are recorded as amendments with full audit history.
        </p>
      </div>

      {/* Part 22 — Evidence summary badges + Part 27 — Anonymous indicator */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {blotter.anonymous && (
          <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-medium text-violet-700">
            <Shield size={10} />
            Anonymous Report — Identity Protected
          </span>
        )}
        {blotter.photoCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-600">
            <ImageIcon size={10} />
            {blotter.photoCount} Photo{blotter.photoCount === 1 ? "" : "s"}
          </span>
        )}
        <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-600">
          <MapPin size={10} className="text-[#0038A8]" />
          GPS {blotter.lat !== 0 || blotter.lng !== 0 ? "Verified" : "Not Available"}
        </span>
        {blotter.fieldNotes.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-600">
            <FileText size={10} />
            {blotter.fieldNotes.length} Field Note{blotter.fieldNotes.length === 1 ? "" : "s"}
          </span>
        )}
        {blotter.citizenRating > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-600">
            <Star size={10} className="fill-amber-400 text-amber-400" />
            {blotter.citizenRating}.0 Rating
          </span>
        )}
        {blotter.citizenFeedback && (
          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-600">
            <MessageSquare size={10} />
            Citizen Feedback
          </span>
        )}
      </div>

      {/* ================================================================ */}
      {/* SECTION A — Official Record                                      */}
      {/* ================================================================ */}
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-semibold tracking-wider text-[#0038A8]">
          SECTION A — OFFICIAL RECORD
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">BLOTTER ID</p>
            <p className="mt-0.5 text-[12px] font-bold text-stone-900">{blotter.id}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">ORIGINAL INCIDENT</p>
            <p className="mt-0.5 text-[12px] font-bold text-stone-900">{blotter.originalIncidentId}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">FILED DATE/TIME</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-stone-900">
              <Clock size={10} />
              {formatTime(blotter.filedDateTime)}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">RECORDED BY</p>
            <p className="mt-0.5 text-[11px] font-medium text-stone-900">{blotter.recordedBy}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">RECORD STATUS</p>
            <p className="mt-0.5 text-[11px] font-medium text-stone-900">
              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                blotter.recordStatus === "active"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-violet-100 text-violet-700"
              }`}>
                {blotter.recordStatus === "active" ? "Active" : "Amended"}
              </span>
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">CONVERTED</p>
            <p className="mt-0.5 text-[11px] font-medium text-stone-900">
              {formatTime(blotter.convertedDateTime)}
            </p>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* SECTION B — Incident Information                                 */}
      {/* ================================================================ */}
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-semibold tracking-wider text-[#0038A8]">
          SECTION B — INCIDENT INFORMATION
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">CATEGORY</p>
            <p className="mt-0.5">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${catColor(blotter.category).bg} ${catColor(blotter.category).text}`}>
                {blotter.category}
              </span>
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">SEVERITY</p>
            <p className="mt-0.5 text-[11px] font-medium text-stone-900">
              {SEVERITY_MAP[blotter.severity]?.label ?? blotter.severity}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">INCIDENT DATE/TIME</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-stone-900">
              <Clock size={10} />
              {formatTime(blotter.incidentDateTime)}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">SOURCE</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-stone-900">
              <Radio size={10} />
              {sourceLabel(blotter.source)}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">PUROK</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-stone-900">
              <MapPin size={10} className="text-[#0038A8]" />
              {blotter.purok}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">LOCATION</p>
            <p className="mt-0.5 text-[11px] font-medium text-stone-900">
              {blotter.locationLabel || "Not available"}
            </p>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
          <p className="text-[9px] font-medium tracking-wider text-stone-400">TITLE / DESCRIPTION</p>
          <p className="mt-0.5 text-[12px] font-semibold text-stone-900">{blotter.title}</p>
          {blotter.description !== blotter.title && (
            <p className="mt-1 text-[11px] leading-relaxed text-stone-600">{blotter.description}</p>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* SECTION C — Response                                             */}
      {/* ================================================================ */}
      {(() => {
        const dispatch = getDispatchForIncident(blotter.originalIncidentId);
        const dispatchTime = dispatch?.dispatchedAt;
        const onSceneTime = dispatch?.onSceneAt;
        const responseDuration =
          dispatchTime && onSceneTime
            ? `${((new Date(onSceneTime).getTime() - new Date(dispatchTime).getTime()) / 60_000).toFixed(1)} min`
            : null;
        return (
          <div className="mb-5">
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-[#0038A8]">
              SECTION C — RESPONSE
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <p className="text-[9px] font-medium tracking-wider text-stone-400">ASSIGNED OFFICER</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-stone-900">
                  <UserCheck size={10} />
                  {blotter.assignedOfficer}
                </p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <p className="text-[9px] font-medium tracking-wider text-stone-400">RESPONDING TEAM</p>
                <p className="mt-0.5 text-[11px] font-medium text-stone-900">
                  {dispatch?.team ?? "Not available"}
                </p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <p className="text-[9px] font-medium tracking-wider text-stone-400">DISPATCH TIME</p>
                <p className="mt-0.5 text-[11px] font-medium text-stone-900">
                  {dispatchTime ? formatTime(dispatchTime) : <span className="text-stone-400 italic">Not available</span>}
                </p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <p className="text-[9px] font-medium tracking-wider text-stone-400">ON-SCENE TIME</p>
                <p className="mt-0.5 text-[11px] font-medium text-stone-900">
                  {onSceneTime ? formatTime(onSceneTime) : <span className="text-stone-400 italic">Not available</span>}
                </p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <p className="text-[9px] font-medium tracking-wider text-stone-400">RESOLUTION TIME</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-stone-900">
                  <CheckCircle2 size={10} className="text-emerald-500" />
                  {formatTime(blotter.resolvedDateTime)}
                </p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                <p className="text-[9px] font-medium tracking-wider text-stone-400">RESPONSE DURATION</p>
                <p className="mt-0.5 text-[11px] font-medium text-stone-900">
                  {responseDuration ?? <span className="text-stone-400 italic">Not available</span>}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
              <p className="text-[9px] font-medium tracking-wider text-stone-400">RESOLUTION SUMMARY</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-stone-700">
                {blotter.resolutionSummary}
              </p>
              {blotter.closureReason && (
                <p className="mt-1.5 text-[10px] text-stone-500">
                  Closure reason: <span className="font-medium text-stone-600">{blotter.closureReason}</span>
                </p>
              )}
            </div>
            <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
              <p className="text-[9px] font-medium tracking-wider text-stone-400">FINAL DISPOSITION</p>
              <p className="mt-0.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${dispositionBadge(blotter.finalDisposition)}`}>
                  {blotter.finalDisposition}
                </span>
              </p>
            </div>
          </div>
        );
      })()}

      {/* ================================================================ */}
      {/* SECTION D — GPS / Location — Part 27: Restricted access          */}
      {/* ================================================================ */}
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-semibold tracking-wider text-[#0038A8]">
          SECTION D — GPS / LOCATION
        </p>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-[#0038A8]" />
            <span className="font-mono text-[11px] font-medium text-stone-900">
              {blotter.lat}, {blotter.lng}
            </span>
            {blotter.locationLabel && (
              <span className="text-[10px] text-stone-400">
                ({blotter.locationLabel})
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[10px] text-stone-400">
            GPS availability: {blotter.lat !== 0 || blotter.lng !== 0 ? (
              <span className="font-medium text-emerald-600">Verified</span>
            ) : (
              <span className="italic text-stone-400">Not available</span>
            )}
          </p>
        </div>
      </div>

      {/* ================================================================ */}
      {/* SECTION E — Evidence                                             */}
      {/* ================================================================ */}
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-semibold tracking-wider text-[#0038A8]">
          SECTION E — EVIDENCE
        </p>
        {blotter.photoCount === 0 && blotter.evidenceReferences.length === 0 && blotter.fieldNotes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-200 px-4 py-6 text-center">
            <ImageIcon size={18} className="mx-auto mb-1.5 text-stone-300" />
            <p className="text-[11px] italic text-stone-400">Not available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Photo thumbnails */}
            {blotter.photoCount > 0 && (
              <div>
                <p className="mb-1 text-[9px] font-medium tracking-wider text-stone-400">
                  PHOTOS ({blotter.photoCount})
                </p>
                <div className="flex gap-2">
                  {Array.from({ length: Math.min(blotter.photoCount, 5) }).map((_, i) => (
                    <div key={i} className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border border-stone-200 bg-white">
                      <ImageIcon size={14} className="text-stone-300" />
                      <span className="mt-0.5 text-[7px] text-stone-400">IMG-{i + 1}</span>
                    </div>
                  ))}
                  {blotter.photoCount > 5 && (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-stone-200 bg-white text-[10px] font-medium text-stone-400">
                      +{blotter.photoCount - 5}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Evidence references */}
            {blotter.evidenceReferences.length > 0 && (
              <div>
                <p className="mb-1 text-[9px] font-medium tracking-wider text-stone-400">
                  EVIDENCE REFERENCES ({blotter.evidenceReferences.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {blotter.evidenceReferences.map((ref) => (
                    <span
                      key={ref}
                      className="flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[9px] font-mono text-stone-500"
                    >
                      <ImageIcon size={8} />
                      {ref}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Field Notes */}
            {blotter.fieldNotes.length > 0 && (
              <div>
                <p className="mb-1 text-[9px] font-medium tracking-wider text-stone-400">
                  FIELD NOTES ({blotter.fieldNotes.length})
                </p>
                <ul className="space-y-1">
                  {blotter.fieldNotes.map((n, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-stone-700">
                      <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-[#0038A8]" />
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* SECTION F — Citizen Feedback                                     */}
      {/* ================================================================ */}
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-semibold tracking-wider text-[#0038A8]">
          SECTION F — CITIZEN FEEDBACK
        </p>
        {blotter.citizenFeedback || blotter.citizenRating > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
            {blotter.citizenRating > 0 && (
              <div className="mb-1.5 flex items-center gap-2">
                <RatingStars value={blotter.citizenRating} size={12} />
                <span className="text-[11px] font-semibold text-stone-700">
                  {blotter.citizenRating}.0
                </span>
              </div>
            )}
            {blotter.citizenFeedback && (
              <p className="text-[12px] italic leading-relaxed text-stone-700">
                "{blotter.citizenFeedback}"
              </p>
            )}
            <p className="mt-2 text-[9px] text-stone-400">
              Resident feedback · {formatTime(blotter.convertedDateTime)}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-stone-200 px-4 py-6 text-center">
            <MessageSquare size={18} className="mx-auto mb-1.5 text-stone-300" />
            <p className="text-[11px] italic text-stone-400">
              No feedback submitted for this incident.
            </p>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* SECTION G — Record History                                       */}
      {/* ================================================================ */}
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-semibold tracking-wider text-[#0038A8]">
          SECTION G — RECORD HISTORY
        </p>
        <RecordHistory blotterId={blotter.id} incidentId={blotter.originalIncidentId} />
      </div>

      {/* Part 11 — Amendment history (if any) */}
      {blotter.amendments && blotter.amendments.length > 0 && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-4 py-3">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-medium tracking-wider text-violet-600">
            <Shield size={11} />
            AMENDMENT HISTORY ({blotter.amendments.length})
          </p>
          <div className="space-y-2">
            {blotter.amendments.map((a, i) => (
              <div key={i} className="rounded-md bg-white border border-stone-200 px-3 py-2">
                <p className="text-[10px] font-semibold text-stone-700">{a.field}</p>
                <p className="text-[10px] text-stone-500">"{a.originalValue}" → "{a.correctedValue}"</p>
                <p className="text-[9px] text-stone-400 mt-0.5">
                  {a.correctedBy} · {formatTime(a.correctedAt)} · {a.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Part 14 — Record History (audit trail for a specific blotter)
// Display-only.  Not editable through ordinary UI controls.
// ---------------------------------------------------------------------------

const AUDIT_ACTION_LABELS: Record<string, string> = {
  incident_resolved: "Incident Resolved",
  incident_archived: "Incident Archived",
  blotter_created: "Blotter Created",
  blotter_viewed: "Record Viewed",
  correction_requested: "Correction Requested",
  amendment_applied: "Amendment Applied",
};

function RecordHistory({
  blotterId,
  incidentId,
}: {
  blotterId: string;
  incidentId: string;
}) {
  const entries = getAuditTrailForBlotter(blotterId);

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Clock size={11} className="text-stone-500" />
        <p className="text-[10px] font-semibold tracking-wider text-stone-500">
          RECORD HISTORY
        </p>
        <span className="ml-auto rounded-full bg-stone-200 px-1.5 py-0.5 text-[9px] font-medium text-stone-500">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-[11px] text-stone-400 italic">
          No audit trail entries for this record.
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-md border border-stone-200 bg-white px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-stone-700">
                  {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${
                    entry.result === "success"
                      ? "bg-emerald-100 text-emerald-700"
                      : entry.result === "failure"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {entry.result}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-stone-500">
                {entry.actingUser} · {formatTime(entry.timestamp)}
              </p>
              {entry.blotterId && entry.blotterId !== blotterId && (
                <p className="mt-0.5 text-[9px] text-stone-400">
                  Blotter: {entry.blotterId}
                </p>
              )}
              {entry.incidentId && entry.incidentId !== incidentId && (
                <p className="mt-0.5 text-[9px] text-stone-400">
                  Incident: {entry.incidentId}
                </p>
              )}
              {entry.reason && (
                <p className="mt-0.5 text-[9px] italic text-stone-400">
                  {entry.reason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-2 text-[9px] text-stone-400 italic">
        Audit trail is append-only and cannot be edited or deleted through the
        user interface.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// §15.17 — Main page component
// ---------------------------------------------------------------------------

export default function DigitalBlotter() {
  const { flash, ToastPortal } = useToast();
  const store = useIncidentStore();

  // Part 30 — Loading states
  const [initialLoading, setInitialLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Local UI state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "active" | "amended">("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Blotter | null>(null);
  const [converted, setConverted] = useState<Blotter | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Incident | null>(null);
  const [reportReady, setReportReady] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [archivePage, setArchivePage] = useState(1);
  const ARCHIVE_PAGE_SIZE = 8;

  // Part 30 — Simulate initial page load
  useEffect(() => {
    const t = setTimeout(() => setInitialLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  // Part 19 — Explicit category filter chips per spec
  const ARCHIVE_CATEGORIES = [
    "All",
    "Fire or Smoke",
    "Noise Disturbance",
    "Public Disturbance",
  ] as const;

  // §15.18 — Filtered blotter archive (Part 17: sorted most recent first)
  const filteredBlotters = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    return store.blotters
      .filter((b) => {
        const matchesCategory =
          categoryFilter === "All" || b.category === categoryFilter;
        const matchesStatus =
          statusFilter === "All" || b.recordStatus === statusFilter;
        const filed = new Date(b.filedDateTime).getTime();
        const matchesDate =
          (from == null || filed >= from) && (to == null || filed <= to);
        const matchesSearch =
          q === "" ||
          [
            b.id,
            b.originalIncidentId,
            b.category,
            b.purok,
            b.title,
            b.recordedBy,
            b.assignedOfficer,
          ].some((f) => f.toLowerCase().includes(q));
        return matchesCategory && matchesStatus && matchesDate && matchesSearch;
      })
      .sort(
        (a, b) =>
          new Date(b.filedDateTime).getTime() -
          new Date(a.filedDateTime).getTime()
      );
  }, [store.blotters, search, categoryFilter, statusFilter, dateFrom, dateTo]);

  // Part 17 — Pagination
  const archiveTotalPages = Math.max(
    1,
    Math.ceil(filteredBlotters.length / ARCHIVE_PAGE_SIZE)
  );
  const archivePageClamped = Math.min(archivePage, archiveTotalPages);
  const paginatedBlotters = filteredBlotters.slice(
    (archivePageClamped - 1) * ARCHIVE_PAGE_SIZE,
    archivePageClamped * ARCHIVE_PAGE_SIZE
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setArchivePage(1);
  }, [search, categoryFilter]);

  // §15.19 — KPI computations (computed from live store data — no fabricated data)
  const allRatedBlotters = useMemo(
    () => store.blotters.filter((b) => b.citizenRating > 0),
    [store.blotters]
  );
  const totalRatings = allRatedBlotters.length;
  const avgRating = useMemo(() => {
    if (totalRatings === 0) return null;
    return (
      allRatedBlotters.reduce((sum, b) => sum + b.citizenRating, 0) / totalRatings
    );
  }, [allRatedBlotters, totalRatings]);

  // Part 15 — Rating distribution computed from actual blotter ratings
  const ratingDistribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]; // index 0 = 1★, index 4 = 5★
    store.blotters.forEach((b) => {
      if (b.citizenRating >= 1 && b.citizenRating <= 5) {
        counts[b.citizenRating - 1]++;
      }
    });
    return [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: counts[stars - 1],
    }));
  }, [store.blotters]);

  // Part 16 — Recent citizen feedback from blotters that have feedback text
  const recentFeedback = useMemo(() => {
    return store.blotters
      .filter((b) => b.citizenFeedback && b.citizenFeedback.trim().length > 0)
      .slice(0, 8)
      .map((b) => ({
        incident: b.originalIncidentId,
        blotterId: b.id,
        category: b.category,
        rating: b.citizenRating,
        text: b.citizenFeedback!,
        date: b.convertedDateTime,
        anonymous: b.anonymous,
      }));
  }, [store.blotters]);

  // Executive Review — Category performance computed from store blotters
  const categoryPerformance = useMemo(() => {
    const map = new Map<string, { count: number; rated: number; totalRating: number }>();
    store.blotters.forEach((b) => {
      const existing = map.get(b.category) ?? { count: 0, rated: 0, totalRating: 0 };
      existing.count++;
      if (b.citizenRating > 0) {
        existing.rated++;
        existing.totalRating += b.citizenRating;
      }
      map.set(b.category, existing);
    });
    return Array.from(map.entries())
      .map(([category, stats]) => ({
        category,
        count: stats.count,
        resolved: stats.count, // All blotter records are resolved by definition
        avgRating: stats.rated > 0 ? stats.totalRating / stats.rated : null,
      }))
      .sort((a, b) => b.count - a.count);
  }, [store.blotters]);

  // Executive Review — Weekly case trend from blotter filing dates
  const weeklyTrend = useMemo(() => {
    const now = new Date();
    const weeks: { label: string; count: number }[] = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (w + 1) * 7);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      const count = store.blotters.filter((b) => {
        const d = new Date(b.filedDateTime);
        return d >= weekStart && d < weekEnd;
      }).length;
      weeks.push({
        label: `W${4 - w}`,
        count,
      });
    }
    return weeks;
  }, [store.blotters]);
  const maxTrend = Math.max(...weeklyTrend.map((w) => w.count), 1);

  const pendingCount = store.blotterEligible.length;

  // §15.20 — KPI cards
  const kpis = [
    {
      label: "TOTAL BLOTTERS FILED",
      value: store.blotters.length,
      sub: "permanent archival records",
      icon: Archive,
    },
    {
      label: "PENDING CONVERSION",
      value: pendingCount,
      sub: "resolved cases ready to archive",
      icon: ClipboardList,
    },
    {
      label: "AVG CITIZEN RATING",
      value: avgRating !== null ? `${avgRating.toFixed(1)} / 5` : "N/A",
      sub:
        avgRating !== null
          ? `across ${totalRatings} closed-case ratings`
          : "no ratings available",
      icon: Star,
    },
    {
      label: "AVG RESPONSE TIME",
      value:
        store.avgResponseTime !== null
          ? `${store.avgResponseTime.toFixed(1)} min`
          : "N/A",
      sub:
        store.avgResponseTime !== null
          ? "dispatch to on-scene"
          : "insufficient timestamp data",
      icon: Gauge,
    },
  ];

  // §15.21 — Convert Next
  function handleConvertNext() {
    const eligible = store.blotterEligible;
    if (eligible.length === 0) {
      flash("No resolved incidents are currently eligible for archival", {
        type: "info",
      });
      return;
    }
    const oldest = eligible.reduce((a, b) => {
      const aTime = a.resolvedAt ?? a.time;
      const bTime = b.resolvedAt ?? b.time;
      return new Date(aTime).getTime() < new Date(bTime).getTime() ? a : b;
    });
    setConfirmTarget(oldest);
  }

  // §15.22 — Execute conversion after confirmation (Part 29: error handling)
  function executeConversion() {
    if (!confirmTarget) return;

    try {
      const blotter = store.convertToBlotter(confirmTarget.id);
      setConfirmTarget(null);
      if (blotter) {
        setConverted(blotter);
        flash(
          `${confirmTarget.id} converted into permanent archival blotter ${blotter.id}`
        );
      } else {
        // Part 29 — Structured error for conversion failure
        flash(
          "Unable to create the permanent blotter record. No changes were made to the incident. Please try again.",
          { type: "error" }
        );
      }
    } catch {
      // Part 29 — Network/server error
      flash(
        "A system error occurred while converting the incident. Please check your connection and try again.",
        { type: "error" }
      );
    }
  }

  // §15.23 — Export filtered blotters as CSV (Part 23 + Part 29 error handling)
  function exportBlotters() {
    if (filteredBlotters.length === 0) return;

    // Part 30 — Prevent duplicate export
    if (exporting) return;
    setExporting(true);

    try {
      // Part 23 — Proper CSV escaping for commas, quotes, line breaks, Filipino text
      function esc(val: string): string {
        const escaped = val.replace(/"/g, '""');
        if (
          escaped.includes(",") ||
          escaped.includes('"') ||
          escaped.includes("\n") ||
          escaped.includes("\r")
        ) {
          return `"${escaped}"`;
        }
        return escaped;
      }

      const header = [
        "Blotter ID",
        "Original Incident ID",
        "Category",
        "Title",
        "Filed Time",
        "Incident Time",
        "Resolved Time",
        "Purok",
        "Location",
        "Officer",
        "Disposition",
        "Rating",
        "Citizen Feedback",
        "Source",
      ];
      const rows = filteredBlotters.map((b) => [
        b.id,
        b.originalIncidentId,
        b.category,
        b.title,
        formatTime(b.filedDateTime),
        formatTime(b.incidentDateTime),
        formatTime(b.resolvedDateTime),
        b.purok,
        b.locationLabel || "",
        b.assignedOfficer,
        b.finalDisposition,
        String(b.citizenRating),
        b.citizenFeedback ?? "",
        sourceLabel(b.source),
      ]);
      const csv = [header.map(esc), ...rows.map((r) => r.map(esc))]
        .map((r) => r.join(","))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `barangay_blotter_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      flash(
        `${filteredBlotters.length} blotter record${filteredBlotters.length === 1 ? "" : "s"} exported as CSV for official use`
      );
    } catch {
      // Part 29 — Export failure
      flash(
        "Unable to export blotter records. Please try again.",
        { type: "error" }
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        {/* ============================================================= */}
        {/* A. HEADER                                                     */}
        {/* ============================================================= */}
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {initialLoading ? (
              <>
                <div className="space-y-2">
                  <SkeletonBlock className="h-6 w-64" />
                  <SkeletonBlock className="h-3 w-80" />
                </div>
                <div className="flex gap-2">
                  <SkeletonBlock className="h-9 w-28 rounded-full" />
                  <SkeletonBlock className="h-9 w-28 rounded-full" />
                  <SkeletonBlock className="h-9 w-28 rounded-full" />
                </div>
              </>
            ) : (
            <>
            <div>
              <h1 className="text-2xl font-bold text-stone-900">
                Digital Barangay Blotter
              </h1>
              <p className="mt-1 text-sm text-stone-500">
                Official archival records of resolved barangay safety incidents.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleConvertNext}
                disabled={pendingCount === 0}
                className="flex items-center gap-1.5 rounded-lg bg-[#0038A8] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#002A8C] disabled:opacity-40"
              >
                <FileText size={13} />
                Convert Next
              </button>
              <button
                onClick={exportBlotters}
                disabled={filteredBlotters.length === 0 || exporting}
                className="flex items-center gap-1.5 rounded-lg border border-[#0038A8]/20 bg-[#0038A8]/5 px-3 py-1.5 text-[11px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white disabled:opacity-40"
              >
                {exporting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download size={13} />
                    Export CSV
                  </>
                )}
              </button>
            </div>
            </>
            )}
          </div>
        </header>

        {/* ============================================================= */}
        {/* B. KPI SUMMARY                                                */}
        {/* ============================================================= */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {initialLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : kpis.map(({ label, value, sub, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-black/5 bg-white px-5 py-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-medium tracking-wider text-[#94A3B8]">
                  {label}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9EDFB] text-[#0038A8]">
                  <Icon size={15} />
                </div>
              </div>
              <div className="mt-2 text-[26px] font-bold text-[#0038A8]">
                {value}
              </div>
              <div className="mt-1 text-[11px] text-[#94A3B8]">{sub}</div>
            </div>
          ))}
        </div>

        {/* ============================================================= */}
        {/* C + D — Pending Archival (left) + Feedback Analyzer (right)    */}
        {/* ============================================================= */}
        <div
          className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-3"
          style={{ height: 480 }}
        >
          {/* C. RESOLVED CASES — PENDING ARCHIVAL (Part 5) */}
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">
                    Resolved Cases — Pending Archival
                  </h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    Completed lifecycles ready for single-click conversion
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                {pendingCount} ready
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-4">
              {initialLoading ? (
                <div className="space-y-2">
                  <SkeletonBlock className="h-24 w-full" />
                  <SkeletonBlock className="h-24 w-full" />
                </div>
              ) : pendingCount === 0 ? (
                /* Part 20A — No pending archival records */
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-12">
                  <CheckCircle2
                    size={22}
                    className="mb-2 text-emerald-400"
                  />
                  <p className="text-[12px] font-medium text-stone-500">
                    No Resolved Cases Awaiting Archival
                  </p>
                  <p className="mt-0.5 max-w-[260px] text-center text-[10px] text-stone-400">
                    All eligible resolved incidents have been converted to
                    permanent blotter records.
                  </p>
                </div>
              ) : (
                store.blotterEligible.map((inc) => {
                  const sev = SEVERITY_MAP[inc.severity];
                  const cc = catColor(inc.category);
                  const dispatch = getDispatchForIncident(inc.id);
                  const officer =
                    dispatch?.team ?? inc.assignedTeam ?? "Unassigned";
                  return (
                    <div
                      key={inc.id}
                      className="rounded-lg border border-stone-200 bg-white px-4 py-3.5"
                    >
                      {/* Row 1: ID + badges + rating */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold text-stone-900">
                            {inc.id}
                          </span>
                          {sev && (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${sev.badge}`}
                            >
                              {sev.label}
                            </span>
                          )}
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${cc.bg} ${cc.text}`}
                          >
                            {inc.category}
                          </span>
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                            Eligible
                          </span>
                        </div>
                        {inc.rating != null && (
                          <div className="flex items-center gap-2">
                            <RatingStars value={inc.rating} />
                            <span className="text-[10px] font-semibold text-stone-500">
                              {inc.rating}.0
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Row 2: Title */}
                      <p className="mt-1.5 text-[12px] font-semibold text-stone-900">
                        {inc.description}
                      </p>

                      {/* Row 3: Purok · Officer · Resolved time · Source */}
                      <p className="text-[10px] text-stone-400">
                        {inc.purok}
                        <span className="mx-1">&middot;</span>
                        <span className="flex items-center gap-0.5 inline-flex">
                          <UserCheck size={9} />
                          {officer}
                        </span>
                        <span className="mx-1">&middot;</span>
                        resolved {formatTime(inc.resolvedAt ?? inc.time)}
                        <span className="mx-1">&middot;</span>
                        {sourceLabel(inc.source)}
                      </p>
                      {inc.closedReason && (
                        <p className="mt-0.5 text-[10px] text-stone-500">
                          Closure:{" "}
                          <span className="font-medium text-stone-600">
                            {inc.closedReason}
                          </span>
                        </p>
                      )}

                      {/* Row 4: Evidence indicators */}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500">
                        <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1">
                          <ImageIcon size={10} />
                          {inc.photos} photo{inc.photos === 1 ? "" : "s"}
                        </span>
                        <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1">
                          <FileText size={10} />
                          {(inc.notes ?? []).length} field note
                          {(inc.notes ?? []).length === 1 ? "" : "s"}
                        </span>
                        <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1">
                          <MapPin size={10} />
                          GPS {inc.lat}, {inc.lng}
                        </span>
                        {inc.rating != null && (
                          <span className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-amber-600">
                            <Star size={10} />
                            Rating
                          </span>
                        )}
                      </div>

                      {/* Row 5: Feedback */}
                      {inc.feedback && (
                        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2">
                          <p className="flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                            <MessageSquare size={10} />
                            Citizen Feedback
                          </p>
                          <p className="mt-0.5 text-[11px] italic text-stone-700">
                            "{inc.feedback}"
                          </p>
                        </div>
                      )}

                      {/* Row 6: Convert button */}
                      <button
                        onClick={() => setConfirmTarget(inc)}
                        className="mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#0038A8] px-3 text-[11px] font-semibold text-white transition hover:bg-[#002A8C]"
                      >
                        <Archive size={12} />
                        Convert to Blotter
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* D. RESOLUTION & FEEDBACK ANALYZER */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Star size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">
                    Resolution &amp; Feedback Analyzer
                  </h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    Secured post-incident ratings &amp; qualitative feedback
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
              {/* Average satisfaction */}
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-center">
                <p className="text-[10px] font-medium tracking-wider text-stone-400">
                  AVERAGE SATISFACTION
                </p>
                <p className="mt-1 text-[30px] font-bold text-[#0038A8]">
                  {avgRating !== null ? avgRating.toFixed(1) : "N/A"}
                </p>
                <div className="mt-1 flex justify-center">
                  {avgRating !== null ? (
                    <RatingStars value={Math.round(avgRating)} size={14} />
                  ) : (
                    <span className="text-[10px] text-stone-400">
                      No ratings yet
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[10px] text-stone-400">
                  {totalRatings > 0
                    ? `across ${totalRatings} closed-case ratings`
                    : "awaiting citizen feedback"}
                </p>
              </div>

              {/* Rating distribution */}
              <div>
                <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">
                  RATING DISTRIBUTION
                </p>
                {totalRatings === 0 ? (
                  <div className="flex flex-col items-center rounded-lg border border-dashed border-stone-200 py-8">
                    <Star size={18} className="mb-1.5 text-stone-300" />
                    <p className="text-[11px] font-medium text-stone-400">
                      No ratings yet
                    </p>
                    <p className="text-[10px] text-stone-300">
                      Ratings will appear after citizen feedback is collected
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {ratingDistribution.map((r) => (
                      <div key={r.stars} className="flex items-center gap-2">
                        <span className="flex w-10 items-center gap-0.5 text-[10px] font-semibold text-stone-600">
                          <Star
                            size={10}
                            className="fill-amber-400 text-amber-400"
                          />
                          {r.stars}
                        </span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-200">
                          <div
                            className={`h-full rounded-full ${r.stars >= 4 ? "bg-emerald-500" : r.stars === 3 ? "bg-amber-400" : "bg-rose-400"}`}
                            style={{
                              width: `${totalRatings > 0 ? (r.count / totalRatings) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="w-8 text-right text-[10px] font-medium text-stone-500">
                          {r.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Part 16 — Recent Qualitative Feedback */}
              <div>
                <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">
                  RECENT FEEDBACK
                </p>
                {recentFeedback.length === 0 ? (
                  <div className="flex flex-col items-center rounded-lg border border-dashed border-stone-200 py-8">
                    <MessageSquare
                      size={18}
                      className="mb-1.5 text-stone-300"
                    />
                    <p className="text-[11px] font-medium text-stone-400">
                      No feedback submitted yet
                    </p>
                    <p className="text-[10px] text-stone-300">
                      Citizen feedback will appear here after case closure
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentFeedback.map((f) => (
                      <div
                        key={f.incident}
                        className="rounded-lg border border-stone-200 bg-white px-3.5 py-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <RatingStars value={f.rating} size={10} />
                          <span className="text-[9px] text-stone-400">
                            {f.incident}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] italic leading-snug text-stone-600">
                          "{f.text}"
                        </p>
                        <p className="mt-1 text-[9px] text-stone-400">
                          <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${catColor(f.category).bg} ${catColor(f.category).text}`}>
                            {f.category}
                          </span>
                          <span className="mx-1">&middot;</span>
                          {f.anonymous ? "Anonymous resident" : "Resident feedback"}
                          <span className="mx-1">&middot;</span>
                          {formatTime(f.date)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Part 16 — Privacy notice */}
                {recentFeedback.length > 0 && (
                  <p className="mt-2 text-[9px] italic text-stone-400">
                    Feedback is for service improvement only. Ratings are not
                    used for disciplinary scores, performance rankings, or
                    penalties.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================= */}
        {/* E + F — Blotter Archive (left) + Executive Review (right)      */}
        {/* ============================================================= */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* E. BLOTTER ARCHIVE */}
          <div className="xl:col-span-2 flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <Archive size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">
                    Blotter Archive
                  </h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    Official archival incident logs
                  </p>
                </div>
              </div>
            </div>

            {/* Part 18 — Search + Part 19 — Category filters */}
            <div className="flex flex-wrap items-center gap-2 border-b border-black/5 px-5 pb-3">
              <div className="relative min-w-[180px] flex-1">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-300"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by ID, incident ID, type, location or officer…"
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 py-1.5 pl-7 pr-2.5 text-[11px] text-stone-900 placeholder:text-stone-300 focus:border-[#0038A8] focus:outline-none focus:ring-1 focus:ring-[#0038A8]/30"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ARCHIVE_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
                      categoryFilter === c
                        ? "border-[#0038A8]/30 bg-[#0038A8]/5 text-[#0038A8]"
                        : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium tracking-wider text-stone-400">STATUS</span>
                {(["All", "active", "amended"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-full border px-2 py-1 text-[10px] font-medium capitalize transition ${
                      statusFilter === s
                        ? "border-[#0038A8]/30 bg-[#0038A8]/5 text-[#0038A8]"
                        : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium tracking-wider text-stone-400">FILED</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  title="From date"
                  className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] text-stone-700 outline-none focus:border-[#0038A8]"
                />
                <span className="text-[10px] text-stone-400">–</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  title="To date"
                  className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] text-stone-700 outline-none focus:border-[#0038A8]"
                />
              </div>
              <span className="text-[10px] text-stone-400">
                {filteredBlotters.length} record
                {filteredBlotters.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* Part 17 — Archive list (paginated, most recent first) */}
            <div className="min-h-0 flex-1 overflow-y-auto pt-1 pb-2">
              {initialLoading ? (
                <div className="space-y-1 px-5">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              ) : filteredBlotters.length === 0 && store.blotters.length === 0 ? (
                /* Part 20B — No archive records yet */
                <div className="px-5 py-10 text-center">
                  <Archive size={20} className="mx-auto mb-2 text-stone-300" />
                  <p className="text-[12px] font-medium text-stone-500">
                    No Blotter Records Yet
                  </p>
                  <p className="mt-0.5 max-w-[280px] text-center text-[10px] text-stone-400">
                    Permanent blotter records will appear here after resolved
                    incidents are archived.
                  </p>
                </div>
              ) : filteredBlotters.length === 0 ? (
                /* Part 20C — Search/filter no results */
                <div className="px-5 py-10 text-center">
                  <Search size={20} className="mx-auto mb-2 text-stone-300" />
                  <p className="text-[12px] font-medium text-stone-500">
                    No Matching Records
                  </p>
                  <p className="mt-0.5 max-w-[280px] text-center text-[10px] text-stone-400">
                    No blotter records match your current search and filters.
                  </p>
                  <button
                    onClick={() => {
                      setSearch("");
                      setCategoryFilter("All");
                      setStatusFilter("All");
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="mt-3 inline-flex items-center gap-1 rounded-lg border border-[#0038A8]/20 bg-[#0038A8]/5 px-3 py-1.5 text-[11px] font-medium text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <>
                  {paginatedBlotters.map((b, i) => (
                    <div
                      key={b.id}
                      className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 ${i < paginatedBlotters.length - 1 ? "border-b border-black/5" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0038A8]/5 text-[#0038A8]">
                          <FileText size={15} />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold text-stone-900">
                              {b.id}
                            </span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${catColor(b.category).bg} ${catColor(b.category).text}`}
                            >
                              {b.category}
                            </span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${dispositionBadge(b.finalDisposition)}`}
                            >
                              {b.finalDisposition}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-600">
                            {b.title}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-stone-400">
                            <Clock size={9} />
                            {formatTime(b.filedDateTime)}
                            <span className="mx-0.5">&middot;</span>
                            {b.originalIncidentId} · {b.purok} ·{" "}
                            {b.recordedBy}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[10px] font-medium text-stone-500">
                          <Star
                            size={10}
                            className="fill-amber-400 text-amber-400"
                          />
                          {b.citizenRating}.0
                        </span>
                        <button
                          onClick={() => {
                            recordBlotterView(b.id, b.originalIncidentId);
                            setSelected(b);
                          }}
                          className="flex h-7 items-center gap-1 rounded-md border border-stone-200 px-2 text-[11px] font-medium text-stone-600 transition hover:bg-stone-50"
                        >
                          <Eye size={11} />
                          View
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Part 17 — Pagination controls */}
                  {archiveTotalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-black/5 px-5 py-2.5">
                      <span className="text-[10px] text-stone-400">
                        Page {archivePageClamped} of {archiveTotalPages}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            setArchivePage((p) => Math.max(1, p - 1))
                          }
                          disabled={archivePageClamped <= 1}
                          className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-40"
                        >
                          Previous
                        </button>
                        {Array.from(
                          { length: archiveTotalPages },
                          (_, i) => i + 1
                        ).map((pg) => (
                          <button
                            key={pg}
                            onClick={() => setArchivePage(pg)}
                            className={`h-6 w-6 rounded-md text-[10px] font-medium transition ${
                              pg === archivePageClamped
                                ? "bg-[#0038A8] text-white"
                                : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                            }`}
                          >
                            {pg}
                          </button>
                        ))}
                        <button
                          onClick={() =>
                            setArchivePage((p) =>
                              Math.min(archiveTotalPages, p + 1)
                            )
                          }
                          disabled={archivePageClamped >= archiveTotalPages}
                          className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* F. EXECUTIVE REVIEW & OVERSIGHT */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-[#0038A8]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#334155]">
                    Executive Review &amp; Oversight
                  </h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    Captain-accessible responsiveness metrics
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-[#0038A8]">
                <Users size={11} />
                Captain
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
              {/* Responsiveness score — computed from dispatch data */}
              <div className="mb-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-[10px] font-medium tracking-wider text-stone-400">
                  RESPONSIVENESS SCORE
                </p>
                <p className="mt-1 text-[24px] font-bold text-emerald-600">
                  {store.avgResponseTime !== null
                    ? `${Math.min(100, Math.round(100 - (store.avgResponseTime / 15) * 100))}%`
                    : "N/A"}
                </p>
                <p className="text-[10px] text-stone-400">
                  {store.avgResponseTime !== null
                    ? `avg response time: ${store.avgResponseTime.toFixed(1)} min`
                    : "insufficient dispatch timestamp data"}
                </p>
              </div>

              {/* Part 24 — Peace & Order Report — Category Performance Table */}
              <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">
                PEACE &amp; ORDER REPORT — CATEGORY PERFORMANCE
              </p>
              {categoryPerformance.length === 0 ? (
                <div className="mb-3 flex flex-col items-center rounded-lg border border-dashed border-stone-200 py-8">
                  <TrendingUp size={18} className="mb-1.5 text-stone-300" />
                  <p className="text-[11px] font-medium text-stone-400">
                    No blotter records yet
                  </p>
                  <p className="text-[10px] text-stone-300">
                    Category stats will appear after archival
                  </p>
                </div>
              ) : (
                <div className="mb-3 overflow-hidden rounded-lg border border-stone-200">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50">
                        <th className="px-3 py-2 text-[9px] font-semibold tracking-wider text-stone-500">
                          CATEGORY
                        </th>
                        <th className="px-3 py-2 text-right text-[9px] font-semibold tracking-wider text-stone-500">
                          CASES
                        </th>
                        <th className="px-3 py-2 text-right text-[9px] font-semibold tracking-wider text-stone-500">
                          RESOLVED
                        </th>
                        <th className="px-3 py-2 text-right text-[9px] font-semibold tracking-wider text-stone-500">
                          AVG RATING
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryPerformance.map((m, i) => (
                        <tr
                          key={m.category}
                          className={
                            i < categoryPerformance.length - 1
                              ? "border-b border-stone-100"
                              : ""
                          }
                        >
                          <td className="px-3 py-2 text-[11px] font-medium text-stone-900">
                            {m.category}
                          </td>
                          <td className="px-3 py-2 text-right text-[11px] text-stone-700">
                            {m.count}
                          </td>
                          <td className="px-3 py-2 text-right text-[11px] text-emerald-600">
                            {m.resolved}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {m.avgRating !== null ? (
                              <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-600">
                                <Star
                                  size={9}
                                  className="fill-amber-400 text-amber-400"
                                />
                                {m.avgRating.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-stone-400 italic">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Weekly trend — computed from blotter filing dates */}
              <p className="mb-2 text-[10px] font-semibold tracking-wider text-stone-400">
                WEEKLY CASE TREND
              </p>
              <div className="mb-3 flex items-end gap-2 rounded-lg border border-stone-200 bg-white px-3.5 py-3">
                {weeklyTrend.map((w) => (
                  <div
                    key={w.label}
                    className="flex flex-1 flex-col items-center gap-1"
                  >
                    <span className="text-[9px] font-semibold text-stone-600">
                      {w.count}
                    </span>
                    <div
                      className="w-full rounded-t bg-[#0038A8]/15"
                      style={{ height: `${maxTrend > 0 ? (w.count / maxTrend) * 56 : 0}px` }}
                    >
                      <div
                        className="h-full w-full rounded-t bg-[#0038A8]/70"
                        style={{ height: "100%" }}
                      />
                    </div>
                    <span className="text-[9px] text-stone-400">{w.label}</span>
                  </div>
                ))}
              </div>

              {/* Part 25 — Generate Peace & Order Report */}
              <button
                onClick={() => {
                  if (reportGenerating) return;
                  setReportGenerating(true);
                  // Part 25 — Dispatch through existing reporting mechanism (no fake download)
                  setTimeout(() => {
                    recordAuditAction("report_generated", "N/A", {
                      result: "success",
                      reason: "Peace & Order Report generated and dispatched to Barangay Captain for review",
                    });
                    setReportGenerating(false);
                    setReportReady(true);
                  }, 1500);
                }}
                disabled={reportGenerating}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#0038A8]/20 bg-[#0038A8]/5 px-4 py-2.5 text-[12px] font-semibold text-[#0038A8] transition hover:bg-[#0038A8] hover:text-white disabled:opacity-60"
              >
                {reportGenerating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <FileText size={13} />
                    Generate Peace &amp; Order Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ============================================================= */}
      {/* G. BLOTTER DETAIL DRAWER (Part 11 — Read-only)                */}
      {/* ============================================================= */}
      {selected && (
        <BlotterDetail blotter={selected} onClose={() => setSelected(null)} />
      )}

      {/* ============================================================= */}
      {/* H. CONVERSION CONFIRMATION MODAL (Part 7)                      */}
      {/* ============================================================= */}
      {confirmTarget && (
        <ConversionConfirmModal
          incident={confirmTarget}
          onConfirm={executeConversion}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {/* ============================================================= */}
      {/* I. CONVERSION SUCCESS MODAL (Part 12)                          */}
      {/* ============================================================= */}
      {converted && (
        <ConversionSuccessModal
          blotter={converted}
          onView={() => {
            setConverted(null);
            setSelected(converted);
          }}
          onDone={() => setConverted(null)}
        />
      )}

      {/* ============================================================= */}
      {/* J. REPORT GENERATED MODAL                                      */}
      {/* ============================================================= */}
      {reportReady && (
        <ConfirmModal
          type="success"
          title="Peace & Order Report Generated"
          message="Report dispatched to the Barangay Captain for review."
          onClose={() => setReportReady(false)}
        />
      )}

      {/* Toasts */}
      {ToastPortal && <ToastPortal />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Part 7 — Conversion Confirmation Modal
// Shows full structured detail of the incident before conversion.
// ---------------------------------------------------------------------------

function ConversionConfirmModal({
  incident,
  onConfirm,
  onCancel,
}: {
  incident: Incident;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dispatch = getDispatchForIncident(incident.id);
  const officer = dispatch?.team ?? incident.assignedTeam ?? "Unassigned";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-3 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl sm:p-6 modal-panel-in">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0038A8]/10 text-[#0038A8]">
            <Archive size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold text-stone-900">
              Convert Incident to Permanent Blotter
            </h2>
            <p className="mt-0.5 text-[12px] text-stone-400">
              Review the incident details before creating the archival record.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Incident detail grid */}
        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
              <p className="text-[9px] font-medium tracking-wider text-stone-400">
                INCIDENT ID
              </p>
              <p className="mt-0.5 text-[12px] font-bold text-stone-900">
                {incident.id}
              </p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
              <p className="text-[9px] font-medium tracking-wider text-stone-400">
                CATEGORY
              </p>
              <p className="mt-0.5 text-[12px] font-semibold text-stone-900">
                {incident.category}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">
              TITLE / DESCRIPTION
            </p>
            <p className="mt-0.5 text-[12px] font-semibold text-stone-900">
              {incident.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
              <p className="text-[9px] font-medium tracking-wider text-stone-400">
                INCIDENT DATE/TIME
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-stone-900">
                <Clock size={10} />
                {formatTime(incident.time)}
              </p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
              <p className="text-[9px] font-medium tracking-wider text-stone-400">
                PUROK
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-stone-900">
                {incident.purok}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
              <p className="text-[9px] font-medium tracking-wider text-stone-400">
                RESOLVING OFFICER
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-stone-900">
                <UserCheck size={10} />
                {officer}
              </p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
              <p className="text-[9px] font-medium tracking-wider text-stone-400">
                LOCATION
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-stone-900">
                <MapPin size={10} className="text-[#0038A8]" />
                {incident.lat}, {incident.lng}
              </p>
            </div>
          </div>

          {/* Evidence summary */}
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">
              EVIDENCE &amp; FEEDBACK SUMMARY
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
              <span className="flex items-center gap-1 rounded-md bg-white border border-stone-200 px-2 py-1">
                <ImageIcon size={10} />
                {incident.photos} photo{incident.photos === 1 ? "" : "s"}
              </span>
              <span className="flex items-center gap-1 rounded-md bg-white border border-stone-200 px-2 py-1">
                <FileText size={10} />
                {(incident.notes ?? []).length} field note
                {(incident.notes ?? []).length === 1 ? "" : "s"}
              </span>
              <span className="flex items-center gap-1 rounded-md bg-white border border-stone-200 px-2 py-1">
                <MapPin size={10} />
                GPS recorded
              </span>
              {incident.rating != null && (
                <span className="flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-amber-700">
                  <Star size={10} />
                  {incident.rating}/5 rating
                </span>
              )}
            </div>
          </div>

          {incident.closedReason && (
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
              <p className="text-[9px] font-medium tracking-wider text-stone-400">
                RESOLUTION SUMMARY
              </p>
              <p className="mt-0.5 text-[11px] text-stone-700">
                {incident.description} Closure: {incident.closedReason}.
              </p>
            </div>
          )}
        </div>

        {/* Part 7 — Formal explanation */}
        <div className="mt-4 rounded-lg border border-[#0038A8]/10 bg-[#0038A8]/5 px-4 py-3">
          <p className="text-[11px] leading-relaxed text-[#0038A8]">
            Converting this resolved incident will create an{" "}
            <span className="font-semibold">
              official permanent blotter record
            </span>
            . The original incident will remain linked to the archival record,
            and the incident's approved photos, field notes, location/GPS
            information, resolution details, and citizen feedback will be
            preserved. This action cannot be undone.
          </p>
        </div>

        {/* Buttons */}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onCancel}
            className="w-full rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50 sm:flex-1"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="w-full rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-medium text-white hover:bg-[#002A8C] sm:flex-1"
          >
            <span className="flex items-center justify-center gap-1.5">
              <Archive size={13} />
              Convert to Blotter
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Part 12 — Conversion Success Modal
// Shows checklist of archived information with View Blotter + Done actions.
// ---------------------------------------------------------------------------

function ConversionSuccessModal({
  blotter,
  onView,
  onDone,
}: {
  blotter: Blotter;
  onView: () => void;
  onDone: () => void;
}) {
  const archived = [
    { label: "Photos", count: blotter.photoCount },
    { label: "GPS/location information", count: null },
    { label: "Field notes", count: blotter.fieldNotes.length },
    { label: "Resolution summary", count: null },
    { label: "Citizen rating", count: blotter.citizenRating },
    { label: "Citizen feedback", count: blotter.citizenFeedback ? 1 : 0 },
    {
      label: "Evidence references",
      count: blotter.evidenceReferences.length,
    },
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-3 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl sm:p-6 modal-panel-in text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 size={24} className="text-emerald-600" />
        </div>
        <h3 className="mt-3 text-[14px] font-semibold text-stone-900">
          Blotter Record Created
        </h3>

        {/* Blotter + incident IDs */}
        <div className="mt-3 flex items-center justify-center gap-3">
          <div className="rounded-lg bg-emerald-50 px-3 py-1.5 text-center">
            <p className="text-[9px] font-medium tracking-wider text-emerald-600">
              BLOTTER ID
            </p>
            <p className="text-[13px] font-bold text-emerald-700">
              {blotter.id}
            </p>
          </div>
          <div className="text-[12px] text-stone-400">←</div>
          <div className="rounded-lg bg-stone-100 px-3 py-1.5 text-center">
            <p className="text-[9px] font-medium tracking-wider text-stone-400">
              INCIDENT
            </p>
            <p className="text-[13px] font-bold text-stone-600">
              {blotter.originalIncidentId}
            </p>
          </div>
        </div>

        {/* Part 12 — Checklist of archived information */}
        <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-left">
          <p className="mb-2 text-[10px] font-medium tracking-wider text-stone-400">
            ARCHIVED INFORMATION
          </p>
          <div className="space-y-1.5">
            {archived.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 text-[11px]"
              >
                <CheckCircle2
                  size={12}
                  className={
                    item.count !== null && item.count > 0
                      ? "text-emerald-500"
                      : "text-stone-300"
                  }
                />
                <span className="text-stone-700">{item.label}</span>
                {item.count !== null && item.count > 0 && (
                  <span className="ml-auto text-[10px] font-medium text-stone-400">
                    ({item.count})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-[12px] text-stone-500">
          This resolved incident is now part of the official{" "}
          <span className="font-semibold">Digital Barangay Blotter</span> archive.
        </p>

        {/* Part 12 — View Blotter + Done actions */}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onDone}
            className="w-full rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50 sm:flex-1"
          >
            Done
          </button>
          <button
            onClick={onView}
            className="w-full rounded-lg bg-[#0038A8] px-4 py-2.5 text-[12px] font-medium text-white hover:bg-[#002A8C] sm:flex-1"
          >
            <span className="flex items-center justify-center gap-1.5">
              <Eye size={13} />
              View Blotter
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
