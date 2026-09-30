"use client";

/** Last-resort boundary (errors in the root layout). Self-contained: no fonts or stylesheets are assumed. */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0a1020", color: "#14161f", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
          <div role="alertdialog" aria-labelledby="ge" style={{ background: "#c0c0c0", padding: 3, width: "min(460px,100%)", boxShadow: "inset -1px -1px #000, inset 1px 1px #fff" }}>
            <div style={{ background: "linear-gradient(90deg,#0a1f7a,#4f8fe0)", color: "#fff", padding: "4px 8px", fontWeight: 700 }}>SYSTEM ERROR</div>
            <div style={{ padding: 16 }}>
              <h1 id="ge" style={{ margin: "0 0 8px", fontSize: 20 }}>Application failed to load</h1>
              <p style={{ margin: "0 0 16px", lineHeight: 1.5 }}>Something broke before the desktop could start. Retrying usually fixes it.</p>
              <button type="button" onClick={() => retry()} style={{ padding: "6px 14px", fontWeight: 700 }}>Retry</button>{" "}
              <a href="https://github.com/uppadadhiraj" style={{ marginLeft: 8 }}>Open GitHub</a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
