"use client";

import { Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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

const ERROR_TEXT: Record<string, string> = {
  "not-allowed": "Przeglądarka nie dała dostępu do mikrofonu. Możesz wpisać opis w polu powyżej.",
  "service-not-allowed": "Rozpoznawanie mowy jest wyłączone w tej przeglądarce. Wpisz opis w polu powyżej.",
  "no-speech": "Nie usłyszeliśmy nic. Spróbuj jeszcze raz, mów blisko mikrofonu.",
  "audio-capture": "Nie znaleźliśmy mikrofonu. Wpisz opis w polu powyżej.",
  network: "Rozpoznawanie mowy wymaga internetu. Spróbuj ponownie albo wpisz opis.",
};

/**
 * „Powiedz": dictation in pl-PL. Hidden when the browser has no speech
 * recognition. The live transcript goes straight into the textarea.
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
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
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
    r.lang = "pl-PL";
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
      setStatus(ERROR_TEXT[e.error] ?? "Rozpoznawanie mowy przerwało się. Spróbuj ponownie albo wpisz opis.");
    };
    r.onend = () => {
      setListening(false);
      rec.current = null;
      setStatus((s) => (s.startsWith("Słucham") ? "Zakończono nagrywanie. Sprawdź tekst w polu opisu." : s));
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
      setStatus("Słucham… Mów spokojnie. Naciśnij „Zakończ”, gdy skończysz.");
    } catch {
      setStatus("Nie udało się włączyć mikrofonu. Wpisz opis w polu powyżej.");
    }
  }, [onChange]);

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
        {listening ? "Zakończ" : "Powiedz"}
      </button>
      <p role="status" aria-live="polite" className="text-sm">
        {status}
      </p>
      <p className="text-muted-foreground text-sm">Rozpoznawanie mowy w Chrome korzysta z usług Google.</p>
    </div>
  );
}
