import Link from "next/link";

// Logo de brand DETALIA (rombul teracotă + wordmark) — piesă mică partajată între landing,
// paginile de auth și AppHeader, ca tot site-ul să arate la fel. Fontul = Archivo (font-sans global).
export function BrandLogo({
  href = "/",
  size = 18,
}: {
  href?: string;
  size?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 no-underline"
      aria-label="DETALIA — acasă"
    >
      <span
        aria-hidden
        className="inline-block size-2.5 rotate-45 bg-primary"
      />
      <span
        className="font-extrabold text-foreground"
        style={{ letterSpacing: "0.2em", fontSize: size }}
      >
        DETALIA
      </span>
    </Link>
  );
}
