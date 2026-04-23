"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@/lib/validation";
import Link from "next/link";
import { useState, forwardRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, User } from "lucide-react";
import { toast } from "sonner";
import { signIn } from "next-auth/react";

// ── Constants ─────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: "⚡", text: "Real-time collaboration across your team" },
  { icon: "📄", text: "Version-controlled documents with proposals" },
  { icon: "🤖", text: "AI assistant built into every workspace" },
];

const TESTIMONIAL = {
  quote: "CoWork replaced three tools for us. Our team is finally on the same page.",
  author: "Chiranjiv A.",
  role: "Head of Product, Figma",
  avatar: "P",
};

// ── Field Input ───────────────────────────────────────────────────────────────
type FieldInputProps = {
  label: string;
  id: string;
  type?: string;
  placeholder?: string;
  icon: React.ReactNode;
  error?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

const FieldInput = forwardRef<HTMLInputElement, FieldInputProps>(
  ({ label, id, type = "text", placeholder, icon, error, onBlur, onFocus, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const isPw = type === "password";

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-[12px] font-semibold text-[#3f3f46]">
          {label}
        </label>
        <div
          className="flex items-center gap-2 rounded-lg px-3 h-10 bg-white transition-all duration-150"
          style={{
            border: `1.5px solid ${error ? "#e11d48" : focused ? "#4f46e5" : "#e4e4e7"}`,
            boxShadow: focused
              ? `0 0 0 3px ${error ? "rgba(225,29,72,.1)" : "rgba(79,70,229,.1)"}`
              : "none",
          }}
        >
          <span
            className="flex-shrink-0 transition-colors duration-150"
            style={{ color: focused ? "#4f46e5" : "#a1a1aa" }}
          >
            {icon}
          </span>
          <input
            ref={ref}
            id={id}
            type={isPw ? (showPw ? "text" : "password") : type}
            placeholder={placeholder}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            className="flex-1 border-none bg-transparent text-[13px] font-medium text-[#18181b] outline-none placeholder:text-[#a1a1aa]"
            {...props}
          />
          {isPw && (
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="text-[#a1a1aa] hover:text-[#71717a] transition-colors flex-shrink-0 flex"
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
        </div>
        {error && (
          <span className="text-[11px] font-medium text-[#e11d48]">{error}</span>
        )}
      </div>
    );
  }
);
FieldInput.displayName = "FieldInput";

// ── Password Strength Bar ─────────────────────────────────────────────────────
function StrengthBar({ password }: { password: string }) {
  if (!password) return null;

  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const colors = ["#e11d48", "#d97706", "#059669", "#4f46e5"];
  const labels = ["Weak", "Fair", "Good", "Strong"];

  return (
    <div className="mt-1.5">
      <div className="flex gap-[3px] mb-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-1 h-[3px] rounded-full transition-all duration-200"
            style={{ background: i < score ? colors[score - 1] : "#e4e4e7" }}
          />
        ))}
      </div>
      {score > 0 && (
        <span
          className="text-[11px] font-semibold"
          style={{ color: colors[score - 1] }}
        >
          {labels[score - 1]}
        </span>
      )}
    </div>
  );
}

// ── Brand Panel ───────────────────────────────────────────────────────────────
function BrandPanel() {
  return (
    <div className="hidden lg:flex flex-1 flex-col justify-between bg-[#09090b] relative overflow-hidden p-12">
      {/* Background grid */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="auth-grid-signup" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-grid-signup)" />
      </svg>

      {/* Glow spots */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full pointer-events-none -top-20 -right-20"
        style={{
          background: "radial-gradient(circle, rgba(79,70,229,.18) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute w-[300px] h-[300px] rounded-full pointer-events-none bottom-16 -left-16"
        style={{
          background: "radial-gradient(circle, rgba(124,58,237,.12) 0%, transparent 70%)",
        }}
      />

      {/* Top content */}
      <div className="relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-16">
          <div className="w-8 h-8 rounded-[9px] bg-[#4f46e5] flex items-center justify-center">
            <span className="text-white text-[15px] font-extrabold">C</span>
          </div>
          <span className="text-white text-[15px] font-bold">CoWork</span>
        </div>

        {/* Pill badge */}
        <div className="inline-flex items-center gap-1.5 bg-[#1e1b4b] border border-[#312e81] rounded-full px-3 py-1 mb-5">
          <span className="text-[11px] text-[#818cf8] font-semibold tracking-wide">
            ⚡ Local-first · Offline-capable · Real-time
          </span>
        </div>

        {/* Headline */}
        <h2
          className="text-[34px] font-extrabold text-white mb-3.5"
          style={{ lineHeight: 1.15, letterSpacing: "-1.5px" }}
        >
          Collaborate without
          <br />
          <span className="text-[#818cf8]">compromise.</span>
        </h2>
        <p className="text-[14px] text-[#71717a] leading-[1.75] max-w-[320px] mb-10">
          One workspace for documents, proposals, and team decisions — all synced in real time.
        </p>

        {/* Feature list */}
        <div className="flex flex-col gap-3">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-3"
              style={{
                animation: `slideInLeft 300ms cubic-bezier(.22,1,.36,1) ${100 + i * 60}ms both`,
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-sm flex-shrink-0">
                {f.icon}
              </div>
              <span className="text-[13px] text-[#a1a1aa] leading-relaxed">{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Testimonial */}
      <div className="relative z-10 bg-white/[0.04] border border-white/[0.08] rounded-xl p-5">
        <p className="text-[13px] text-[#d4d4d8] leading-[1.65] mb-3.5 italic">
          &ldquo;{TESTIMONIAL.quote}&rdquo;
        </p>
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-full bg-[#7c3aed] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {TESTIMONIAL.avatar}
          </div>
          <div>
            <div className="text-xs font-bold text-white">{TESTIMONIAL.author}</div>
            <div className="text-[11px] text-[#71717a]">{TESTIMONIAL.role}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Signup Page ───────────────────────────────────────────────────────────────
export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  const passwordValue = watch("password") ?? "";

  async function onSubmit(data: SignupInput) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to create account");
        return;
      }
      await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      toast.success("Account created successfully");
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen lg:h-screen lg:overflow-hidden">
      {/* ── Form side ── */}
      <div className="w-full lg:w-[520px] lg:flex-shrink-0 bg-white lg:border-r lg:border-[#e4e4e7] flex flex-col">
        {/* Scrollable form area */}
        <div className="flex-1 lg:overflow-y-auto flex items-center justify-center px-6 sm:px-12 lg:px-[70px] py-12">
          <div className="w-full max-w-[380px] page-animate">
            {/* Back to home */}
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#71717a] hover:text-[#18181b] transition-colors mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to home
            </Link>

            {/* Logo mark */}
            <div className="w-10 h-10 rounded-xl bg-[#4f46e5] flex items-center justify-center mb-6">
              <span className="text-white text-lg font-extrabold">C</span>
            </div>

            <h1
              className="text-2xl font-extrabold text-[#18181b] mb-1.5"
              style={{ letterSpacing: "-0.5px" }}
            >
              Create an account
            </h1>
            <p className="text-[13px] text-[#71717a] leading-[1.6] mb-7">
              Start collaborating with your team today.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
              <FieldInput
                label="Full name"
                id="name"
                placeholder="Jane Doe"
                icon={<User size={14} />}
                error={errors.name?.message}
                autoComplete="name"
                {...register("name")}
              />

              <FieldInput
                label="Email address"
                id="email"
                type="email"
                placeholder="you@example.com"
                icon={<Mail size={14} />}
                error={errors.email?.message}
                autoComplete="email"
                {...register("email")}
              />

              <div className="flex flex-col gap-1.5">
                <FieldInput
                  label="Password"
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  icon={<Lock size={14} />}
                  error={errors.password?.message}
                  autoComplete="new-password"
                  {...register("password")}
                />
                <StrengthBar password={passwordValue} />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full h-[42px] rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-60 text-white text-[14px] font-bold flex items-center justify-center gap-1.5 transition-all duration-150 hover:-translate-y-px cursor-pointer"
                style={{ boxShadow: "0 1px 2px rgba(79,70,229,.25)" }}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Get started free
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            <p className="text-center mt-4 text-[12px] text-[#71717a]">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-[#4f46e5] font-semibold hover:text-[#4338ca] transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-12 lg:px-[70px] py-4 border-t border-[#f4f4f5] flex gap-4">
          {["Privacy", "Terms", "Help"].map((l) => (
            <span
              key={l}
              className="text-[11px] text-[#a1a1aa] font-medium cursor-pointer hover:text-[#71717a] transition-colors"
            >
              {l}
            </span>
          ))}
          <span className="ml-auto text-[11px] text-[#a1a1aa]">© 2025 CoWork</span>
        </div>
      </div>

      {/* ── Brand panel ── */}
      <BrandPanel />
    </div>
  );
}
