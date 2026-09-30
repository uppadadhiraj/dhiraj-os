"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { DialogBody, Progress } from "@/components/ui";
import { profile } from "@/data/profile";

/** Shown while an app's code chunk loads. The bar is indeterminate — no artificial delay. */
export function AppLoading({ name = "application" }: { name?: string }) {
  return (
    <div className="grid h-full place-items-center bg-[var(--c-face)] p-6" role="status" aria-live="polite">
      <div className="w-full max-w-[360px]">
        <p className="mb-3 font-[family-name:var(--font-pixel)] text-[16px]">Loading {name}…</p>
        <div className="progress" aria-hidden="true">
          <div style={{ width: "100%", animation: "boot-fill 1.4s steps(12) infinite" }} />
        </div>
        <span className="sr-only">Loading {name}</span>
      </div>
    </div>
  );
}

interface BoundaryProps {
  children: ReactNode;
  label: string;
  /** called when the user asks for a retry so the parent can remount */
  onRetry?: () => void;
}
interface BoundaryState {
  failed: boolean;
  attempt: number;
}

/**
 * Keeps one broken app from taking the desktop down. Visitors see a retro
 * SYSTEM ERROR dialog — never a stack trace (details go to the console only).
 */
export class AppErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label}]`, error, info.componentStack);
  }

  retry = () => {
    this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }));
    this.props.onRetry?.();
  };

  render() {
    if (this.state.failed) {
      return (
        <div className="grid h-full place-items-center overflow-auto bg-[var(--c-face)] p-4" role="alert">
          <div className="dialog" style={{ width: "min(460px, 100%)" }}>
            <div className="win-title" style={{ background: "var(--title-active)", color: "#fff" }}>
              <span className="win-title-text">SYSTEM ERROR</span>
            </div>
            <DialogBody
              icon="error"
              title={`${this.props.label} failed to load`}
              actions={
                <>
                  <button type="button" className="btn btn-primary" onClick={this.retry}>
                    Retry
                  </button>
                  <a className="btn" href={profile.github.url} target="_blank" rel="noopener noreferrer">
                    Open GitHub
                  </a>
                </>
              }
            >
              <p className="m-0">Something went wrong while running this window. Other windows are unaffected.</p>
              <p className="mb-0 mt-2">Possible causes: a stale browser cache, a blocked script, or a bug on my side.</p>
            </DialogBody>
          </div>
        </div>
      );
    }
    return <div key={this.state.attempt} className="contents">{this.props.children}</div>;
  }
}

export { Progress };
