// Avatar circular — poza userului dacă există, altfel inițialele pe surface caldă.
// Refolosit în antet detaliu, card autor (sidebar), comentarii, poziții și autor schiță.
import { cn } from "@/lib/utils";

function initials(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AvatarInitials({
  name,
  imageUrl,
  size = 38,
  className,
}: {
  name: string | null;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const dimension = { width: size, height: size, fontSize: Math.round(size * 0.34) };

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        style={{ width: size, height: size }}
        className={cn("flex-none rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      style={dimension}
      className={cn(
        "flex flex-none items-center justify-center rounded-full bg-[#ece4d6] font-mono leading-none text-[#6f685e]",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
