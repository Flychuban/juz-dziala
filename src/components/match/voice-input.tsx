"use client";

import { Mic, MicOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { INTL_LOCALE } from "~/i18n/config";
import { btnSecondary } from "./styles";

/** The parts of the Web Speech API we use (it is not in the DOM typings). */
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionErrorEvent = { error: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_KEY = {
  "not-allowed": "notAllowed",
  "service-not-allowed": "serviceNotAllowed",
  "no-speech": "noSpeech",
  "audio-capture": "audioCapture",
  network: "network",
} as const;

/**
 * „Powiedz": dictation in the page's language (pl-PL or en-GB). Hidden when
 * the browser has no speech recognition. The live transcript goes straight
 * into the textarea.
 */
export function VoiceInput({
  value,
  onChange,
  describedBy,
}: {
  value: string;
  onChange: (text: string) => void;
  describedBy?: string;
}) {
  const t = useTranslations("home.voice");
  const lang = INTL_LOCALE[useLocale()];
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  /** True while the status line says „Słucham…" (so the end of recording replaces only that). */
  const listeningStatus = useRef(false);
  const rec = useRef<Recognition | null>(null);
  const base = useRef("");
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setSupported(recognitionCtor() !== null);
    return () => rec.current?.abort();
  }, []);

  const stop = useCallback(() => {
    rec.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    base.current = valueRef.current.trim() ? `${valueRef.current.trim()} ` : "";
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      onChange(`${base.current}${finalText}${interim}`.replace(/\s+/gu, " "));
    };
    r.onerror = (e) => {
      const key = ERROR_KEY[e.error as keyof typeof ERROR_KEY];
      listeningStatus.current = false;
      setStatus(key ? t(`errors.${key}`) : t("interrupted"));
    };
    r.onend = () => {
      setListening(false);
      rec.current = null;
      if (listeningStatus.current) setStatus(t("ended"));
      listeningStatus.current = false;
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
      listeningStatus.current = true;
      setStatus(t("listening"));
    } catch {
      setStatus(t("failedStart"));
    }
  }, [onChange, lang, t]);

  if (!supported) return null;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-pressed={listening}
        aria-describedby={describedBy}
        className={btnSecondary}
      >
        {listening ? <MicOff aria-hidden="true" className="size-5" /> : <Mic aria-hidden="true" className="size-5" />}
        {listening ? t("stop") : t("start")}
      </button>
      <p role="status" aria-live="polite" className="text-sm">
        {status}
      </p>
      <p className="text-muted-foreground text-sm">{t("google")}</p>
    </div>
  );
}
