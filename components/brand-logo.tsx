import Link from "next/link";

// Logo de brand DETALIA (simbol „A" stratificat + wordmark) — fișier vectorial oficial în
// `public/logo.svg` (variantă pentru fundal deschis) / `public/logo-dark.svg` (fundal închis).
// Piesă mică partajată între landing, paginile de auth și AppHeader, ca tot site-ul să arate la fel.
// `size` = înălțimea logo-ului în px. Aspect ~3.96 (logo orizontal: text + simbol).
export function BrandLogo({
  href = "/",
  size = 24,
  variant = "light",
}: {
  href?: string;
  size?: number;
  variant?: "light" | "dark";
}) {
  return (
    <Link href={href} className="inline-flex items-center no-underline" aria-label="DETALIA — acasă">
      {/* eslint-disable-next-line @next/next/no-img-element -- asset SVG static de brand */}
      <img
        src={variant === "dark" ? "/logo-dark.svg" : "/logo.svg"}
        alt="DETALIA"
        height={size}
        style={{ height: size, width: "auto", display: "block" }}
      />
    </Link>
  );
}
