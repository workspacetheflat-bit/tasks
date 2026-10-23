"use client";

import { createContext, type CSSProperties, type FormEvent, type ReactNode, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CELEBRATION_SOUND_SRC,
  personalTodoCelebrationAnimation,
  shouldCelebrateCompletion,
  shouldPlayCelebrationSound,
  shouldPlayPersonalTodoSound,
} from "@/lib/personal-todo-celebration";

export type CompletionResult = {
  ok: boolean;
  completed: boolean;
  changed: boolean;
  error?: string;
};

export type CompletionAction = (formData: FormData) => Promise<CompletionResult>;

type CelebrationContextValue = {
  prepareSound: () => void;
  celebrate: (result: CompletionResult) => void;
};

const CelebrationContext = createContext<CelebrationContextValue | null>(null);
const soundPreferenceKey = "personal-todo-muted";
const confettiParticles = Array.from({ length: 18 }, (_, index) => index);

export function TaskCelebrationProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const audioBuffer = useRef<Promise<AudioBuffer> | null>(null);
  const mutedRef = useRef(false);
  const celebrationTimer = useRef<number | null>(null);

  useEffect(() => {
    let preferenceTimer: number | undefined;
    try {
      const initialMuted = window.localStorage.getItem(soundPreferenceKey) === "true";
      mutedRef.current = initialMuted;
      preferenceTimer = window.setTimeout(() => setMuted(initialMuted), 0);
    } catch (error) {
      console.warn("Could not read personal todo sound preference.", error);
    }
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionTimer = window.setTimeout(() => setReducedMotion(motionPreference.matches), 0);
    const updateMotionPreference = () => setReducedMotion(motionPreference.matches);
    motionPreference.addEventListener("change", updateMotionPreference);
    return () => {
      if (preferenceTimer !== undefined) window.clearTimeout(preferenceTimer);
      window.clearTimeout(motionTimer);
      if (celebrationTimer.current !== null) window.clearTimeout(celebrationTimer.current);
      motionPreference.removeEventListener("change", updateMotionPreference);
      const context = audioContext.current;
      audioContext.current = null;
      audioBuffer.current = null;
      if (context && context.state !== "closed") {
        void context.close().catch((error: unknown) => {
          console.warn("Could not close personal todo audio context.", error);
        });
      }
    };
  }, []);

  const prepareSound = useCallback(() => {
    if (!shouldPlayPersonalTodoSound(mutedRef.current) || typeof window === "undefined" || !("AudioContext" in window)) return;
    try {
      const context = audioContext.current ?? (audioContext.current = new window.AudioContext());
      if (audioContext.current.state === "suspended") {
        void context.resume().catch((error: unknown) => {
          console.warn("Could not prepare personal todo sound.", error);
        });
      }
      audioBuffer.current ??= fetch(CELEBRATION_SOUND_SRC)
        .then(async (response) => {
          if (!response.ok) throw new Error(`Celebration sound request failed: ${response.status}`);
          return context.decodeAudioData(await response.arrayBuffer());
        });
      void audioBuffer.current.catch((error: unknown) => {
        console.warn("Could not load personal todo celebration sound.", error);
        audioBuffer.current = null;
      });
    } catch (error) {
      console.warn("Could not prepare personal todo sound.", error);
    }
  }, []);

  const celebrate = useCallback((result: CompletionResult) => {
    setShowCelebration(true);
    if (celebrationTimer.current !== null) window.clearTimeout(celebrationTimer.current);
    celebrationTimer.current = window.setTimeout(() => setShowCelebration(false), 2800);
    if (!shouldPlayCelebrationSound(result, mutedRef.current) || !audioContext.current || !audioBuffer.current) return;
    try {
      const context = audioContext.current;
      void audioBuffer.current.then((buffer) => {
        if (mutedRef.current || context.state !== "running") return;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start();
      }).catch((error: unknown) => {
        console.warn("Could not play personal todo celebration sound.", error);
      });
    } catch (error) {
      console.warn("Could not play personal todo sound.", error);
    }
  }, []);



  return (
    <CelebrationContext.Provider value={{ prepareSound, celebrate }}>
      {children}

      {showCelebration && <div className={`todo-celebration todo-celebration-${personalTodoCelebrationAnimation(reducedMotion)}`} role="status" aria-live="polite">
        <div className="todo-celebration-card">
          <span className="todo-celebration-heart" aria-hidden="true">❤️</span>
          <strong>يوسف بيحبك يا شطور ❤️</strong>
          <span>إنجاز جميل! كمّلي بنفس الحماس</span>
        </div>
        <div className="todo-confetti" aria-hidden="true">
          {confettiParticles.map((particle) => <i key={particle} style={{
            left: `${(particle * 37) % 96 + 2}%`,
            "--particle-delay": `${(particle % 6) * 55}ms`,
            "--particle-rotation": `${particle * 47}deg`,
          } as CSSProperties} />)}
        </div>
      </div>}
    </CelebrationContext.Provider>
  );
}

export function CelebrationActionForm({
  action,
  children,
  className,
}: {
  action: CompletionAction;
  children: ReactNode;
  className?: string;
}) {
  const context = useContext(CelebrationContext);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const submitted = useRef(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current) return;
    submitted.current = true;
    setError("");
    context?.prepareSound();
    const formData = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.name) {
      formData.set(submitter.name, submitter.value);
    }
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (!result.ok) {
          setError("تعذر تحديث المهمة. حاولي مرة أخرى.");
        } else {
          if (shouldCelebrateCompletion(result)) context?.celebrate(result);
          router.refresh();
        }
      } catch (actionError) {
        console.error("Personal todo update failed.", actionError);
        setError("تعذر تحديث المهمة. حاولي مرة أخرى.");
      } finally {
        submitted.current = false;
      }
    });
  }

  return <form className={className} onSubmit={handleSubmit} aria-busy={pending}>
    {children}
    {error && <small className="todo-action-error" role="alert">{error}</small>}
  </form>;
}
