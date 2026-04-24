"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function SignupPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage("確認メールを送信しました");
  };

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
        <section className="w-full rounded-2xl border border-zinc-800 bg-[#0a0a0d] p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          <h1 className="text-2xl font-semibold tracking-tight">サインアップ</h1>
          <p className="mt-2 text-sm text-zinc-400">
            メールアドレスとパスワードで新規登録します。
          </p>

          <form onSubmit={handleSignup} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm text-zinc-300">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-[#07070a] p-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm text-zinc-300">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-[#07070a] p-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500"
                placeholder="••••••••"
                required
              />
            </div>

            {errorMessage && (
              <p className="rounded-lg border border-rose-900 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
                {errorMessage}
              </p>
            )}

            {successMessage && (
              <p className="rounded-lg border border-emerald-900 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">
                {successMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-base font-semibold text-black transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900 disabled:text-zinc-300"
            >
              {isLoading ? "サインアップ中..." : "サインアップ"}
            </button>
          </form>

          <p className="mt-5 text-sm text-zinc-400">
            既にアカウントをお持ちの方はログイン{" "}
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300">
              こちら
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
