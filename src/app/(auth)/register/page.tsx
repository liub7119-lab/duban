"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AuthShell } from "../auth-layout";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (res.ok) {
      await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      router.push("/library");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "注册失败");
    }
    setLoading(false);
  }

  return (
    <AuthShell title="注 册" subtitle="结缘 · 一卷初开">
      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="昵称(可选)" type="text" value={name} onChange={setName} />
        <Field
          label="邮箱"
          type="email"
          value={email}
          onChange={setEmail}
          required
        />
        <Field
          label="密码(至少 6 位)"
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
          {loading ? "注册中…" : "注 册"}
        </button>
        <p className="text-center text-sm text-ink-light">
          已有账号?{" "}
          <a href="/login" className="text-bamboo-dark underline">
            登录
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
