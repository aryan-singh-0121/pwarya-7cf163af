import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { youtubeEmbed } from "@/lib/site";

type Props = { url: string; enabled: boolean };

/** Home-screen demo video popup — switched on and set from the admin panel. */
export function VideoPopup({ url, enabled }: Props) {
  const [open, setOpen] = useState(false);
  const embed = youtubeEmbed(url);

  useEffect(() => {
    if (!enabled || !embed) return;
    const t = setTimeout(() => setOpen(true), 1800);
    return () => clearTimeout(t);
  }, [enabled, embed]);

  if (!enabled || !embed || !open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm">
      <div className="glow-card w-full max-w-2xl overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-xl tracking-wide">Watch the demo</p>
          <button
            aria-label="Close demo video"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="aspect-video w-full">
          <iframe
            src={embed}
            title="PW ARYA demo video"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
