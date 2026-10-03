"use client";

import { useEffect, useRef, useState } from "react";
import { SquareIcon, Volume2Icon } from "lucide-react";

import { Button } from "~/components/ui/button";

/** Splits text into sentence-sized chunks: long utterances stall in Chrome. */
function chunk(text: string, max = 220): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+/u);
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).trim().length > max && buf) {
      out.push(buf.trim());
      buf = s;
    } else {
      buf = `${buf} ${s}`;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function polishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "pl-PL") ??
    voices.find((v) => v.lang.toLowerCase().startsWith("pl"))
  );
}

/**
 * ReadAloud — „Czytaj na głos": reads `text` with the browser's speech
 * synthesis in Polish (pl-PL voice when available). The same button
 * becomes „Zatrzymaj" while speaking. Renders nothing when the browser has
 * no speech synthesis, so there is never a button that does nothing.
 *
 * @param text   Plain text to read.
 * @param label  Button text; defaults to „Czytaj na głos".
 */
export function ReadAloud({
  text,
  label = "Czytaj na głos",
  variant = "outline",
  className,
}: {
  text: string;
  label?: string;
  variant?: "outline" | "secondary" | "ghost";
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const run = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);
    // Voices load asynchronously in Chrome; warm the list.
    window.speechSynthesis.getVoices();
    const id = run;
    return () => {
      id.current++;
      window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported || !text.trim()) return null;

  function stop() {
    run.current++;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function start() {
    const synth = window.speechSynthesis;
    synth.cancel();
    const myRun = ++run.current;
    const parts = chunk(text);
    const voice = polishVoice();
    let i = 0;
    const next = () => {
      if (run.current !== myRun) return;
      const part = parts[i++];
      if (part === undefined) {
        setSpeaking(false);
        return;
      }
      const u = new SpeechSynthesisUtterance(part);
      u.lang = "pl-PL";
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.onend = next;
      u.onerror = () => {
        if (run.current === myRun) setSpeaking(false);
      };
      synth.speak(u);
    };
    setSpeaking(true);
    next();
  }

  return (
    <Button
      type="button"
      variant={variant}
      onClick={speaking ? stop : start}
      className={className}
    >
      {speaking ? (
        <SquareIcon aria-hidden="true" className="fill-current" />
      ) : (
        <Volume2Icon aria-hidden="true" />
      )}
      {speaking ? "Zatrzymaj" : label}
    </Button>
  );
}
