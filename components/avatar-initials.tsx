// Avatar circular — poza userului dacă există, altfel siluetă generică de user pe surface caldă
// (decizie 2026-07-18: icon în loc de inițiale, consistent pentru toți userii fără poză).
// Refolosit în antet detaliu, card autor (sidebar), comentarii, poziții și autor schiță.
import { cn } from "@/lib/utils";

// Silueta generică (cap + umeri, fill currentColor) — folosită de TOATE fallback-urile de avatar din
// aplicație (header, feed, profil, carduri), ca să nu existe două stiluri de „user fără poză".
export function PersonSilhouette({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className} style={style}>
      <path d="M12 12c2.65 0 4.8-2.15 4.8-4.8S14.65 2.4 12 2.4 7.2 4.55 7.2 7.2 9.35 12 12 12Zm0 2.4c-3.2 0-9.6 1.61-9.6 4.8v2.4h19.2v-2.4c0-3.19-6.4-4.8-9.6-4.8Z" />
    </svg>
  );
}

// `name` rămâne în contract (call site-urile îl pasează deja peste tot) dar nu se mai afișează.
export function AvatarInitials({
  imageUrl,
  size = 38,
  className,
}: {
  name: string | null;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}) {
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
      style={{ width: size, height: size }}
      className={cn(
        "flex flex-none items-center justify-center rounded-full bg-[#ece4d6] text-[#6f685e]",
        className,
      )}
    >
      <PersonSilhouette style={{ width: Math.round(size * 0.55), height: Math.round(size * 0.55) }} />
    </span>
  );
}
