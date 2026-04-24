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
            <div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Clarity</h1>
              <p className="text-lg text-zinc-500 italic font-light mt-1">...not cravings.</p>
              <p className="mt-2 text-sm text-zinc-400 md:text-base">自己管理の出来る人間への記録</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-900"
            >
              ログアウト
            </button>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-zinc-800 bg-[#0c0c10] p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">1. 日記（音声入力）</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startVoiceInput("diary")}
                  disabled={activeListeningField === "diary"}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-emerald-900"
                >
                  {activeListeningField === "diary" ? "録音中..." : "🎤 音声入力開始"}
                </button>
                <button
                  type="button"
                  onClick={() => stopVoiceInput("diary")}
                  disabled={activeListeningField !== "diary"}
                  className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-900"
                >
                  停止
                </button>
              </div>
            </div>
            <textarea
              value={diary}
              onChange={(e) => setDiary(e.target.value)}
              placeholder="Clarity を保てた瞬間 / 失った瞬間を書いてください(空欄でも送信可)"
              className="h-44 w-full rounded-xl border border-zinc-700 bg-[#07070a] p-3 text-sm leading-6 text-zinc-100 outline-none ring-0 placeholder:text-zinc-500 focus:border-emerald-500"
            />
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-[#0c0c10] p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">2. 食事(Cravings 監視)</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startVoiceInput("mealCheck")}
                  disabled={activeListeningField === "mealCheck"}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-emerald-900"
                >
                  {activeListeningField === "mealCheck" ? "録音中..." : "🎤 音声入力開始"}
                </button>
                <button
                  type="button"
                  onClick={() => stopVoiceInput("mealCheck")}
                  disabled={activeListeningField !== "mealCheck"}
                  className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-900"
                >
                  停止
                </button>
              </div>
            </div>
            <textarea
              value={mealCheck}
              onChange={(e) => setMealCheck(e.target.value)}
              placeholder="Cravings の兆候(暴食、衝動食い、感情的な食行動)を記録"
              className="h-28 w-full rounded-xl border border-zinc-700 bg-[#07070a] p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500"
            />
          </section>

          <button
            type="submit"
            disabled={isSaving || (!diary.trim() && !mealCheck.trim())}
            className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-base font-semibold text-black transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900 disabled:text-zinc-300"
          >
            {isSaving ? "記録中..." : "記録して Clarity を見つめる"}
          </button>
        </form>

        {errorMessage && (
          <section className="rounded-xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">
            {errorMessage}
          </section>
        )}

        {feedback && (
          <section className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-5">
            <h2 className="mb-3 text-lg font-medium text-emerald-300">AIフィードバック</h2>
            <pre className="whitespace-pre-wrap text-sm leading-7 text-zinc-100">{feedback}</pre>
          </section>
        )}
      </main>
    </div>
  );
}
