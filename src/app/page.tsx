"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

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
type FieldKey = "diary" | "mealCheck" | "studyLog" | "routineCheck" | "healthLog";

export default function Home() {
  const [diary, setDiary] = useState("");
  const [mealCheck, setMealCheck] = useState("");
  const [studyLog, setStudyLog] = useState("");
  const [routineCheck, setRoutineCheck] = useState("");
  const [healthLog, setHealthLog] = useState("");
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
    studyLog,
    routineCheck,
    healthLog,
  };

  const setFieldValue: Record<FieldKey, (value: string) => void> = {
    diary: setDiary,
    mealCheck: setMealCheck,
    studyLog: setStudyLog,
    routineCheck: setRoutineCheck,
    healthLog: setHealthLog,
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

    if (!diary.trim()) {
      setErrorMessage("日記は音声入力で記録してください。");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setFeedback("");

    try {
      const payload = {
        diary,
        mealCheck,
        studyLog,
        routineCheck,
        healthLog,
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

  return (
    <div className="min-h-screen bg-[#050507] text-zinc-100">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10">
        <section className="rounded-2xl border border-zinc-800 bg-[#0a0a0d] p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            自己規律管理アプリ
          </h1>
          <p className="mt-2 text-sm text-zinc-400 md:text-base">
            ストレス由来の暴食予防・電験三種合格・3時起床ルーティン継続のための統合ログ
          </p>
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
              placeholder="音声入力で感情やストレスを吐き出してください（必要時に手入力で微修正可）"
              className="h-44 w-full rounded-xl border border-zinc-700 bg-[#07070a] p-3 text-sm leading-6 text-zinc-100 outline-none ring-0 placeholder:text-zinc-500 focus:border-emerald-500"
              required
            />
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-[#0c0c10] p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">2. 食事チェック</h2>
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
              placeholder="1日1食（1,859kcal）遵守、AGO-DASHI等の混入、暴食の有無"
              className="h-28 w-full rounded-xl border border-zinc-700 bg-[#07070a] p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500"
            />
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-[#0c0c10] p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">3. 電験三種 学習ログ</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startVoiceInput("studyLog")}
                  disabled={activeListeningField === "studyLog"}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-emerald-900"
                >
                  {activeListeningField === "studyLog" ? "録音中..." : "🎤 音声入力開始"}
                </button>
                <button
                  type="button"
                  onClick={() => stopVoiceInput("studyLog")}
                  disabled={activeListeningField !== "studyLog"}
                  className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-900"
                >
                  停止
                </button>
              </div>
            </div>
            <textarea
              value={studyLog}
              onChange={(e) => setStudyLog(e.target.value)}
              placeholder="法規・機械を中心に、学習内容と時間を記録"
              className="h-28 w-full rounded-xl border border-zinc-700 bg-[#07070a] p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500"
            />
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-[#0c0c10] p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">4. ルーティン確認</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startVoiceInput("routineCheck")}
                  disabled={activeListeningField === "routineCheck"}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-emerald-900"
                >
                  {activeListeningField === "routineCheck" ? "録音中..." : "🎤 音声入力開始"}
                </button>
                <button
                  type="button"
                  onClick={() => stopVoiceInput("routineCheck")}
                  disabled={activeListeningField !== "routineCheck"}
                  className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-900"
                >
                  停止
                </button>
              </div>
            </div>
            <textarea
              value={routineCheck}
              onChange={(e) => setRoutineCheck(e.target.value)}
              placeholder="3時起床、瞑想、ジャーナリングの実施状況"
              className="h-28 w-full rounded-xl border border-zinc-700 bg-[#07070a] p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500"
            />
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-[#0c0c10] p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">5. 体調記録</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startVoiceInput("healthLog")}
                  disabled={activeListeningField === "healthLog"}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-emerald-900"
                >
                  {activeListeningField === "healthLog" ? "録音中..." : "🎤 音声入力開始"}
                </button>
                <button
                  type="button"
                  onClick={() => stopVoiceInput("healthLog")}
                  disabled={activeListeningField !== "healthLog"}
                  className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-900"
                >
                  停止
                </button>
              </div>
            </div>
            <textarea
              value={healthLog}
              onChange={(e) => setHealthLog(e.target.value)}
              placeholder="腰痛、歯の健康、睡眠の質、疲労感など"
              className="h-28 w-full rounded-xl border border-zinc-700 bg-[#07070a] p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500"
            />
          </section>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-base font-semibold text-black transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900 disabled:text-zinc-300"
          >
            {isSaving ? "保存・AI分析中..." : "保存してAIフィードバックを受け取る"}
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
