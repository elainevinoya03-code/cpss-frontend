import { useState, useEffect, useRef } from "react";
import { ArrowLeft, CheckCircle, AlertCircle, RefreshCw, Shield } from "lucide-react";

interface OtpProps {
  onVerify: (otp: string) => void;
  onBack: () => void;
  userData: {
    name: string;
    email: string;
    role: string;
  };
}

const DEMO_OTP = "123456"; // Demo OTP for testing

export default function OtpVerification({ onVerify, onBack, userData }: OtpProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [resendDisabled, setResendDisabled] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    // Focus first input on mount
    setTimeout(() => {
      if (inputRefs.current[0]) {
        inputRefs.current[0]?.focus();
      }
    }, 100);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setResendDisabled(false);
    }
  }, [timeLeft]);

  const handleChange = (index: number, value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, "");
    
    if (numericValue.length > 1) {
      // Handle paste or multiple digits
      const digits = numericValue.split("").slice(0, 6 - index);
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      
      // Focus the next empty input or the last filled one
      const nextEmptyIndex = newOtp.findIndex((val) => val === "");
      const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
      setTimeout(() => {
        if (inputRefs.current[focusIndex]) {
          inputRefs.current[focusIndex]?.focus();
        }
      }, 0);
    } else {
      // Handle single digit
      const newOtp = [...otp];
      newOtp[index] = numericValue;
      setOtp(newOtp);
      setError(null);

      // Auto-focus next input
      if (numericValue && index < 5) {
        setTimeout(() => {
          if (inputRefs.current[index + 1]) {
            inputRefs.current[index + 1]?.focus();
          }
        }, 0);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      setTimeout(() => {
        if (inputRefs.current[index - 1]) {
          inputRefs.current[index - 1]?.focus();
        }
      }, 0);
    } else if (e.key === "ArrowLeft" && index > 0) {
      setTimeout(() => {
        if (inputRefs.current[index - 1]) {
          inputRefs.current[index - 1]?.focus();
        }
      }, 0);
    } else if (e.key === "ArrowRight" && index < 5) {
      setTimeout(() => {
        if (inputRefs.current[index + 1]) {
          inputRefs.current[index + 1]?.focus();
        }
      }, 0);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    const newOtp = [...otp];
    pastedData.split("").forEach((digit, i) => {
      if (i < 6) {
        newOtp[i] = digit;
      }
    });
    setOtp(newOtp);
    setError(null);
    
    // Focus the next empty input or the last filled one
    const nextEmptyIndex = newOtp.findIndex((val) => val === "");
    const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
    setTimeout(() => {
      if (inputRefs.current[focusIndex]) {
        inputRefs.current[focusIndex]?.focus();
      }
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpValue = otp.join("");
    
    if (otpValue.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setLoading(true);
    setError(null);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (otpValue === DEMO_OTP) {
      onVerify(otpValue);
    } else {
      setError("Invalid OTP. Please try again.");
      setLoading(false);
      // Clear OTP and focus first input
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => {
        if (inputRefs.current[0]) {
          inputRefs.current[0]?.focus();
        }
      }, 100);
    }
  };

  const handleResend = () => {
    // Demo: reset timer and show success message
    setTimeLeft(300);
    setResendDisabled(true);
    // In a real app, this would trigger a new OTP to be sent
    setTimeout(() => {
      if (inputRefs.current[0]) {
        inputRefs.current[0]?.focus();
      }
    }, 100);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex min-h-screen w-full bg-white" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Left panel - decorative */}
      <div className="relative hidden md:flex md:flex-1 bg-gradient-to-br from-[#0038A8] to-[#06122B]">
        <div className="relative z-10 flex h-full flex-col justify-center px-8 lg:px-20 xl:px-[120px]">
          <div
            className="max-w-[460px]"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateX(0)" : "translateX(-40px)",
              transition: "all 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
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

      {/* Right panel - OTP form */}
      <div className="flex flex-1 items-center justify-center bg-white px-4 py-8 sm:px-6 lg:px-12">
        <div
          className="flex w-full max-w-[680px] flex-col px-4 py-8 sm:px-8 lg:px-14"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(24px)",
            transition: "all 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.15s",
          }}
        >
          {/* Back button */}
          <button
            type="button"
            onClick={onBack}
            className="mb-6 flex items-center gap-2 text-[15px] font-semibold text-[#6B788C] transition-colors hover:text-[#0038A8] disabled:opacity-50"
            disabled={loading}
          >
            <ArrowLeft size={18} />
            Back to Login
          </button>

          {/* Header */}
          <div className="mb-8 text-center sm:mb-10">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-[#0038A8]/10 p-4">
                <Shield size={32} className="text-[#0038A8]" />
              </div>
            </div>
            <h2 className="m-0 text-[clamp(28px,5vw,40px)] font-extrabold text-[#0038A8]">
              Verify Your Identity
            </h2>
            <p className="m-0 mt-3 text-center text-[clamp(14px,2vw,18px)] text-[#6B788C]">
              Enter the 6-digit code sent to{" "}
              <span className="font-semibold text-[#33437A]">{userData.email}</span>
            </p>
          </div>

          {/* Demo notice */}
          <div className="mb-6 rounded-xl bg-blue-50 p-4 border border-blue-100">
            <div className="flex items-center gap-2 text-[14px] text-[#0038A8]">
              <Shield size={16} />
              <span className="font-semibold">Demo OTP: <span className="font-mono font-bold">{DEMO_OTP}</span></span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 flex animate-[fadeIn_0.4s_ease] items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-[15px] font-semibold text-red-600">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {/* OTP Form */}
          <form onSubmit={handleSubmit}>
            {/* OTP Input */}
            <div className="mb-8">
              <label className="mb-4 block text-[clamp(15px,2vw,18px)] font-bold text-[#33437A]">
                Verification Code
              </label>
              <div className="flex gap-2 sm:gap-3">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    className="aspect-square w-full rounded-xl border-[2px] bg-[#F1F5F9] text-center text-[clamp(20px,3vw,32px)] font-bold text-[#33437A] outline-none transition-all duration-200 focus:border-[#0038A8] focus:bg-white focus:shadow-lg focus:shadow-[#0038A8]/10 disabled:opacity-50"
                    style={{
                      borderColor: focusedIndex === index ? "#0038A8" : error ? "#dc2626" : "#E2E8F0",
                      boxShadow: focusedIndex === index ? "0 0 0 3px rgba(0,56,168,0.1)" : "none",
                    }}
                    disabled={loading}
                  />
                ))}
              </div>
            </div>

            {/* Timer and Resend */}
            <div className="mb-8 flex items-center justify-center gap-2 text-[14px] text-[#6B788C]">
              {resendDisabled ? (
                <>
                  <span>Resend code in</span>
                  <span className="font-semibold text-[#0038A8]">{formatTime(timeLeft)}</span>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  className="flex items-center gap-2 font-semibold text-[#0038A8] transition-colors hover:text-[#0052CC] disabled:opacity-50"
                  disabled={loading}
                >
                  <RefreshCw size={16} />
                  Resend Code
                </button>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              className="w-full overflow-hidden rounded-xl border-none px-4 py-4 text-[clamp(16px,2vw,20px)] font-bold text-white transition-all duration-200 hover:opacity-90 sm:py-[22px] disabled:opacity-80"
              style={{
                background: "#0038A8",
                transform: loading ? "scale(0.98)" : "scale(1)",
              }}
              disabled={loading || otp.join("").length !== 6}
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2.5">
                  <span className="inline-block h-5 w-5 animate-[spin_0.7s_linear_infinite] rounded-full border-[2.5px] border-white/30 border-t-white" />
                  Verifying...
                </span>
              ) : (
                <span className="inline-flex items-center justify-center gap-2.5">
                  <CheckCircle size={20} />
                  Verify & Continue
                </span>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}