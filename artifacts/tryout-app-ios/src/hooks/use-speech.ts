import { useCallback, useRef, useState } from "react";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

let permissionGranted = false;

async function ensurePermission(): Promise<boolean> {
  if (permissionGranted) return true;
  try {
    const { speechRecognition } = await SpeechRecognition.checkPermissions();
    if (speechRecognition === "granted") { permissionGranted = true; return true; }
    const result = await SpeechRecognition.requestPermissions();
    permissionGranted = result.speechRecognition === "granted";
    return permissionGranted;
  } catch {
    return false;
  }
}

// One-shot: listen once, call onScore when a number is heard
export function useSkillVoice(onScore: (score: number) => void) {
  const [listening, setListening] = useState(false);
  const activeRef = useRef(false);
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;

  const NUMBER_WORDS: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };

  const parseScore = (transcript: string): number | null => {
    const text = transcript.toLowerCase().trim();
    for (const [word, num] of Object.entries(NUMBER_WORDS)) {
      if (text === word || text.includes(word)) return num;
    }
    const match = text.match(/\b(10|[1-9])\b/);
    return match ? parseInt(match[1]) : null;
  };

  const stop = useCallback(async () => {
    activeRef.current = false;
    setListening(false);
    await SpeechRecognition.stop().catch(() => {});
    await SpeechRecognition.removeAllListeners();
  }, []);

  const start = useCallback(async () => {
    const ok = await ensurePermission();
    if (!ok) return;
    activeRef.current = true;
    setListening(true);

    await SpeechRecognition.removeAllListeners();

    await SpeechRecognition.addListener("partialResults", (data: { matches: string[] }) => {
      if (!activeRef.current) return;
      const transcript = data.matches?.[0] ?? "";
      const score = parseScore(transcript);
      if (score !== null) {
        stop();
        onScoreRef.current(score);
      }
    });

    await SpeechRecognition.start({
      language: "en-US",
      maxResults: 3,
      partialResults: true,
      popup: false,
    }).catch(() => stop());
  }, [stop]);

  const toggle = useCallback(() => {
    if (activeRef.current) stop(); else start();
  }, [start, stop]);

  return { listening, toggle, supported: true };
}

// Push-to-talk: one clean session per button hold.
// Avoids Apple's rate-limit (error 209) caused by rapid auto-restarts.
export function useAlwaysOnSpeech(onTranscript: (t: string) => void) {
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const submittedRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const stop = useCallback(async () => {
    activeRef.current = false;
    setActive(false);
    submittedRef.current = false;
    await SpeechRecognition.stop().catch(() => {});
    await SpeechRecognition.removeAllListeners();
  }, []);

  const start = useCallback(async () => {
    const ok = await ensurePermission();
    if (!ok) return;

    activeRef.current = true;
    setActive(true);
    submittedRef.current = false;

    await SpeechRecognition.removeAllListeners();

    await SpeechRecognition.addListener("partialResults", (data: { matches: string[] }) => {
      if (!activeRef.current || submittedRef.current) return;
      const t = data.matches?.[0] ?? "";
      if (t) onTranscriptRef.current(t);
    });

    // When recognition ends naturally (silence timeout), stop and show idle state
    await SpeechRecognition.addListener("listeningState", (data: { status: "started" | "stopped" }) => {
      if (data.status === "stopped" && activeRef.current) {
        activeRef.current = false;
        setActive(false);
        submittedRef.current = false;
        SpeechRecognition.removeAllListeners().catch(() => {});
      }
    });

    await SpeechRecognition.start({
      language: "en-US",
      maxResults: 5,
      partialResults: true,
      popup: false,
    }).catch(() => stop());
  }, [stop]);

  const markSubmitted = useCallback(() => {
    submittedRef.current = true;
    // Stop immediately so the next tap starts with a clean transcript
    SpeechRecognition.stop().catch(() => {});
  }, []);

  return { active, start, stop, markSubmitted };
}
