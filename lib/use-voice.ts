"use client";

import * as React from "react";

/* Minimal typings for the Web Speech API (not in lib.dom for all targets). */
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Microphone speech-to-text. Returns transcript and listening state. */
/**
 * Continuous microphone capture with live transcription.
 * It records until the caller stops it or the cap (default 10 minutes) is hit.
 * Final results are appended through onAppend. It never sends on its own and
 * never stops on silence: when the browser ends a segment it starts another.
 */
export function useSpeechRecognition(onAppend?: (text: string) => void, maxMs = 600_000) {
  const [recording, setRecording] = React.useState(false);
  const [interim, setInterim] = React.useState("");
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const recRef = React.useRef<SpeechRecognitionLike | null>(null);
  const recordingRef = React.useRef(false);
  const startedAtRef = React.useRef(0);
  const timerRef = React.useRef<number | null>(null);
  const onAppendRef = React.useRef(onAppend);
  onAppendRef.current = onAppend;

  // Capability is browser-only. Report false until after mount so the first
  // client render matches the server HTML (avoids a hydration mismatch).
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const supported = mounted && getRecognitionCtor() !== null;

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = React.useCallback(() => {
    recordingRef.current = false;
    setRecording(false);
    setInterim("");
    clearTimer();
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
  }, [clearTimer]);

  // Start one recognition segment. onend restarts the next one while recording.
  const beginSegment = React.useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) {
        setInterim("");
        onAppendRef.current?.(finalText.trim()); // append only, never send
      }
    };
    rec.onerror = () => {
      /* ignore transient errors; onend decides whether to continue */
    };
    rec.onend = () => {
      if (recordingRef.current && Date.now() - startedAtRef.current < maxMs) {
        try {
          beginSegment();
        } catch {
          stop();
        }
      } else {
        stop();
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      /* a start while already running throws; safe to ignore */
    }
  }, [maxMs, stop]);

  const start = React.useCallback(() => {
    if (recordingRef.current || getRecognitionCtor() === null) return;
    recordingRef.current = true;
    setRecording(true);
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setInterim("");
    clearTimer();
    timerRef.current = window.setInterval(() => {
      const e = Date.now() - startedAtRef.current;
      setElapsedMs(e);
      if (e >= maxMs) stop(); // hard cap, stops without sending
    }, 250);
    beginSegment();
  }, [beginSegment, clearTimer, maxMs, stop]);

  const toggle = React.useCallback(() => {
    if (recordingRef.current) stop();
    else start();
  }, [start, stop]);

  React.useEffect(
    () => () => {
      recordingRef.current = false;
      clearTimer();
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    },
    [clearTimer],
  );

  return { supported, recording, interim, elapsedMs, maxMs, start, stop, toggle };
}

/** Text-to-speech playback using the browser's speech synthesis. */
export function useSpeech() {
  // Same post-mount gating as recognition, to keep hydration stable.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const supported =
    mounted && typeof window !== "undefined" && "speechSynthesis" in window;

  const speak = React.useCallback(
    (text: string, onEnd?: () => void) => {
      if (!supported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = 1;
      u.pitch = 1;
      if (onEnd) {
        u.onend = onEnd;
        u.onerror = onEnd;
      }
      window.speechSynthesis.speak(u);
    },
    [supported],
  );

  const cancel = React.useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  return { supported, speak, cancel };
}
