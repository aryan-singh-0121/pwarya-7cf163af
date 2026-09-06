import { useEffect, useState } from "react";
import { Instagram, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { link: string; message: string; enabled: boolean };

/** Home-screen "Follow us on Instagram" popup — link and text come from the admin panel. */
export function InstagramPopup({ link, message, enabled }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || !link) return;
    const t = setTimeout(() => setOpen(true), 4200);
    return () => clearTimeout(t);
  }, [enabled, link]);

  if (!enabled || !link || !open) return null;

  return (
    <div className="fixed inset-x-4 bottom-24 z-[55] mx-auto max-w-sm sm:inset-x-auto sm:right-6">
      <div className="glow-card relative rounded-2xl bg-card p-5 text-center">
        <button
          aria-label="Close Instagram popup"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <Instagram className="mx-auto h-8 w-8 text-primary" />
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Button asChild className="mt-3 w-full">
          <a href={link} target="_blank" rel="noreferrer noopener">
            Follow on Instagram
          </a>
        </Button>
      </div>
    </div>
  );
}
