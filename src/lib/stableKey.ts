/**
 * İyimser eklemede kart önce "temp-…" kimliğiyle panoya iğnelenir; sunucu gerçek kimliği verince kimlik değişir.
 * Panodaki React anahtarı, layoutId ve kartın eğimi ilk kimliğe bağlı kalır: kart yeniden doğmuş gibi sönüp belirmez,
 * eğimi zıplamaz. Eşleme yalnızca bu oturum için tutulur.
 */
const aliases = new Map<string, string>();

/** Sunucunun verdiği gerçek kimliği, kartın ilk (geçici) kimliğine bağlar. */
export function linkStableKey(realId: string, tempId: string): void {
  if (realId !== tempId) aliases.set(realId, aliases.get(tempId) ?? tempId);
}

/** Kartın oturum boyunca değişmeyen anahtarı. */
export const stableKey = (id: string): string => aliases.get(id) ?? id;
