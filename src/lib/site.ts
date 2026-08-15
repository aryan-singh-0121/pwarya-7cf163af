import { supabase } from "@/integrations/supabase/client";

export type Plan = {
  code: string;
  name: string;
  price_inr: number;
  duration_days: number;
  sort_order: number;
  is_active: boolean;
};

export type Settings = {
  upi_id: string;
  qr_path: string;
  telegram_link: string;
  support_message: string;
  services_text: string;
  demo_video_url: string;
  video_popup_enabled: boolean;
  video_popup_url: string;
  highlights: string[];
  marquee_lines: string[];
  content_url: string;
};


export async function fetchSettings(): Promise<Settings | null> {
  const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (!data) return null;
  return {
    ...data,
    highlights: Array.isArray(data.highlights) ? (data.highlights as string[]) : [],
    marquee_lines: Array.isArray(data.marquee_lines) ? (data.marquee_lines as string[]) : [],
  } as Settings;
}

export async function fetchPlans(): Promise<Plan[]> {
  const { data } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as Plan[];
}

export function youtubeEmbed(url: string): string | null {
  if (!url) return null;
  const m =
    url.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ??
    url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ??
    url.match(/embed\/([A-Za-z0-9_-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export function passwordScore(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong", "Very strong"];
  return { score, label: labels[score] ?? "Very weak" };
}
