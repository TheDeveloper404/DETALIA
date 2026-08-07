import { cn } from "@/lib/utils";

// Triunghi CSS plin (border trick), nu iconiță cu coadă — stilul exact StackOverflow pentru
// săgețile de vot (2026-08-07). Culoarea vine din `currentColor` (text-color pe wrapper).
export function VoteTriangle({
  direction,
  size = 10,
  className,
}: {
  direction: "up" | "down";
  size?: number;
  className?: string;
}) {
  const half = Math.round(size * 0.65);
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0", className)}
      style={{
        width: 0,
        height: 0,
        borderLeft: `${half}px solid transparent`,
        borderRight: `${half}px solid transparent`,
        ...(direction === "up"
          ? { borderBottom: `${size}px solid currentColor` }
          : { borderTop: `${size}px solid currentColor` }),
      }}
    />
  );
}
