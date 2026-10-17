export const BATCH_URL = "https://pwthor.live/study/batches";

/** Selects a top-level destination; the external site's access rules still apply. */
export function getBatchNavigation(userAgent: string, inFrame: boolean) {
  const androidWrapper = /Android/i.test(userAgent) &&
    /(?:;\s*wv\b|\bwv\b|FBAN|FBAV|Instagram|Line\/|Telegram|WhatsApp|GSA\/)/i.test(userAgent);
  if (androidWrapper) {
    return {
      href: `intent://pwthor.live/study/batches#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(BATCH_URL)};end`,
      target: "_top",
    };
  }
  return { href: BATCH_URL, target: inFrame ? "_blank" : "_self" };
}