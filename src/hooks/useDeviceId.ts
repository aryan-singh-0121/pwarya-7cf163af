const KEY = "pwarya_device_id";

/** Stable per-browser id used for the one-device-at-a-time lock. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = `${crypto.randomUUID()}-${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
