import { type ReactNode } from "react";
import { X } from "lucide-react";

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
};

const HEADER_ICON_CHIP =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl";

interface ModalProps {
  open?: boolean;
  onClose?: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  iconClass?: string;
  aside?: ReactNode;
  centered?: boolean;
  side?: "center" | "right";
  size?: keyof typeof SIZES | (string & {});
  footer?: ReactNode;
  panelClass?: string;
  children: ReactNode;
}

export default function Modal({
  open = true,
  onClose,
  title,
  subtitle,
  icon,
  iconClass = "",
  aside,
  centered = false,
  side = "center",
  size = "md",
  footer,
  panelClass = "",
  children,
}: ModalProps) {
  if (!open) return null;

  const sizeClass = (SIZES[size] ?? size) as string;

  const closeButton = (
    <button
      onClick={onClose}
      aria-label="Close"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
    >
      <X className="h-4 w-4" />
    </button>
  );

  if (side === "right") {
    return (
      <div className="fixed inset-0 z-[90] flex items-stretch justify-end bg-black/50 backdrop-blur-sm">
        <div
          className={`flex h-full w-full ${sizeClass} flex-col overflow-hidden border-l border-stone-200 bg-white shadow-2xl drawer-panel-in ${panelClass}`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
            <div className="min-w-0">
              {title && (
                <h2 className="truncate text-[15px] font-bold text-stone-900">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-0.5 truncate text-[12px] text-stone-400">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {aside}
              {onClose && closeButton}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && (
            <div className="border-t border-stone-200 px-5 py-4">{footer}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-3 backdrop-blur-sm">
      <div
        className={`relative w-full ${sizeClass} max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-2xl modal-panel-in ${panelClass}`}
      >
        <div className="p-5 sm:p-6">
          {(title || icon || aside || onClose) && (
            <div className={`mb-5 ${centered ? "relative" : "flex items-start justify-between gap-3"}`}>
              <div className={`flex min-w-0 items-center gap-3 ${centered ? "flex-col text-center" : ""}`}>
                {icon && (
                  <div
                    className={`${HEADER_ICON_CHIP} ${iconClass || "bg-[#0038A8]/10 text-[#0038A8]"}`}
                  >
                    {icon}
                  </div>
                )}
                <div className="min-w-0">
                  {title && (
                    <h2 className="truncate text-[15px] font-bold text-stone-900">
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="mt-0.5 text-[12px] text-stone-400">{subtitle}</p>
                  )}
                </div>
              </div>
              {(aside || onClose) && (
                <div className={`flex shrink-0 items-center gap-2 ${centered ? "absolute right-0 top-0" : ""}`}>
                  {aside}
                  {onClose && closeButton}
                </div>
              )}
            </div>
          )}
          {children}
        </div>
        {footer && (
          <div className="border-t border-stone-200 bg-stone-50 px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}