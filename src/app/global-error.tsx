"use client";

// Last-resort boundary when the root layout itself fails. It replaces the
// whole document, so it can't rely on the layout's fonts or stylesheet.

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07050d",
          color: "#f6f1ff",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 16,
        }}
      >
        <title>Something went wrong | ZeeDude Rewards</title>
        <main>
          <h1 style={{ color: "#ffc83d", fontSize: 32, margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ color: "#b3a6cf", margin: "0 0 24px" }}>The site couldn&apos;t load. Please try again in a moment.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              background: "#ffc83d",
              color: "#07050d",
              border: 0,
              borderRadius: 10,
              padding: "10px 20px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
