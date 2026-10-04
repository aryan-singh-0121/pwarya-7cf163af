const KEY = "pwarya_device_id";

/** Stable per-browser id used for the one-device-at-a-time lock. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  // Kept in both localStorage and a 1-year cookie so the device stays
  // recognised (and the member stays signed in) across visits.
  const fromCookie = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${KEY}=`))
    ?.split("=")[1];
  let id = window.localStorage.getItem(KEY) || (fromCookie ? decodeURIComponent(fromCookie) : null);
  if (!id) id = `${crypto.randomUUID()}-${Math.random().toString(36).slice(2, 8)}`;
  window.localStorage.setItem(KEY, id);
  document.cookie = `${KEY}=${encodeURIComponent(id)}; Max-Age=31536000; Path=/; SameSite=Lax${
    location.protocol === "https:" ? "; Secure" : ""
  }`;
  return id;
}
