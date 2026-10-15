import { useCallback, useEffect } from "react";
import { sounds, type SoundName } from "@/lib/sounds";
import { usePrefs } from "@/state/prefs";

/** Tercihlere bağlı ses çalma: `play("done")`. Sesler kapalıysa sessizce geçer. */
export function useSound() {
  const { sound } = usePrefs();
  useEffect(() => {
    sounds.enabled = sound;
  }, [sound]);
  return useCallback((name: SoundName) => sounds.play(name), []);
}
