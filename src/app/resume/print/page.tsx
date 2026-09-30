import type { Metadata } from "next";
import Link from "next/link";
import { ResumeView } from "@/components/apps/ResumeView";

export const metadata: Metadata = {
  title: "Résumé (print view)",
  robots: { index: false, follow: false },
};

/** Standalone print-optimised résumé; the PDF is generated from this page. */
export default function ResumePrintPage() {
  return (
    <div className="min-h-screen bg-white" style={{ colorScheme: "light" }}>
      <nav className="print:hidden mx-auto flex max-w-[800px] items-center gap-3 px-8 pt-4 text-[13px]">
        <Link href="/" className="underline">
          ← Back to the portfolio
        </Link>
        <span className="text-neutral-500">Use your browser&apos;s Print → Save as PDF, or download the PDF from Resume.exe.</span>
      </nav>
      <ResumeView print />
      <style>{`@page { size: A4; margin: 12mm; } @media print { body { background: #fff !important; } }`}</style>
    </div>
  );
}
