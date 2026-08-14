import { useEffect, useState } from "react";

type Props = {
  lines: string[];
  className?: string;
  typeSpeed?: number;
  deleteSpeed?: number;
  holdMs?: number;
};

/** Writes a line, holds, deletes it, moves to the next — forever. */
export function TypingLoop({
  lines,
  className,
  typeSpeed = 70,
  deleteSpeed = 38,
  holdMs = 1400,
}: Props) {
  const safe = lines.length ? lines : [""];
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const full = safe[index % safe.length] ?? "";
    if (!deleting && text === full) {
      const t = setTimeout(() => setDeleting(true), holdMs);
      return () => clearTimeout(t);
    }
    if (deleting && text === "") {
      setDeleting(false);
      setIndex((i) => (i + 1) % safe.length);
      return;
    }
    const t = setTimeout(
      () =>
        setText((prev) =>
          deleting ? full.slice(0, prev.length - 1) : full.slice(0, prev.length + 1),
        ),
      deleting ? deleteSpeed : typeSpeed,
    );
    return () => clearTimeout(t);
  }, [text, deleting, index, safe, typeSpeed, deleteSpeed, holdMs]);

  return (
    <span className={className}>
      {text}
      <span className="animate-caret text-primary">|</span>
    </span>
  );
}
