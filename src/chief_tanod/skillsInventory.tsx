import { useState, useEffect } from "react";
import {
  Award,
  Shield,
  HeartPulse,
  Zap,
  Radio,
  Users,
  BookOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Edit,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import Modal from "../components/ui/Modal";
import {
  type RosterMember,
} from "./patrolScheduleShared";
import { usePatrolScheduleStore, loadRosterFromBackend, upsertRosterMember } from "./patrolScheduleStore";
import { saveRosterMember } from "./rosterApi";

interface TrainingCertification {
  hasTraining: boolean;
  certificateDate?: string;
  trainingProvider?: string;
  certificateNumber?: string;
  proofOfTraining?: string;
}

interface SkillsInventory {
  existingTanodExperience: string;
  basicPatrolExperience: string;
  firstAidTraining: TrainingCertification;
  selfDefenseTraining: boolean;
  disasterResponseTraining: boolean;
  crowdControlTraining: boolean;
  radioCommunicationSkills: boolean;
  humanRightsOrientation: boolean;
  otherRelevantSkills: string;
  certificateNumbers: string;
}

interface SkillsInventoryProps {
  tanodId?: string;
  onClose?: () => void;
  mode?: "view" | "edit";
}

const emptySkillsInventory: SkillsInventory = {
  existingTanodExperience: "",
  basicPatrolExperience: "",
  firstAidTraining: { hasTraining: false },
  selfDefenseTraining: false,
  disasterResponseTraining: false,
  crowdControlTraining: false,
  radioCommunicationSkills: false,
  humanRightsOrientation: false,
  otherRelevantSkills: "",
  certificateNumbers: "",
};

function SkillsInventoryForm({
  inventory,
  onChange,
  readOnly = false,
}: {
  inventory: SkillsInventory;
  onChange: (inventory: SkillsInventory) => void;
  readOnly?: boolean;
}) {
  const [expandedSection, setExpandedSection] = useState<string>("experience");

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? "" : section);
  };

  const updateField = <K extends keyof SkillsInventory>(
    field: K,
    value: SkillsInventory[K]
  ) => {
    onChange({ ...inventory, [field]: value });
  };

  const updateFirstAidField = <K extends keyof TrainingCertification>(
    field: K,
    value: TrainingCertification[K]
  ) => {
    onChange({
      ...inventory,
      firstAidTraining: { ...inventory.firstAidTraining, [field]: value },
    });
  };

  const sections = [
    {
      id: "experience",
      title: "Experience & Background",
      icon: Award,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      id: "training",
      title: "Training & Certifications",
      icon: Shield,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      id: "skills",
      title: "Specialized Skills",
      icon: Zap,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const Icon = section.icon;
        const isExpanded = expandedSection === section.id;

        return (
          <div
            key={section.id}
            className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden"
          >
            <button
              onClick={() => toggleSection(section.id)}
              className="flex w-full items-center justify-between px-4 py-3 hover:bg-stone-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${section.bgColor} ${section.color}`}>
                  <Icon size={16} />
                </div>
                <span className="text-[13px] font-semibold text-stone-800">
                  {section.title}
                </span>
              </div>
              {isExpanded ? (
                <ChevronDown size={16} className="text-stone-400" />
              ) : (
                <ChevronRight size={16} className="text-stone-400" />
              )}
            </button>

            {isExpanded && (
              <div className="border-t border-stone-100 px-4 py-4 space-y-4">
                {section.id === "experience" && (
                  <>
                    <div>
                      <label className="block text-[11px] font-medium tracking-wider text-stone-400 mb-1.5">
                        EXISTING TANOD EXPERIENCE
                      </label>
                      {readOnly ? (
                        <p className="text-[12px] text-stone-700 min-h-[40px]">
                          {inventory.existingTanodExperience || "Not specified"}
                        </p>
                      ) : (
                        <textarea
                          value={inventory.existingTanodExperience}
                          onChange={(e) => updateField("existingTanodExperience", e.target.value)}
                          rows={2}
                          placeholder="Describe previous Tanod experience, other relevant background..."
                          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-700 outline-none transition focus:border-[#15803D]/50 focus:ring-2 focus:ring-[#15803D]/10"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium tracking-wider text-stone-400 mb-1.5">
                        BASIC PATROL / RONDA EXPERIENCE
                      </label>
                      {readOnly ? (
                        <p className="text-[12px] text-stone-700 min-h-[40px]">
                          {inventory.basicPatrolExperience || "Not specified"}
                        </p>
                      ) : (
                        <textarea
                          value={inventory.basicPatrolExperience}
                          onChange={(e) => updateField("basicPatrolExperience", e.target.value)}
                          rows={2}
                          placeholder="Describe patrol experience, specialized areas..."
                          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-700 outline-none transition focus:border-[#15803D]/50 focus:ring-2 focus:ring-[#15803D]/10"
                        />
                      )}
                    </div>
                  </>
                )}

                {section.id === "training" && (
                  <>
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <HeartPulse size={16} className="text-rose-500" />
                          <span className="text-[12px] font-semibold text-stone-800">
                            First Aid Training
                          </span>
                        </div>
                        {readOnly ? (
                          <span className={`text-[10px] font-semibold ${inventory.firstAidTraining?.hasTraining ? "text-emerald-600" : "text-stone-500"}`}>
                            {inventory.firstAidTraining?.hasTraining ? "Yes" : "No"}
                          </span>
                        ) : (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={inventory.firstAidTraining?.hasTraining || false}
                              onChange={(e) => updateFirstAidField("hasTraining", e.target.checked)}
                              className="h-4 w-4 rounded border-stone-300 text-[#15803D] focus:ring-[#15803D]"
                            />
                            <span className="text-[11px] text-stone-600">Has Training</span>
                          </label>
                        )}
                      </div>

                      {inventory.firstAidTraining?.hasTraining && (
                        <div className="space-y-2 mt-3 pt-3 border-t border-stone-200">
                          <div>
                            <label className="block text-[10px] font-medium text-stone-500 mb-1">
                              Certificate Date
                            </label>
                            {readOnly ? (
                              <p className="text-[11px] text-stone-700">
                                {inventory.firstAidTraining.certificateDate || "Not specified"}
                              </p>
                            ) : (
                              <input
                                type="date"
                                value={inventory.firstAidTraining.certificateDate || ""}
                                onChange={(e) => updateFirstAidField("certificateDate", e.target.value)}
                                className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-[11px] text-stone-700 outline-none transition focus:border-[#15803D]/50"
                              />
                            )}
                          </div>

                          <div>
                            <label className="block text-[10px] font-medium text-stone-500 mb-1">
                              Training Provider
                            </label>
                            {readOnly ? (
                              <p className="text-[11px] text-stone-700">
                                {inventory.firstAidTraining.trainingProvider || "Not specified"}
                              </p>
                            ) : (
                              <input
                                type="text"
                                value={inventory.firstAidTraining.trainingProvider || ""}
                                onChange={(e) => updateFirstAidField("trainingProvider", e.target.value)}
                                placeholder="Training provider name"
                                className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-[11px] text-stone-700 outline-none transition focus:border-[#15803D]/50"
                              />
                            )}
                          </div>

                          <div>
                            <label className="block text-[10px] font-medium text-stone-500 mb-1">
                              Certificate Number
                            </label>
                            {readOnly ? (
                              <p className="text-[11px] text-stone-700">
                                {inventory.firstAidTraining.certificateNumber || "Not specified"}
                              </p>
                            ) : (
                              <input
                                type="text"
                                value={inventory.firstAidTraining.certificateNumber || ""}
                                onChange={(e) => updateFirstAidField("certificateNumber", e.target.value)}
                                placeholder="Certificate or reference number"
                                className="w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-[11px] text-stone-700 outline-none transition focus:border-[#15803D]/50"
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium tracking-wider text-stone-400 mb-2">
                        CERTIFICATE NUMBERS / PROOF OF TRAINING
                      </label>
                      {readOnly ? (
                        <p className="text-[12px] text-stone-700 min-h-[40px]">
                          {inventory.certificateNumbers || "No certificates recorded"}
                        </p>
                      ) : (
                        <textarea
                          value={inventory.certificateNumbers}
                          onChange={(e) => updateField("certificateNumbers", e.target.value)}
                          rows={2}
                          placeholder="List all certificate numbers, references to proof of training..."
                          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-700 outline-none transition focus:border-[#15803D]/50 focus:ring-2 focus:ring-[#15803D]/10"
                        />
                      )}
                    </div>
                  </>
                )}

                {section.id === "skills" && (
                  <div className="space-y-3">
                    {[
                      { key: "selfDefenseTraining", label: "Self-Defense / Basic Martial Arts", icon: Shield },
                      { key: "disasterResponseTraining", label: "Disaster Response / First Responder", icon: AlertCircle },
                      { key: "crowdControlTraining", label: "Crowd Control", icon: Users },
                      { key: "radioCommunicationSkills", label: "Radio / Communication Skills", icon: Radio },
                      { key: "humanRightsOrientation", label: "Human Rights Orientation", icon: BookOpen },
                    ].map((skill) => {
                      const Icon = skill.icon;
                      const hasSkill = inventory[skill.key as keyof SkillsInventory] as boolean;

                      return (
                        <div key={skill.key} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon size={14} className="text-stone-400" />
                            <span className="text-[12px] text-stone-700">{skill.label}</span>
                          </div>
                          {readOnly ? (
                            <span className={`text-[10px] font-semibold ${hasSkill ? "text-emerald-600" : "text-stone-400"}`}>
                              {hasSkill ? "Yes" : "No"}
                            </span>
                          ) : (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hasSkill}
                                onChange={(e) => updateField(skill.key as keyof SkillsInventory, e.target.checked)}
                                className="h-4 w-4 rounded border-stone-300 text-[#15803D] focus:ring-[#15803D]"
                              />
                              <span className="text-[11px] text-stone-600">{hasSkill ? "Yes" : "No"}</span>
                            </label>
                          )}
                        </div>
                      );
                    })}

                    <div className="pt-3 border-t border-stone-200">
                      <label className="block text-[11px] font-medium tracking-wider text-stone-400 mb-1.5">
                        OTHER RELEVANT SKILLS
                      </label>
                      {readOnly ? (
                        <p className="text-[12px] text-stone-700 min-h-[40px]">
                          {inventory.otherRelevantSkills || "None specified"}
                        </p>
                      ) : (
                        <textarea
                          value={inventory.otherRelevantSkills}
                          onChange={(e) => updateField("otherRelevantSkills", e.target.value)}
                          rows={2}
                          placeholder="Any other relevant skills, certifications, or training..."
                          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-[12px] text-stone-700 outline-none transition focus:border-[#15803D]/50 focus:ring-2 focus:ring-[#15803D]/10"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SkillsInventoryModal({
  tanod,
  onClose,
  onSave,
}: {
  tanod: RosterMember;
  onClose: () => void;
  onSave: (tanod: RosterMember, inventory: SkillsInventory) => void;
}) {
  const [inventory, setInventory] = useState<SkillsInventory>(
    tanod.skillsInventory || { ...emptySkillsInventory }
  );
  const { flash } = useToast();

  const handleSave = () => {
    onSave(tanod, inventory);
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      title="Skills Inventory"
      subtitle={`${tanod.name} · ${tanod.purok}`}
      icon={<Award size={18} />}
      iconClass="bg-green-100 text-green-600"
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#15803D] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#166534]"
          >
            <Save size={13} /> Save Changes
          </button>
        </div>
      }
    >
      <SkillsInventoryForm inventory={inventory} onChange={setInventory} readOnly={false} />
    </Modal>
  );
}

export default function SkillsInventory({ tanodId, onClose, mode = "view" }: SkillsInventoryProps) {
  const { roster } = usePatrolScheduleStore();
  const { flash } = useToast();
  const [selectedTanod, setSelectedTanod] = useState<RosterMember | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTanod, setEditingTanod] = useState<RosterMember | null>(null);

  useEffect(() => {
    if (tanodId) {
      const tanod = roster.find((t) => t.id === tanodId);
      if (tanod) {
        setSelectedTanod(tanod);
      }
    }
  }, [tanodId, roster]);

  useEffect(() => {
    loadRosterFromBackend();
  }, []);

  const handleSave = async (tanod: RosterMember, inventory: SkillsInventory) => {
    const updatedTanod = { ...tanod, skillsInventory: inventory };
    upsertRosterMember(updatedTanod);
    setShowEditModal(false);
    setEditingTanod(null);
    try {
      const saved = await saveRosterMember(updatedTanod);
      upsertRosterMember(saved);
      flash(`Skills inventory updated for ${saved.name}`, { type: "success" });
    } catch (err) {
      flash(
        `Failed to save skills inventory for ${tanod.name}: ${err instanceof Error ? err.message : "Unknown error"}`,
        { type: "error" }
      );
    }
  };

  // If a specific tanodId is provided, show their skills inventory directly
  if (tanodId && selectedTanod) {
    if (mode === "edit") {
      return (
        <SkillsInventoryModal
          tanod={selectedTanod}
          onClose={() => onClose?.()}
          onSave={handleSave}
        />
      );
    }

    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-[#DCFCE7]">
        <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
          <header className="mb-6 border-b border-stone-200 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-stone-900">Skills Inventory</h1>
                <p className="mt-1 text-sm text-stone-500">
                  {selectedTanod.name} · {selectedTanod.purok}
                </p>
              </div>
              <button
                onClick={() => onClose?.()}
                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
              >
                <X size={14} /> Close
              </button>
            </div>
          </header>

          <div className="rounded-xl border border-black/5 bg-white shadow-sm p-4">
            <SkillsInventoryForm
              inventory={selectedTanod.skillsInventory || { ...emptySkillsInventory }}
              onChange={() => {}}
              readOnly={true}
            />
          </div>
        </main>
      </div>
    );
  }

  // Otherwise, show the roster view for selecting a tanod
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#DCFCE7]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Skills Inventory</h1>
            <p className="mt-1 text-sm text-stone-500">
              Manage and review Tanod skills, training, and certifications
            </p>
          </div>
        </header>

        <div className="space-y-3">
          {roster.length === 0 && (
            <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
              <p className="text-[13px] font-medium text-stone-600">No registered Tanod yet</p>
              <p className="mt-1 text-[11px] text-stone-400">
                Tanod accounts registered in User Management will appear here automatically.
              </p>
            </div>
          )}
          {roster.map((tanod) => {
            const hasSkillsInventory = tanod.skillsInventory && Object.keys(tanod.skillsInventory).length > 0;
            const trainingCount = [
              tanod.skillsInventory?.firstAidTraining?.hasTraining,
              tanod.skillsInventory?.selfDefenseTraining,
              tanod.skillsInventory?.disasterResponseTraining,
              tanod.skillsInventory?.crowdControlTraining,
              tanod.skillsInventory?.radioCommunicationSkills,
              tanod.skillsInventory?.humanRightsOrientation,
            ].filter(Boolean).length;

            return (
              <div
                key={tanod.id}
                className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm hover:border-[#15803D]/30 transition cursor-pointer"
                onClick={() => setSelectedTanod(tanod)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D] font-bold">
                      {tanod.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[13px] font-semibold text-stone-800">{tanod.name}</h3>
                        {hasSkillsInventory && (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                            <CheckCircle2 size={10} />
                            Complete
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-stone-500">{tanod.purok}</p>
                      {hasSkillsInventory && (
                        <p className="mt-1 text-[10px] text-stone-400">
                          {trainingCount} training(s) recorded
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTanod(tanod);
                        setShowEditModal(true);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:text-[#15803D] transition"
                      title="Edit Skills Inventory"
                    >
                      <Edit size={14} />
                    </button>
                    <ChevronRight size={16} className="text-stone-300" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {showEditModal && editingTanod && (
        <SkillsInventoryModal
          tanod={editingTanod}
          onClose={() => {
            setShowEditModal(false);
            setEditingTanod(null);
          }}
          onSave={handleSave}
        />
      )}

      {selectedTanod && !tanodId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedTanod(null)}>
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 border-b border-stone-200 bg-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-stone-900">Skills Inventory</h2>
                <p className="text-sm text-stone-500">{selectedTanod.name} · {selectedTanod.purok}</p>
              </div>
              <button
                onClick={() => setSelectedTanod(null)}
                className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-[12px] font-medium text-stone-600 hover:bg-stone-50"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-6">
              <SkillsInventoryForm
                inventory={selectedTanod.skillsInventory || { ...emptySkillsInventory }}
                onChange={() => {}}
                readOnly={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}