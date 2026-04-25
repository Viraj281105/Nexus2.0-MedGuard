"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck, ArrowRight, Mail, Lock, CheckCircle2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { apiUrl, setAuth } from "@/lib/api";

export default function RegisterPage() {
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
      const res = await fetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Registration failed");
      }
      const data = await res.json();
      setAuth(data.access_token, data.user);
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const passwordRequirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Contains lowercase letter", met: /[a-z]/.test(password) },
    { label: "Contains number or symbol", met: /[0-9!@#$%^&*]/.test(password) },
  ];

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
                  Create Account
                </h1>
                <p className="mt-2 text-slate-600">
                  Join MedGuard and start auditing your medical bills
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
                  minLength={8}
                  placeholder="Create a strong password"
                  icon={<Lock className="w-5 h-5" />}
                  disabled={loading}
                  hint="Minimum 8 characters with mixed case and numbers"
                />

                {/* Password Requirements */}
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4 backdrop-blur-sm">
                  {passwordRequirements.map((req, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * idx }}
                      className="flex items-center gap-2 text-xs"
                    >
                      <CheckCircle2
                        className={`w-4 h-4 flex-shrink-0 ${
                          req.met
                            ? "text-emerald-500"
                            : "text-slate-400"
                        }`}
                      />
                      <span
                        className={
                          req.met
                            ? "text-slate-700"
                            : "text-slate-500"
                        }
                      >
                        {req.label}
                      </span>
                    </motion.div>
                  ))}
                </div>

                <Button
                  type="submit"
                  disabled={loading || !password.length || password.length < 8}
                  isLoading={loading}
                  fullWidth
                  size="lg"
                  className="bg-gradient-to-r from-[#4f7df3] via-[#4fc3a1] to-[#56c271] text-white shadow-md hover:shadow-lg hover:shadow-blue-300/30 transition-all duration-300 font-semibold"
                  icon={!loading && <ArrowRight className="w-5 h-5" />}
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white/80 px-3 text-slate-500 backdrop-blur-sm">
                    Already have an account?
                  </span>
                </div>
              </div>

              <Link href="/login" className="block">
                <Button variant="outline" fullWidth size="lg" className="border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-300">
                  Sign In Instead
                </Button>
              </Link>
            </Card>

            {/* Privacy Notice */}
            <p className="text-center text-xs text-slate-500">
              By creating an account, you agree to our{" "}
              <Link href="#" className="text-blue-600 hover:underline">
                Terms of Service
              </Link>
              {" "}and{" "}
              <Link href="#" className="text-blue-600 hover:underline">
                Privacy Policy
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}