export function shouldCelebrateCompletion(result: {
  ok: boolean;
  completed: boolean;
  changed: boolean;
}): boolean {
  return result.ok && result.completed && result.changed;
}

export function shouldPlayPersonalTodoSound(muted: boolean): boolean {
  return !muted;
}

export const CELEBRATION_SOUND_SRC = "/audio/party-celebration.mp3";

export function shouldPlayCelebrationSound(
  result: { ok: boolean; completed: boolean; changed: boolean },
  muted: boolean,
): boolean {
  return shouldCelebrateCompletion(result) && shouldPlayPersonalTodoSound(muted);
}

export function personalTodoCelebrationAnimation(reducedMotion: boolean): "confetti" | "calm" {
  return reducedMotion ? "calm" : "confetti";
}
