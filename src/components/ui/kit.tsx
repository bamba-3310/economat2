"use client";

/**
 * Shared UI primitives for the redesigned (maison-de-luxe / monochrome) interface.
 * Ported from the design reference and wired to the real app's bilingual layer:
 * status labels render through `t()` so they translate FR/EN.
 */

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import type { AppUser, LotStatus, StockStatus } from "@/types/domain";
import { useI18n } from "@/lib/i18n";

export function getInitials(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  user,
  className = "h-10 w-10 text-xs",
}: {
  user?: AppUser | null;
  className?: string;
}) {
  if (user?.photoUrl) {
    return (
      <span
        aria-hidden="true"
        className={`inline-block shrink-0 rounded-full border border-[var(--line)] bg-cover bg-center ${className}`}
        style={{ backgroundImage: `url(${user.photoUrl})` }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] font-semibold uppercase tracking-[0.06em] text-[var(--ink)] ${className}`}
    >
      {getInitials(user?.name)}
    </span>
  );
}

export function Eyebrow({
  children,
  tone = "muted",
  className = "",
}: {
  children: ReactNode;
  tone?: "muted" | "ink" | "gold";
  className?: string;
}) {
  const toneClass =
    tone === "gold" ? "eyebrow-gold" : tone === "ink" ? "eyebrow-ink" : "";
  return <span className={`eyebrow ${toneClass} ${className}`}>{children}</span>;
}

const stockStatusClass: Record<StockStatus, string> = {
  Stable: "status-Stable",
  "Seuil bas": "status-low",
  Critique: "status-Critique",
  "Bientôt expiré": "status-soon",
  Expiré: "status-expired",
};

export function StatusChip({ status }: { status: StockStatus }) {
  const { t } = useI18n();
  return (
    <span className={`chip ${stockStatusClass[status]}`}>
      <span className="glyph" />
      {t(status)}
    </span>
  );
}

const lotStatusClass: Record<LotStatus, string> = {
  "En réserve": "",
  "En service": "status-Stable",
  "Bientôt épuisé": "status-low",
  Épuisé: "",
  Expiré: "status-expired",
};

export function LotStatusChip({ status }: { status: LotStatus }) {
  const { t } = useI18n();
  return <span className={`chip ${lotStatusClass[status]}`}>{t(status)}</span>;
}

export function IconButton({
  badge,
  badgeTone = "ink",
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  badge?: number;
  badgeTone?: "ink" | "amber";
  label: string;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
      {badge !== undefined && badge > 0 ? (
        <span className={`dot ${badgeTone === "amber" ? "dot-amber" : ""}`}>
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint ? (
        <span className="mt-1 block text-[0.68rem] text-[var(--muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ""}`} />;
}

type MenuOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

function extractSelectOptions(children: ReactNode): MenuOption[] {
  const options: MenuOption[] = [];
  Children.forEach(children, (child) => {
    if (
      !isValidElement<{
        value?: string | number;
        disabled?: boolean;
        children?: ReactNode;
      }>(child)
    ) {
      return;
    }
    if (child.type !== "option") return;
    options.push({
      value: child.props.value != null ? String(child.props.value) : "",
      label: child.props.children,
      disabled: Boolean(child.props.disabled),
    });
  });
  return options;
}

function emitSelectChange(
  onChange: SelectHTMLAttributes<HTMLSelectElement>["onChange"],
  value: string,
) {
  if (!onChange) return;
  onChange({
    target: { value },
    currentTarget: { value },
  } as ChangeEvent<HTMLSelectElement>);
}

function useMenuDismiss(
  open: boolean,
  onClose: () => void,
  rootRef: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, rootRef]);
}

function MenuList({
  options,
  value,
  activeIndex,
  listId,
  onPick,
  emptyLabel,
}: {
  options: MenuOption[];
  value: string;
  activeIndex: number;
  listId: string;
  onPick: (value: string) => void;
  emptyLabel?: string;
}) {
  return (
    <div className="menu-panel" role="listbox" id={listId}>
      {options.length === 0 ? (
        <div className="menu-empty">{emptyLabel ?? "—"}</div>
      ) : (
        options.map((option, index) => {
          const selected = option.value === value;
          const active = index === activeIndex;
          return (
            <button
              key={`${option.value}-${index}`}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={option.disabled}
              className={`menu-item${selected ? " is-selected" : ""}${active ? " is-active" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (!option.disabled) onPick(option.value);
              }}
            >
              {option.label}
            </button>
          );
        })
      )}
    </div>
  );
}

/** Styled select — same panel look as the product combobox. */
export function Select({
  children,
  className = "",
  disabled,
  value,
  defaultValue,
  onChange,
  onBlur,
  name,
  id,
  required,
  "aria-label": ariaLabel,
  onToggle,
}: SelectHTMLAttributes<HTMLSelectElement> & { onToggle?: (open: boolean) => void }) {
  const options = useMemo(() => extractSelectOptions(children), [children]);
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState(
    String(defaultValue ?? options[0]?.value ?? ""),
  );
  const current = String(isControlled ? value : uncontrolled);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Call onToggle callback when open state changes
  useEffect(() => {
    onToggle?.(open);
  }, [open, onToggle]);

  const selected = options.find((option) => option.value === current);
  const label = selected?.label ?? (current || "—");

  useMenuDismiss(open, () => setOpen(false), rootRef);

  useEffect(() => {
    if (!open) return;
    const index = options.findIndex((option) => option.value === current);
    setActiveIndex(index >= 0 ? index : 0);
  }, [open, options, current]);

  function pick(next: string) {
    if (!isControlled) setUncontrolled(next);
    emitSelectChange(onChange, next);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        const option = options[activeIndex];
        if (option && !option.disabled) pick(option.value);
        return;
      }
      setActiveIndex((index) => Math.min(options.length - 1, Math.max(0, index + 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={`menu-anchor${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
    >
      <select
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        disabled={disabled}
        name={name}
        id={id}
        required={required}
        value={current}
        onChange={(event) => {
          if (!isControlled) setUncontrolled(event.target.value);
          onChange?.(event);
        }}
        onBlur={onBlur}
      >
        {children}
      </select>
      <button
        type="button"
        className="input menu-trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={onKeyDown}
        onBlur={onBlur as ButtonHTMLAttributes<HTMLButtonElement>["onBlur"]}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown className="menu-chevron" size={16} strokeWidth={1.5} aria-hidden />
      </button>
      {open ? (
        <MenuList
          options={options}
          value={current}
          activeIndex={activeIndex}
          listId={listId}
          onPick={pick}
        />
      ) : null}
    </div>
  );
}

/** Free-text field with the same suggestion panel as Select (product picker). */
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className = "",
  emptyLabel,
  listLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  emptyLabel?: string;
  listLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.toLowerCase().includes(query));
  }, [options, value]);

  const menuOptions = useMemo<MenuOption[]>(
    () => filtered.map((option) => ({ value: option, label: option })),
    [filtered],
  );

  useMenuDismiss(open, () => setOpen(false), rootRef);

  useEffect(() => {
    if (!open) return;
    const exact = filtered.findIndex((option) => option === value);
    setActiveIndex(exact >= 0 ? exact : 0);
  }, [open, filtered, value]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((index) => Math.min(menuOptions.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter" && open) {
      const option = menuOptions[activeIndex];
      if (option) {
        event.preventDefault();
        pick(option.value);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={`menu-anchor${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
    >
      <input
        className="input"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={listLabel}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open ? (
        <MenuList
          options={menuOptions}
          value={value}
          activeIndex={activeIndex}
          listId={listId}
          onPick={pick}
          emptyLabel={emptyLabel}
        />
      ) : null}
    </div>
  );
}

export function MetricRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-[var(--line-soft)] last:border-0">
      <span className="eyebrow">{label}</span>
      <span
        className={`numeric text-[1.05rem] ${accent ? "text-[var(--gold-deep)]" : "text-[var(--ink)]"}`}
      >
        {value}
      </span>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-quiet flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="meander w-24 opacity-50" />
      <p className="display text-xl">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-[var(--muted)]">{hint}</p> : null}
      {action}
    </div>
  );
}
