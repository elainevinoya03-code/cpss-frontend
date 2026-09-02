import { Shield } from "lucide-react";

export default function ChiefTanodDashboard({
  onNavigate,
}: {
  onNavigate?: (page: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0038A8] text-white">
              <Shield size={18} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-stone-900">
                Chief Tanod Dashboard
              </h1>
              <p className="mt-1 text-sm text-stone-500">
                Tanod operations &amp; team management
              </p>
            </div>
          </div>
        </header>
      </main>
    </div>
  );
}
