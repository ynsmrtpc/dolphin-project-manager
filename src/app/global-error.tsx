"use client";

/**
 * Kok layout'un kendisi patlarsa devreye girer; bu yuzden kendi <html>/<body>
 * etiketlerini tasimak zorunda ve tema degiskenlerine guvenemez.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#0b0b0e",
          color: "#eaeaee",
        }}
      >
        <main style={{ maxWidth: "24rem", padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>
            Uygulama başlatılamadı
          </h1>
          <p
            style={{
              marginTop: "0.6rem",
              fontSize: "0.82rem",
              lineHeight: 1.6,
              opacity: 0.65,
            }}
          >
            Beklenmedik bir hata oluştu. Sunucu günlüklerinde ayrıntısı olmalı.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: "0.75rem",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.7rem",
                opacity: 0.4,
              }}
            >
              hata kodu: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #2a2a31",
              background: "#16161a",
              color: "inherit",
              fontSize: "0.82rem",
              cursor: "pointer",
            }}
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}
