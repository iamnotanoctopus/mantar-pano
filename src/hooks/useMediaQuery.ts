import { useEffect, useState } from "react";

/** CSS medya sorgusunu canlı izler: useMediaQuery("(max-width: 760px)") */
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

export const PHONE = "(max-width: 760px)";
