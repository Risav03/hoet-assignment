"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { signIn } from "next-auth/react";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

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
      router.push("/dashboard");
      router.refresh();
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
          Create an account
        </h1>
        <p style={{ fontSize: 13, color: "#71717a" }}>Start collaborating with your team</p>
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
              htmlFor="name"
              style={{ fontSize: 12, fontWeight: 600, color: "#3f3f46" }}
            >
              Full name
            </Label>
            <Input
              id="name"
              placeholder="Jane Doe"
              autoComplete="name"
              {...register("name")}
              style={{
                border: "1.5px solid #e4e4e7",
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 13,
                fontWeight: 500,
              }}
              className="focus-visible:border-indigo-500 focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,.1)] focus-visible:ring-0"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
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
              autoComplete="new-password"
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
            Create account
          </Button>
        </form>
        <p
          className="text-center mt-5"
          style={{ fontSize: 12, color: "#71717a" }}
        >
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold hover:underline"
            style={{ color: "#4f46e5" }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
