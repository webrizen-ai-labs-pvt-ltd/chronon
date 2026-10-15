"use client";

import { X } from "@untitledui/icons";
import { useState, type ReactNode } from "react";
import { Dialog, Heading, Modal, ModalOverlay, Switch as AriaSwitch } from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";
import { inputCls } from "./kit";

/** Right-hand slide-over panel for forms (record editor, field editor). */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 bg-night/40 entering:animate-in entering:fade-in entering:duration-150"
    >
      <Modal
        className="fixed inset-y-0 right-0 flex w-full outline-none entering:animate-in entering:slide-in-from-right entering:duration-200"
        style={{ maxWidth: width }}
      >
        <Dialog className="flex h-full w-full flex-col bg-card shadow-2xl outline-none">
          {({ close }) => (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-5">
                <div className="flex min-w-0 flex-col gap-1">
                  <Heading slot="title" className="text-[18px] font-bold tracking-[-0.01em] text-night">
                    {title}
                  </Heading>
                  {description && <p className="text-[13.5px] text-slate">{description}</p>}
                </div>
                <button type="button" onClick={close} aria-label="Close" className="-m-1.5 rounded-md p-1.5 text-slate transition hover:bg-neutral-100 hover:text-night">
                  <X className="size-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5" data-lenis-prevent>
                {children}
              </div>
              {footer && <div className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-paper/50 px-6 py-4">{footer}</div>}
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Centered dialog for confirmations. */
export function DialogBox({
  open,
  onOpenChange,
  title,
  children,
  footer,
  tone = "default",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 grid place-items-center bg-night/40 p-4 entering:animate-in entering:fade-in entering:duration-150"
    >
      <Modal className="w-full max-w-[460px] outline-none entering:animate-in entering:zoom-in-95 entering:duration-150">
        <Dialog role="alertdialog" className="overflow-hidden rounded-xl bg-card shadow-2xl outline-none">
          <div className="flex flex-col gap-2 px-6 pt-6 pb-5">
            <Heading slot="title" className={cx("text-[18px] font-bold tracking-[-0.01em]", tone === "danger" ? "text-[#a12b2b]" : "text-night")}>
              {title}
            </Heading>
            <div className="text-[14px] leading-relaxed text-ink-2">{children}</div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-paper/50 px-6 py-4">{footer}</div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/**
 * A button that asks before running `onConfirm`. Pass `confirmText` to make the
 * person type it (e.g. the API slug) before the action unlocks.
 */
export function ConfirmButton({
  label,
  title,
  body,
  confirmLabel,
  confirmText,
  tone = "default",
  size = "sm",
  color,
  onConfirm,
  iconLeading,
}: {
  label: ReactNode;
  title: ReactNode;
  body: ReactNode;
  confirmLabel: string;
  confirmText?: string;
  tone?: "default" | "danger";
  size?: "xs" | "sm" | "md";
  color?: "primary" | "secondary" | "tertiary" | "secondary-destructive" | "primary-destructive";
  onConfirm: (typed: string) => Promise<{ ok: boolean; error?: string } | void>;
  iconLeading?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = confirmText !== undefined && typed !== confirmText;

  return (
    <>
      <Button size={size} color={color ?? (tone === "danger" ? "secondary-destructive" : "secondary")} onPress={() => setOpen(true)} iconLeading={iconLeading}>
        {label}
      </Button>
      <DialogBox
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setTyped("");
            setError(null);
          }
        }}
        title={title}
        tone={tone}
        footer={
          <>
            <Button size="sm" color="secondary" onPress={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              color={tone === "danger" ? "primary-destructive" : "primary"}
              isDisabled={locked || busy}
              isLoading={busy}
              onPress={async () => {
                setBusy(true);
                setError(null);
                const res = await onConfirm(typed);
                setBusy(false);
                if (res && !res.ok) setError(res.error ?? "Something went wrong.");
                else setOpen(false);
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {body}
          {confirmText !== undefined && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-slate">
                Type <code className="font-mono text-night">{confirmText}</code> to confirm
              </span>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} className={inputCls} autoFocus spellCheck={false} />
            </label>
          )}
          {error && <p className="text-[13.5px] text-[#a12b2b]">{error}</p>}
        </div>
      </DialogBox>
    </>
  );
}

export function Switch({ isSelected, onChange, label, description, isDisabled }: { isSelected: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; isDisabled?: boolean }) {
  return (
    <AriaSwitch isSelected={isSelected} onChange={onChange} isDisabled={isDisabled} className="group flex cursor-pointer items-start gap-3 disabled:cursor-not-allowed disabled:opacity-60">
      <span className="mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full bg-neutral-200 p-0.5 transition group-selected:bg-ion group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-focus-ring">
        <span className="size-4 rounded-full bg-white shadow-sm transition group-selected:translate-x-4" />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[14px] font-semibold text-night">{label}</span>
        {description && <span className="text-[13px] text-slate">{description}</span>}
      </span>
    </AriaSwitch>
  );
}

/** Label + control + hint/error, with consistent spacing. */
export function Field({ label, hint, error, children, required, htmlFor, className }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; required?: boolean; htmlFor?: string; className?: string }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13.5px] font-semibold text-night">
        {label}
        {required && <span className="ml-0.5 text-photon">*</span>}
      </label>
      {children}
      {error ? <p className="text-[12.5px] text-[#a12b2b]">{error}</p> : hint ? <p className="text-[12.5px] text-slate">{hint}</p> : null}
    </div>
  );
}

/** Comma/Enter-separated tag input for lists (enum values, list fields). */
export function TagInput({ value, onChange, placeholder, id, invalid }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; id?: string; invalid?: boolean }) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const parts = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !value.includes(s));
    if (parts.length) onChange([...value, ...parts]);
    setDraft("");
  };
  return (
    <div
      className={cx(
        "flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-lg bg-primary px-2 py-1.5 shadow-xs ring-1 ring-primary ring-inset focus-within:ring-2 focus-within:ring-brand",
        invalid && "ring-error",
      )}
    >
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-neutral-100 py-0.5 pr-1 pl-2 text-[12.5px] text-night ring-1 ring-neutral-200 ring-inset">
          {v}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="rounded p-0.5 text-slate hover:bg-neutral-200 hover:text-night">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={commit}
        placeholder={value.length ? "" : placeholder}
        className="min-w-[120px] flex-1 bg-transparent px-1 text-sm text-primary outline-none placeholder:text-placeholder"
      />
    </div>
  );
}
