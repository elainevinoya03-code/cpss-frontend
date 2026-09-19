import { useState, useEffect, useRef } from "react";
import { User, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import culiatBg from "../assets/culiat.jpg";
import logo from "../assets/logo.png";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface LoginResponse {
  id: number;
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  purok: string;
  active: boolean;
  twoFactor: string;
  lastLogin: string;
}

interface LoginProps {
  onLogin?: (e: React.FormEvent, userData: LoginResponse) => void;
  onNavigateToLanding?: () => void;
}

export default function Login({ onLogin, onNavigateToLanding }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ email: string | null; password: string | null; general: string | null }>({ email: null, password: null, general: null });
  const [shakeField, setShakeField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [leftVisible, setLeftVisible] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    const t = setTimeout(() => setLeftVisible(true), 200);
    return () => clearTimeout(t);
  }, []);

  const triggerShake = (field: string) => {
    setShakeField(field);
    setTimeout(() => setShakeField(null), 500);
  };

  const validate = () => {
    const newErrors: { email: string | null; password: string | null; general: string | null } = { email: null, password: null, general: null };
    if (!email.trim()) {
      newErrors.email = "Email is required";
      triggerShake("email");
    }
    if (!password.trim()) {
      newErrors.password = "Password is required";
      triggerShake("password");
    } else if (password.length < 4) {
      newErrors.password = "Password must be at least 4 characters";
      triggerShake("password");
    }
    setErrors(newErrors);
    return Object.values(newErrors).every((v) => v === null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({ email: null, password: null, general: null });

    try {
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
      } catch (networkErr) {
        const altBase = API_BASE.includes("8080")
          ? API_BASE.replace("8080", "8000")
          : API_BASE.includes("8000")
          ? API_BASE.replace("8000", "8080")
          : null;
        if (altBase) {
          res = await fetch(`${altBase}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
          });
        } else {
          throw networkErr;
        }
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.detail || "Login failed";
        setErrors({ email: null, password: null, general: msg });
        setLoading(false);
        triggerShake("email");
        return;
      }

      const data: LoginResponse = await res.json();
      setLoading(false);
      if (onLogin) onLogin(e, data);
    } catch (err) {
      setErrors({ email: null, password: null, general: "Cannot connect to server. Please try again." });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-white" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Left panel - hidden on mobile, visible on md screens+ */}
      <div className="relative hidden md:flex md:flex-1">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${culiatBg})` }}
        >
          <div className="absolute inset-0 bg-[#052E16]/90" />
          <div
            className="relative z-10 flex h-full flex-col justify-center px-8 lg:px-20 xl:px-[120px]"
            style={{
              opacity: leftVisible ? 1 : 0,
              transform: leftVisible ? "translateX(0)" : "translateX(-40px)",
              transition: "all 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
          <div className="relative max-w-[460px]">
            <h2 className="m-0 text-[clamp(24px,5vw,42px)] font-extrabold tracking-[0.02em] text-white">
              BARANGAY CULIAT
            </h2>
            <p className="m-0 mt-1.5 text-[clamp(14px,2.5vw,22px)] font-semibold tracking-[0.2em] text-white/75">
              DISTRICT 6 QUEZON CITY
            </p>
            <h1 className="m-0 text-[clamp(28px,5vw,48px)] font-extrabold leading-tight -tracking-[0.01em] text-white">
              Public Safety and Security System
            </h1>
            <p className="mt-4 max-w-[480px] text-[clamp(16px,2.5vw,24px)] leading-relaxed text-white/80">
              Community Policing and Surveillance System
            </p>
          </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center bg-white px-4 py-8 sm:px-6 lg:px-12">
        <form
          className="flex w-full max-w-[680px] flex-col px-4 py-8 sm:px-8 lg:px-14"
          onSubmit={handleSubmit}
        >
          {/* Logo + Header */}
          <div
            className="mb-8 flex flex-col items-center sm:mb-10"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(24px)",
              transition: "all 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.15s",
            }}
          >
            <button
              type="button"
              onClick={onNavigateToLanding}
              className="mb-5 cursor-pointer border-none bg-transparent p-0 transition-transform hover:scale-105"
              disabled={loading}
            >
              <img src={logo} alt="Logo" className="h-auto w-[120px] object-contain sm:w-[160px]" />
            </button>
            <h2 className="m-0 text-center text-[clamp(28px,5vw,40px)] font-extrabold text-[#15803D]">
              Welcome Back!
            </h2>
            <p className="m-0 mt-2 text-center text-[clamp(14px,2vw,18px)] text-[#6B788C]">
              Please sign in to continue
            </p>
          </div>

          {/* General error */}
          {errors.general && (
            <div className="mb-6 flex animate-[fadeIn_0.4s_ease] items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-[15px] font-semibold text-red-600">
              <AlertCircle size={20} />
              {errors.general}
            </div>
          )}

          {/* Email */}
          <div
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.3s",
            }}
          >
            <label className="mb-3 flex items-center gap-2 text-[clamp(15px,2vw,18px)] font-bold text-[#14532D]" htmlFor="email">
              <User size={18} className="text-[#15803D]" />
              Email
            </label>
            <div
              className="relative rounded-xl border-[1.5px] bg-[#F1F5F9] transition-all duration-200"
              style={{
                borderColor: errors.email
                  ? "#dc2626"
                  : focusedField === "email"
                    ? "#15803D"
                    : "#E2E8F0",
                boxShadow: errors.email
                  ? "inset 0 0 0 1px rgba(220,38,38,0.1)"
                  : focusedField === "email"
                    ? "inset 0 0 0 1px rgba(0,56,168,0.1)"
                    : "none",
                animation:
                  shakeField === "email" ? "shake 0.4s ease-in-out" : "none",
              }}
            >
              <input
                ref={emailRef}
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField("email")}
                onBlur={() => {
                  setFocusedField(null);
                  if (errors.email) setErrors((p) => ({ ...p, email: null, general: null }));
                }}
                className="w-full border-none bg-transparent px-5 py-4 text-[clamp(15px,2vw,18px)] text-[#14532D] outline-none sm:px-[22px] sm:py-5"
                disabled={loading}
              />
            </div>
            {errors.email && (
              <div className="mt-2 flex items-center gap-1.5 text-[14px] font-medium text-red-600">
                <AlertCircle size={14} />
                {errors.email}
              </div>
            )}
          </div>

          {/* Password */}
          <div
            className="mt-4 sm:mt-5"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.45s",
            }}
          >
            <label className="mb-3 flex items-center gap-2 text-[clamp(15px,2vw,18px)] font-bold text-[#14532D]" htmlFor="password">
              <Lock size={18} className="text-[#15803D]" />
              Password
            </label>
            <div
              className="relative rounded-xl border-[1.5px] bg-[#F1F5F9] transition-all duration-200"
              style={{
                borderColor: errors.password
                  ? "#dc2626"
                  : focusedField === "password"
                    ? "#15803D"
                    : "#E2E8F0",
                boxShadow: errors.password
                  ? "inset 0 0 0 1px rgba(220,38,38,0.1)"
                  : focusedField === "password"
                    ? "inset 0 0 0 1px rgba(0,56,168,0.1)"
                    : "none",
                animation:
                  shakeField === "password" ? "shake 0.4s ease-in-out" : "none",
              }}
            >
              <input
                ref={passwordRef}
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField("password")}
                onBlur={() => {
                  setFocusedField(null);
                  if (errors.password) setErrors((p) => ({ ...p, password: null, general: null }));
                }}
                className="w-full border-none bg-transparent px-5 py-4 pr-[52px] text-[clamp(15px,2vw,18px)] text-[#14532D] outline-none sm:px-[22px] sm:py-5"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-none p-1 text-[#64748B]"
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <div className="mt-2 flex items-center gap-1.5 text-[14px] font-medium text-red-600">
                <AlertCircle size={14} />
                {errors.password}
              </div>
            )}
          </div>

          {/* Submit button */}
          <div
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.6s",
            }}
          >
            <button
              type="submit"
              className="mt-6 w-full overflow-hidden rounded-xl border-none px-4 py-4 text-[clamp(16px,2vw,20px)] font-bold text-white transition-all duration-200 hover:opacity-90 sm:mt-8 sm:py-[22px] disabled:opacity-80"
              style={{
                background: "#15803D",
                transform: loading ? "scale(0.98)" : "scale(1)",
              }}
              disabled={loading}
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2.5">
                  <span className="login-spinner inline-block h-5 w-5 shrink-0 rounded-full border-[2.5px] border-white/60 border-t-white" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Shake + entrance keyframes */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes login-spin {
          to { transform: rotate(360deg); }
        }
        .login-spinner {
          animation: login-spin 0.8s linear infinite;
          will-change: transform;
        }
      `}</style>
    </div>
  );
}
