"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { DialogBody } from "@/components/ui";
import { PixelIcon } from "./PixelIcon";
import { playSound } from "@/lib/sound";

export interface DialogButton {
  label: string;
  primary?: boolean;
  onClick?: () => void;
}
export interface DialogConfig {
  title: string;
  icon?: string;
  heading: string;
  message: ReactNode;
  buttons?: DialogButton[];
}

const DialogCtx = createContext<((c: DialogConfig) => void) | null>(null);

export function useDialog() {
  const d = useContext(DialogCtx);
  if (!d) throw new Error("useDialog must be used inside <DialogHost>");
  return d;
}

/** Modal system dialogs with a focus trap, Esc to cancel and focus restoration. */
export function DialogHost({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState<DialogConfig | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const show = useCallback((c: DialogConfig) => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    if (c.icon === "error" || c.icon === "warn") playSound("error");
    setCfg(c);
  }, []);

  const close = useCallback(() => {
    setCfg(null);
    returnFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!cfg) return;
    const first = boxRef.current?.querySelector<HTMLElement>("button, a[href]");
    first?.focus();
  }, [cfg]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = boxRef.current?.querySelectorAll<HTMLElement>("button, a[href]");
    if (!focusables?.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const value = useMemo(() => show, [show]);

  return (
    <DialogCtx.Provider value={value}>
      {children}
      {cfg && (
        <div className="dialog-scrim" onKeyDown={onKeyDown}>
          <div ref={boxRef} className="dialog" role="alertdialog" aria-modal="true" aria-label={cfg.title} data-anim="open">
            <div className="win-title" style={{ background: "var(--title-active)", color: "#fff" }}>
              <PixelIcon name={cfg.icon ?? "info"} size={16} />
              <span className="win-title-text">{cfg.title}</span>
              <button type="button" className="win-ctl" aria-label="Close dialog" onClick={close}>
                ✕
              </button>
            </div>
            <DialogBody
              icon={cfg.icon ?? "info"}
              title={cfg.heading}
              actions={(cfg.buttons ?? [{ label: "OK", primary: true }]).map((b) => (
                <button
                  key={b.label}
                  type="button"
                  className={`btn ${b.primary ? "btn-primary" : ""}`}
                  onClick={() => {
                    close();
                    b.onClick?.();
                  }}
                >
                  {b.label}
                </button>
              ))}
            >
              {cfg.message}
            </DialogBody>
          </div>
        </div>
      )}
    </DialogCtx.Provider>
  );
}
