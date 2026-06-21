"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "../auth-layout";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/library";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("邮箱或密码不正确");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <AuthShell title="登 入" subtitle="展卷 · 共读">
      <form onSubmit={onSubmit} className="space-y-5">
        <Field
          label="邮箱"
          type="email"
          value={email}
          onChange={setEmail}
          required
        />
        <Field
          label="密码"
          type="password"
          value={password}
          onChange={setPassword}
          required
        />
        {error && <p className="text-seal text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-bamboo text-paper py-2.5 font-medium tracking-widest hover:bg-bamboo-dark disabled:opacity-50 transition-colors"
        >
          {loading ? "登录中…" : "登 录"}
        </button>
        <p className="text-center text-sm text-ink-light">
          还没有账号?{" "}
          <a href="/register" className="text-bamboo-dark underline">
            注册
          </a>
        </p>
      </form>
    </AuthShell>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-ink-light mb-1.5 tracking-wider">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-wood/30 bg-paper-dark/40 px-3 py-2 outline-none focus:border-bamboo focus:ring-1 focus:ring-bamboo/40 transition-colors"
      />
    </label>
  );
}
