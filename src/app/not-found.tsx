import Link from "next/link";
import type { Metadata } from "next";
import { Wallpaper } from "@/components/os/Wallpaper";
import { PixelIcon } from "@/components/os/PixelIcon";

export const metadata: Metadata = {
  title: "404.EXE — Application not found",
  robots: { index: false, follow: false },
};

/** 404.EXE — rendered inside the root layout so fonts and the design system apply. */
export default function NotFound() {
  return (
    <div className="os-root">
      <Wallpaper />
      <main className="absolute inset-0 grid place-items-center p-4">
        <div className="dialog" style={{ width: "min(480px, 100%)" }} role="alertdialog" aria-labelledby="nf-title" aria-describedby="nf-desc">
          <div className="win-title" style={{ background: "var(--title-active)", color: "#fff" }}>
            <PixelIcon name="error" size={16} />
            <span className="win-title-text">404.EXE</span>
          </div>
          <div className="flex flex-col gap-4 bg-[var(--c-face)] p-4">
            <div className="flex gap-4">
              <PixelIcon name="error" size={44} />
              <div>
                <h1 id="nf-title" className="m-0 font-[family-name:var(--font-pixel)] text-[20px] leading-tight text-[var(--c-ink)]">
                  Application not found
                </h1>
                <p id="nf-desc" className="mb-0 mt-2 text-[14px] leading-relaxed text-[var(--c-ink-2)]">
                  404: the project or page you asked for isn&apos;t installed on this desktop. It may have been renamed, or it
                  never existed. The rest of the portfolio is fine.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Link href="/" className="btn btn-primary">
                Return to Desktop
              </Link>
              <Link href="/?start=1" className="btn">
                Open Start Menu
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
