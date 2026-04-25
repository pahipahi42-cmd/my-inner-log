"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type FeedbackResponse = {
  feedback?: string;
  error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
type FieldKey = "diary" | "mealCheck";

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 15a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      }
    };
    checkAuth();
  }, [router, supabase]);

  const [diary, setDiary] = useState("");
  const [mealCheck, setMealCheck] = useState("");
  const [activeListeningField, setActiveListeningField] = useState<FieldKey | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningBaseTextRef = useRef("");
  const listeningFieldRef = useRef<FieldKey | null>(null);

  const canUseSpeech = useMemo(() => {
    if (typeof window === "undefined") return false;
    const speechWindow = window as Window & {
      webkitSpeechRecognition?: SpeechRecognitionCtor;
      SpeechRecognition?: SpeechRecognitionCtor;
    };
    return Boolean(speechWindow.webkitSpeechRecognition || speechWindow.SpeechRecognition);
  }, []);

  const fieldValues: Record<FieldKey, string> = {
    diary,
    mealCheck,
  };

  const setFieldValue: Record<FieldKey, (value: string) => void> = {
    diary: setDiary,
    mealCheck: setMealCheck,
  };

  const startVoiceInput = (field: FieldKey) => {
    if (!canUseSpeech || typeof window === "undefined") {
      setErrorMessage("このブラウザは音声入力に対応していません。Chrome系ブラウザを推奨します。");
      return;
    }

    if (activeListeningField && activeListeningField !== field) {
      recognitionRef.current?.stop();
      setActiveListeningField(null);
    }

    const speechWindow = window as Window & {
      webkitSpeechRecognition?: SpeechRecognitionCtor;
      SpeechRecognition?: SpeechRecognitionCtor;
    };
    const Recognition = speechWindow.webkitSpeechRecognition || speechWindow.SpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = "ja-JP";
    recognition.interimResults = true;
    recognition.continuous = true;
    listeningBaseTextRef.current = fieldValues[field];
    listeningFieldRef.current = field;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const chunk = event.results[i];
        if (chunk?.[0]?.transcript) transcript += chunk[0].transcript;
      }
      const targetField = listeningFieldRef.current;
      if (!targetField) return;
      const base = listeningBaseTextRef.current.trim();
      const spoken = transcript.trim();
      const merged = base && spoken ? `${base}\n${spoken}` : `${base}${spoken}`;
      setFieldValue[targetField](merged);
    };

    recognition.onerror = (event) => {
      setActiveListeningField(null);
      listeningFieldRef.current = null;
      setErrorMessage(`音声入力エラー: ${event.error}`);
    };

    recognition.onend = () => {
      setActiveListeningField(null);
      listeningFieldRef.current = null;
    };

    recognitionRef.current = recognition;
    setErrorMessage("");
    setActiveListeningField(field);
    recognition.start();
  };

  const stopVoiceInput = (field: FieldKey) => {
    if (activeListeningField !== field) return;
    recognitionRef.current?.stop();
    setActiveListeningField(null);
    listeningFieldRef.current = null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const allEmpty = !diary.trim() && !mealCheck.trim();

    if (allEmpty) {
      setErrorMessage("少なくとも1つのフィールドに記録してください。");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setFeedback("");

    try {
      const payload = {
        diary,
        mealCheck,
      };
      localStorage.setItem("self-discipline-log", JSON.stringify(payload));

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as FeedbackResponse;
      if (!response.ok || !result.feedback) {
        throw new Error(result.error || "AIフィードバックの取得に失敗しました。");
      }
      setFeedback(result.feedback);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "保存またはAI分析に失敗しました。";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10">
        <section className="rounded-2xl border border-zinc-800 bg-[#0a0a0d] p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 pr-1">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Clarity</h1>
              <p className="mt-1 text-base font-light italic text-sky-300/95 sm:text-lg md:text-xl">
                ...not cravings.
              </p>
              <div className="mt-2.5 space-y-0.5 text-[11px] leading-snug text-zinc-400 sm:mt-3 sm:text-xs sm:leading-relaxed md:text-sm">
                <p>今日を整える。</p>
                <p>積み重ねるか、崩すか。</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="shrink-0 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:bg-zinc-900 sm:px-3 sm:text-sm"
            >
              ログアウト
            </button>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-zinc-800 bg-[#0c0c10] p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-medium tracking-tight text-zinc-200 sm:text-lg">
                Reflections <span className="font-normal text-zinc-500">内省</span>
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startVoiceInput("diary")}
                  disabled={activeListeningField === "diary"}
                  aria-label={
                    activeListeningField === "diary"
                      ? "内省欄で音声入力中"
                      : "内省欄の音声入力を開始"
                  }
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-md border bg-transparent text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900/40 disabled:cursor-not-allowed ${
                    activeListeningField === "diary"
                      ? "border-zinc-400 text-zinc-100 disabled:opacity-100"
                      : "border-zinc-600 disabled:opacity-40"
                  }`}
                >
                  <span
                    className={
                      activeListeningField === "diary" ? "inline-flex animate-pulse" : "inline-flex"
                    }
                  >
                    <MicIcon className="shrink-0" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => stopVoiceInput("diary")}
                  disabled={activeListeningField !== "diary"}
                  aria-label="内省欄の音声入力を停止"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-600 bg-transparent text-zinc-400 transition hover:border-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <StopIcon className="shrink-0" />
                </button>
              </div>
            </div>
            <textarea
              value={diary}
              onChange={(e) => setDiary(e.target.value)}
              placeholder="Clarity を保てた瞬間 / 失った瞬間を書いてください(空欄でも送信可)"
              className="h-44 w-full rounded-xl border-0 bg-[#09090e] p-3 text-sm leading-6 text-zinc-100 outline-none ring-0 placeholder:text-zinc-500 focus-visible:bg-[#0b0b12] focus-visible:ring-1 focus-visible:ring-zinc-700/80"
            />
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-[#0c0c10] p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-medium tracking-tight text-zinc-200 sm:text-lg">
                Cravings <span className="font-normal text-zinc-500">渇望の監視</span>
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startVoiceInput("mealCheck")}
                  disabled={activeListeningField === "mealCheck"}
                  aria-label={
                    activeListeningField === "mealCheck"
                      ? "渇望の監視欄で音声入力中"
                      : "渇望の監視欄の音声入力を開始"
                  }
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-md border bg-transparent text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900/40 disabled:cursor-not-allowed ${
                    activeListeningField === "mealCheck"
                      ? "border-zinc-400 text-zinc-100 disabled:opacity-100"
                      : "border-zinc-600 disabled:opacity-40"
                  }`}
                >
                  <span
                    className={
                      activeListeningField === "mealCheck"
                        ? "inline-flex animate-pulse"
                        : "inline-flex"
                    }
                  >
                    <MicIcon className="shrink-0" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => stopVoiceInput("mealCheck")}
                  disabled={activeListeningField !== "mealCheck"}
                  aria-label="渇望の監視欄の音声入力を停止"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-600 bg-transparent text-zinc-400 transition hover:border-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <StopIcon className="shrink-0" />
                </button>
              </div>
            </div>
            <textarea
              value={mealCheck}
              onChange={(e) => setMealCheck(e.target.value)}
              placeholder="Cravings の兆候(暴食、衝動食い、感情的な食行動)を記録"
              className="h-28 w-full rounded-xl border-0 bg-[#09090e] p-3 text-sm leading-6 text-zinc-100 outline-none ring-0 placeholder:text-zinc-500 focus-visible:bg-[#0b0b12] focus-visible:ring-1 focus-visible:ring-zinc-700/80"
            />
          </section>

          <div className="flex justify-center pt-1">
            <button
              type="submit"
              disabled={isSaving || (!diary.trim() && !mealCheck.trim())}
              className="min-w-[5.5rem] rounded-md border border-zinc-600 bg-transparent px-6 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? "記録中..." : "記録"}
            </button>
          </div>
        </form>

        {errorMessage && (
          <section className="rounded-xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">
            {errorMessage}
          </section>
        )}

        {feedback && (
          <section className="rounded-2xl border border-zinc-800 bg-[#0a0a0d] p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <h2 className="mb-4 flex flex-col gap-2 border-b border-zinc-800/70 pb-4 sm:gap-2.5">
              <span className="text-prism text-3xl font-bold leading-none tracking-tight sm:text-4xl md:text-[2.5rem]">
                Refraction
              </span>
              <span className="text-prism-subtle text-sm font-medium tracking-tight sm:text-base md:text-lg">
                思考の屈折 — 認知の歪み
              </span>
            </h2>
            <pre className="whitespace-pre-wrap rounded-xl border-0 bg-[#09090e] p-4 text-sm leading-7 text-zinc-300">
              {feedback}
            </pre>
          </section>
        )}
      </main>
    </div>
  );
}
