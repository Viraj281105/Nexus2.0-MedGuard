"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck, ArrowRight, Mail, Lock } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { apiUrl, setAuth } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Login failed");
      }

      const data = await res.json();
      setAuth(data.access_token, data.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-slate-900">
      <Header showNav={false} />

      <div className="flex flex-1 items-center justify-center px-4 py-14">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="space-y-3 text-center">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4f7df3] via-[#4fc3a1] to-[#56c271] shadow-lg shadow-blue-300/40">
                  <ShieldCheck className="w-8 h-8 text-white drop-shadow-sm" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  Welcome Back
                </h1>
                <p className="mt-2 text-slate-600">
                  Sign in to your MedGuard account
                </p>
              </div>
            </div>

            {/* Form Card */}
            <Card variant="glass" className="p-8 space-y-6 bg-white/70 backdrop-blur-sm border-slate-200/60 shadow-xl shadow-blue-100/30">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm"
                >
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  icon={<Mail className="w-5 h-5" />}
                  disabled={loading}
                />

                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  icon={<Lock className="w-5 h-5" />}
                  disabled={loading}
                />

                <div className="flex justify-end">
                  <Link
                    href="#"
                    className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  isLoading={loading}
                  fullWidth
                  size="lg"
                  className="bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md hover:shadow-lg hover:shadow-blue-300/30 transition-all duration-300 font-semibold"
                  icon={!loading && <ArrowRight className="w-5 h-5" />}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white/80 px-3 text-slate-500 backdrop-blur-sm">
                    Don&#39;t have an account?
                  </span>
                </div>
              </div>

              <Link href="/register" className="block">
                <Button variant="outline" fullWidth size="lg" className="border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-300">
                  Create Account
                </Button>
              </Link>
            </Card>

            {/* Security Info */}
            <div className="space-y-3">
              {[
                "256-bit SSL encryption",
                "HIPAA compliant",
                "Your data is secure",
              ].map((info, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * idx }}
                  className="flex items-center gap-2 text-sm text-slate-600"
                >
                  <ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-500 drop-shadow-sm" />
                  {info}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}