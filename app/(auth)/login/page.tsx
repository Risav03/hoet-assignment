"use client";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      if (result?.error) {
        toast.error("Invalid email or password");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#fafafa" }}
    >
      {/* Logo block */}
      <div className="flex flex-col items-center mb-8">
        <div
          className="flex items-center justify-center font-extrabold text-white mb-4"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "#4f46e5",
            fontSize: 18,
          }}
        >
          C
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#18181b", marginBottom: 4 }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 13, color: "#71717a" }}>Sign in to your CoWork account</p>
      </div>

      {/* Form card */}
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#ffffff",
          border: "1px solid #e4e4e7",
          borderRadius: 12,
          padding: 28,
          boxShadow: "0 1px 3px rgba(0,0,0,.04)",
        }}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              style={{ fontSize: 12, fontWeight: 600, color: "#3f3f46" }}
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              {...register("email")}
              style={{
                border: "1.5px solid #e4e4e7",
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 13,
                fontWeight: 500,
              }}
              className="focus-visible:border-indigo-500 focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,.1)] focus-visible:ring-0"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              style={{ fontSize: 12, fontWeight: 600, color: "#3f3f46" }}
            >
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              {...register("password")}
              style={{
                border: "1.5px solid #e4e4e7",
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 13,
                fontWeight: 500,
              }}
              className="focus-visible:border-indigo-500 focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,.1)] focus-visible:ring-0"
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full font-semibold text-white"
            disabled={loading}
            style={{
              background: "#4f46e5",
              borderRadius: 8,
              marginTop: 20,
              height: 38,
              boxShadow: "0 1px 2px rgba(79,70,229,.25)",
            }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Sign in
          </Button>
        </form>
        <p
          className="text-center mt-5"
          style={{ fontSize: 12, color: "#71717a" }}
        >
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold hover:underline"
            style={{ color: "#4f46e5" }}
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
