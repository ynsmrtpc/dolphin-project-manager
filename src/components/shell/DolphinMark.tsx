/**
 * Uygulama logosu.
 *
 * Kaynak `public/logo.svg`; kucuk boyutlar icin sikilastirilmis varyant
 * `scripts/generate-icons.mjs` tarafindan `public/logo-mark.svg` olarak uretiliyor.
 * Marka renkleri dosyanin icinde sabit: logo temaya gore renk degistirmez.
 */
export function DolphinMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-mark.svg"
      alt=""
      width={32}
      height={32}
      className={className}
      aria-hidden="true"
    />
  );
}
