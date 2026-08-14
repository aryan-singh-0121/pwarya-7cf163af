import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { link: string; message: string };

export function SupportPopup({ link, message }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 3500);
    return () => clearTimeout(t);
  }, []);

  if (!link) return null;

  return (
    <>
      <button
        aria-label="Customer support"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {open ? (
        <div className="glow-card fixed bottom-24 right-5 z-50 w-[min(20rem,calc(100vw-2.5rem))] rounded-2xl p-5">
          <button
            aria-label="Close support popup"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="font-display text-2xl tracking-wide">Need help?</h3>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <Button asChild className="mt-4 w-full">
            <a href={link} target="_blank" rel="noreferrer noopener">
              Open Telegram support
            </a>
          </Button>
        </div>
      ) : null}
    </>
  );
}
