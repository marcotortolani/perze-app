/* PERZE Design System — v2 additions and patches.
 *
 * Source of truth for the code handoff. JSX, same conventions as components/ in the
 * design system repo: no external deps beyond React, all values from tokens, no inline
 * hex, no shadows except Sheet/FAB, no gradients.
 *
 * Order: FUNCTIONAL first (things that are wrong today), then COSMETIC.
 * Each component's contract lives in CONTRATO-DE-COMPONENTES.md.
 */

import React from 'react';
import { Icon, Button, Chip, Card, Switch } from './core';

/* ============================================================ FUNCTIONAL ==== */

/** Money precision is never assumed: it is derived from the currency pair or the
 *  instrument and passed in. UYU 0, USD 2, BTC 8. */
export const PRECISION = { UYU: 0, ARS: 0, USD: 2, EUR: 2, BRL: 2, BTC: 8, ETH: 8 };

export function decimalsFor({ currency, instrument }) {
  if (instrument && instrument.quantityDecimals != null) return instrument.quantityDecimals;
  if (instrument && instrument.currency) return PRECISION[instrument.currency] ?? 2;
  return PRECISION[currency] ?? 2;
}

/** es-UY grouping. `decimals` is REQUIRED: callers derive it, the formatter never guesses. */
export function formatNumber(value, decimals) {
  const [int, frac] = Math.abs(Number(value) || 0).toFixed(decimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return frac ? `${grouped},${frac}` : grouped;
}

/** Rate — an exchange rate between two currencies. Precision comes from the PAIR,
 *  never from a default: UYU/ARS needs 4, USD/UYU needs 2, BTC/USD needs 2 on price
 *  and 8 on quantity. */
export function Rate({ from, to, value, decimals, source, ageHours, onEdit, style, ...rest }) {
  const d = decimals ?? Math.max(PRECISION[from] ?? 2, PRECISION[to] ?? 2);
  const stale = ageHours != null && ageHours >= 24;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, ...style }} {...rest}>
      <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>
        1 {from} = {formatNumber(value, d)} {to}
      </span>
      {source ? <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{source}</span> : null}
      {stale ? <StatusBadge status="warning" icon="clock" ageDays={ageHours / 24}>{Math.round(ageHours)} h</StatusBadge> : null}
      {onEdit ? <Chip icon="edit" onClick={onEdit}>Cambiar</Chip> : null}
    </div>
  );
}

/** Quantity — a holding size. Decimals come from the instrument (8 for BTC, 4 for a
 *  fund unit, 0 for a share). Never right-aligned as a column: variable precision
 *  lives in flowing text so it cannot break an aligned column. */
export function Quantity({ value, instrument, decimals, suffix, style, ...rest }) {
  const d = decimals ?? decimalsFor({ instrument });
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--text-secondary)', ...style }} {...rest}>
      {formatNumber(value, d)}{suffix ? ` ${suffix}` : ''}
    </span>
  );
}

const STATUS = {
  neutral: { color: 'var(--text-secondary)', background: 'var(--surface-2)', icon: 'clock' },
  good: { color: 'var(--good)', icon: 'check' },
  warning: { color: 'var(--warning)', icon: 'alert' },
  serious: { color: 'var(--serious)', icon: 'trend' },
  critical: { color: 'var(--critical)', icon: 'alert' }
};

/** StatusBadge — a state with a level, always icon + label, never colour alone.
 *  Owns the ONLY age escalation in the system: a `neutral` badge with `ageDays >= 7`
 *  becomes `warning`. No screen repeats this rule. */
export function StatusBadge({ status = 'good', ageDays, children, icon, style, ...rest }) {
  const escalated = status === 'neutral' && ageDays != null && ageDays >= 7 ? 'warning' : status;
  const s = STATUS[escalated];
  return (
    <span
      role="status"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px',
        borderRadius: 'var(--radius-chip)', fontFamily: 'var(--font-sans)', fontWeight: 500,
        fontSize: 12, lineHeight: 1.4, color: s.color,
        background: s.background ?? `color-mix(in srgb, ${s.color} 15%, transparent)`, ...style
      }}
      {...rest}
    >
      <Icon name={icon || s.icon} size={13} strokeWidth={2.5} />
      {children}
    </span>
  );
}

/** ListRow — the row of the system. `meta`, `value` and `right` accept ReactNode, so a
 *  row can carry a badge, a Rate or a Switch without rebuilding the row by hand.
 *  With `right` the row is a div (a button cannot contain interactive content). */
export function ListRow({
  label, meta, value, secondaryValue, icon, variant = 'navigation', chevron, right,
  destructive = false, disabled = false, onClick, style, ...rest
}) {
  const showChevron = chevron ?? (variant === 'navigation' && !right);
  const interactive = !!onClick && !disabled;
  const asButton = interactive && !right;
  const Tag = asButton ? 'button' : 'div';
  const labelColor = disabled ? 'var(--text-muted)' : destructive ? 'var(--critical)' : variant === 'action' ? 'var(--primary-ink)' : 'var(--text-primary)';
  return (
    <Tag
      type={asButton ? 'button' : undefined}
      onClick={interactive ? onClick : undefined}
      disabled={asButton ? disabled || undefined : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 56, padding: '8px 0', background: 'none', border: 0, textAlign: 'left', cursor: interactive ? 'pointer' : 'default', opacity: disabled ? 0.4 : 1, ...style }}
      {...rest}
    >
      {icon ? (
        <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={icon} size={19} color={destructive ? 'var(--critical)' : 'var(--text-secondary)'} />
        </span>
      ) : null}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: '400 16px/22px var(--font-sans)', color: labelColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {meta ? <span style={{ display: 'block', font: '500 13px/18px var(--font-sans)', color: 'var(--text-muted)', marginTop: 1 }}>{meta}</span> : null}
      </span>
      {value != null ? (
        <span style={{ flexShrink: 0, textAlign: 'right' }}>
          <span style={{ display: 'block', font: '500 16px/22px var(--font-sans)', color: 'var(--text-secondary)' }}>{value}</span>
          {secondaryValue != null ? <span style={{ display: 'block', font: '500 13px/18px var(--font-sans)', color: 'var(--text-muted)' }}>{secondaryValue}</span> : null}
        </span>
      ) : null}
      {right}
      {showChevron ? <Icon name="chevron" size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} /> : null}
    </Tag>
  );
}

/** SelectableRow — a row that IS a choice. Selection by surface, never by brand fill.
 *  Carries role + aria-checked so the state is not only visual. */
export function SelectableRow({ label, meta, selected = false, multiple = false, onChange, disabled, style, ...rest }) {
  return (
    <div
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : () => onChange?.(!selected)}
      onKeyDown={e => { if (!disabled && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); onChange?.(!selected); } }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '10px 14px', borderRadius: 'var(--radius-input)', background: selected ? 'var(--surface-3)' : 'var(--surface-2)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, ...style }}
      {...rest}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: '400 16px/22px var(--font-sans)', color: 'var(--text-primary)' }}>{label}</span>
        {meta ? <span style={{ display: 'block', font: '500 13px/18px var(--font-sans)', color: 'var(--text-muted)', marginTop: 1 }}>{meta}</span> : null}
      </span>
      {selected ? <Icon name="check" size={19} color="var(--text-primary)" /> : null}
    </div>
  );
}

/** OptionCard — a big one-tap choice: title, one line, selection by surface.
 *  Three uses in block A alone (how you use the app, category template, account type). */
export function OptionCard({ title, description, selected = false, multiple = false, onChange, disabled, style, ...rest }) {
  return (
    <div
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : () => onChange?.(!selected)}
      onKeyDown={e => { if (!disabled && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); onChange?.(!selected); } }}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minHeight: 72, padding: 20, borderRadius: 'var(--radius-card)', background: selected ? 'var(--surface-3)' : 'var(--surface-1)', cursor: disabled ? 'default' : 'pointer', ...style }}
      {...rest}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: '500 16px/22px var(--font-sans)', color: 'var(--text-primary)' }}>{title}</span>
        {description ? <span style={{ display: 'block', font: '400 14px/20px var(--font-sans)', color: 'var(--text-secondary)', marginTop: 3, textWrap: 'pretty' }}>{description}</span> : null}
      </span>
      {selected ? <Icon name="check" size={20} color="var(--text-primary)" style={{ marginTop: 1 }} /> : null}
    </div>
  );
}

const KEY_STYLE = {
  height: 'var(--keypad-key-height)', minWidth: 44, borderRadius: 'var(--radius-keypad-key)',
  background: 'var(--surface-2)', border: 0, color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)', fontSize: 32, fontWeight: 500, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center'
};

/** KeypadKey — shared primitive of both keypads. 64px tall, 44px minimum target,
 *  press = scale(.96) + 8ms haptic. */
export function KeypadKey({ label, ariaLabel, onPress, onLongPress, size = 32, style, ...rest }) {
  const timer = React.useRef(null);
  const [pressed, setPressed] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={ariaLabel || String(label)}
      onPointerDown={() => { setPressed(true); if (onLongPress) timer.current = setTimeout(onLongPress, 500); }}
      onPointerUp={() => { setPressed(false); clearTimeout(timer.current); onPress?.(); }}
      onPointerLeave={() => { setPressed(false); clearTimeout(timer.current); }}
      style={{ ...KEY_STYLE, fontSize: size, transform: pressed ? 'scale(var(--press-scale))' : 'scale(1)', transition: 'transform var(--duration-micro) var(--ease-spring-snappy)', ...style }}
      {...rest}
    >
      {label}
    </button>
  );
}

/** PinKeypad — entering a secret. Deliberately NOT a variant of Keypad: no operators,
 *  no decimal comma, fixed length, masked progress, and a lockout after 3 wrong tries.
 *  See the contract for the full justification. */
export function PinKeypad({ length = 4, filled = 0, error = false, lockedSeconds = 0, onKey, onBackspace, style, ...rest }) {
  const locked = lockedSeconds > 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, ...style }} {...rest}>
      <div role="status" aria-label={`${filled} de ${length} dígitos`} style={{ display: 'flex', gap: 14 }}>
        {Array.from({ length }, (_, i) => (
          <span key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: error ? 'var(--critical)' : i < filled ? 'var(--text-primary)' : 'var(--surface-3)', transition: 'background var(--duration-fast) var(--ease-spring-snappy)' }} />
        ))}
      </div>
      {locked ? (
        <p style={{ margin: 0, font: '400 15px/22px var(--font-sans)', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '30ch' }}>
          Tres intentos seguidos. Probá de nuevo en {lockedSeconds} segundos. Tus datos están intactos.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', width: '100%', maxWidth: 288 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <KeypadKey key={n} label={n} onPress={() => onKey?.(String(n))} />)}
          <span />
          <KeypadKey label="0" onPress={() => onKey?.('0')} />
          <KeypadKey label={<Icon name="backspace" size={24} />} ariaLabel="Borrar" onPress={onBackspace} />
        </div>
      )}
    </div>
  );
}

/** OtpInput — six boxes for the magic-link code. Real single input underneath so the
 *  OS can autofill it; the boxes are presentation. */
export function OtpInput({ length = 6, value = '', onChange, invalid = false, style, ...rest }) {
  const ref = React.useRef(null);
  return (
    <div onClick={() => ref.current?.focus()} style={{ position: 'relative', display: 'flex', gap: 8, ...style }} {...rest}>
      <input
        ref={ref} type="text" inputMode="numeric" autoComplete="one-time-code"
        aria-label="Código de 6 dígitos" aria-invalid={invalid || undefined}
        maxLength={length} value={value} onChange={e => onChange?.(e.target.value.replace(/\D/g, ''))}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', border: 0 }}
      />
      {Array.from({ length }, (_, i) => (
        <span key={i} style={{ flex: 1, height: 56, minWidth: 44, borderRadius: 'var(--radius-input)', background: 'var(--surface-3)', outline: invalid ? '2px solid var(--critical)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>
          {value[i] ?? ''}
        </span>
      ))}
    </div>
  );
}

/** Sheet — bottom sheet. `container="parent"` (default) positions against the nearest
 *  positioned ancestor so it works inside a 390x844 frame; `container="viewport"` is
 *  the old fixed behaviour. Only element besides the FAB allowed to cast a shadow. */
export function Sheet({ open = true, title, children, onClose, height = 'auto', container = 'parent', style, ...rest }) {
  if (!open) return null;
  return (
    <div style={{ position: container === 'viewport' ? 'fixed' : 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 10 }}>
      <div onClick={onClose} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }} />
      <section
        role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        style={{ position: 'relative', background: 'var(--surface-2)', borderRadius: 'var(--radius-sheet) var(--radius-sheet) 0 0', boxShadow: 'var(--shadow-sheet)', padding: '10px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))', height, ...style }}
        {...rest}
      >
        <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--border)', margin: '0 auto 14px' }} />
        {title ? <h2 style={{ margin: '0 0 16px', font: '600 var(--text-title-size)/var(--text-title-line) var(--font-sans)', letterSpacing: 'var(--text-title-track)' }}>{title}</h2> : null}
        {children}
      </section>
    </div>
  );
}

/* ============================================================= COSMETIC ==== */

/** ZMark — the only drawing in the system. Static at 20% ink for empty states,
 *  animated in sequence as the app loader. */
export function ZMark({ size = 20, gap = 6, animated = false, style, ...rest }) {
  const on = 'color-mix(in srgb, var(--text-primary) 20%, transparent)';
  const cells = [1, 1, 1, 0, 1, 0, 1, 1, 1];
  let step = 0;
  return (
    <div role="img" aria-label="PERZE" style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${size}px)`, gap, ...style }} {...rest}>
      {cells.map((c, i) => {
        const delay = c ? step++ * 120 : 0;
        return <span key={i} style={{ width: size, height: size, borderRadius: Math.round(size / 4), background: c && !animated ? on : 'transparent', animation: c && animated ? `zpulse 1.4s ease-in-out ${delay}ms infinite` : undefined }} />;
      })}
    </div>
  );
}

/** Avatar — a member. Colour is data identity, so fill is allowed here, but a member is
 *  never identified by colour alone: the initial is always rendered. */
export function Avatar({ name, color = 'var(--data-4)', size = 32, pending = false, style, ...rest }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <span
      aria-label={name} title={name}
      style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: pending ? 'var(--surface-3)' : color, color: pending ? 'var(--text-muted)' : 'var(--primary-on-fill)', font: `600 ${Math.round(size * 0.42)}px/${size}px var(--font-sans)`, textAlign: 'center', ...style }}
      {...rest}
    >
      {initial}
    </span>
  );
}

/** AvatarCluster — up to 3 faces plus a +N. Needed by visibility rows and shared rows
 *  once a household has more than two people. */
export function AvatarCluster({ members = [], max = 3, size = 28, style, ...rest }) {
  const shown = members.slice(0, max);
  const rest_ = members.length - shown.length;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', ...style }} {...rest}>
      {shown.map((m, i) => <Avatar key={m.id ?? i} name={m.name} color={m.color} size={size} style={{ marginLeft: i ? -8 : 0, outline: '2px solid var(--page)' }} />)}
      {rest_ > 0 ? <span style={{ marginLeft: 6, font: '500 13px/18px var(--font-sans)', color: 'var(--text-secondary)' }}>+{rest_}</span> : null}
    </span>
  );
}

/** VisibilityRow — "who sees this". The state is the presence of a face; absence is an
 *  eye-off icon plus the words "Solo vos", so it reads without colour too. */
export function VisibilityRow({ label, meta, viewers = [], onToggle, style, ...rest }) {
  const shared = viewers.length > 0;
  return (
    <div
      role="switch" aria-checked={shared} tabIndex={0}
      aria-label={`${label}: ${shared ? `visible para ${viewers.map(v => v.name).join(', ')}` : 'solo vos'}`}
      onClick={() => onToggle?.(!shared)}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle?.(!shared); } }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '9px 0', cursor: 'pointer', ...style }}
      {...rest}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: '400 16px/22px var(--font-sans)', color: 'var(--text-primary)' }}>{label}</span>
        {meta ? <span style={{ display: 'block', font: '500 13px/18px var(--font-sans)', color: 'var(--text-muted)' }}>{meta}</span> : null}
      </span>
      {shared
        ? <AvatarCluster members={viewers} size={32} />
        : <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}><Icon name="eye-off" size={18} color="var(--text-muted)" /><span style={{ font: '500 13px/18px var(--font-sans)', color: 'var(--text-muted)' }}>Solo vos</span></span>}
    </div>
  );
}

/** ProgressSteps — onboarding progress. Dots, never a percentage. */
export function ProgressSteps({ total, current, style, ...rest }) {
  return (
    <div role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current} aria-label={`Paso ${current} de ${total}`} style={{ display: 'flex', gap: 6, ...style }} {...rest}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i < current ? 'var(--text-primary)' : 'var(--surface-3)' }} />
      ))}
    </div>
  );
}

/** ProgressBar — a ratio. `tone` is semantic: neutral for "how much is missing",
 *  progress (aqua) for savings and debt paid, budget for spend against a cap, which is
 *  the only tone that escalates to warning at 80% and critical over 100%. */
export function ProgressBar({ value, max = 1, tone = 'neutral', height = 8, label, style, ...rest }) {
  const ratio = Math.max(0, Math.min(1, value / max));
  const over = value / max > 1;
  const color = tone === 'progress' ? 'var(--secondary)'
    : tone === 'budget' ? (over ? 'var(--critical)' : value / max >= 0.8 ? 'var(--warning)' : 'var(--text-secondary)')
      : 'var(--text-secondary)';
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}
      style={{ position: 'relative', height, borderRadius: 999, background: 'var(--surface-3)', ...style }} {...rest}>
      <div style={{ position: 'absolute', inset: `0 ${(1 - ratio) * 100}% 0 0`, borderRadius: 999, background: color, transition: 'inset var(--duration-slow) var(--ease-spring-soft)' }} />
    </div>
  );
}

/** BulletBar — budget bullet: spent, cap and projection on a common scale, so rows are
 *  comparable across categories. The rail is 140% of the cap and the cap tick is always
 *  at the same x. */
export function BulletBar({ spent, cap, projected, height = 8, style, ...rest }) {
  const scale = cap * 1.4;
  const pct = v => `${Math.min(100, (v / scale) * 100)}%`;
  const over = spent > cap;
  const color = over ? 'var(--critical)' : spent / cap >= 0.8 ? 'var(--warning)' : 'var(--text-secondary)';
  return (
    <div role="img" aria-label={`Gastado ${spent} de ${cap}${projected ? `, proyección ${projected}` : ''}`}
      style={{ position: 'relative', height, borderRadius: 999, background: 'var(--surface-3)', ...style }} {...rest}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(spent), borderRadius: 999, background: color }} />
      <div style={{ position: 'absolute', left: '71.4%', top: -4, height: height + 8, width: 2, background: 'var(--text-primary)' }} />
      {projected != null ? <div style={{ position: 'absolute', left: pct(projected), top: -2, height: height + 4, width: 2, background: 'var(--text-muted)' }} /> : null}
    </div>
  );
}

/** RadialDial — one-thumb amount input outside the keypad. 270° arc, neutral ink (never
 *  brand: the primary action owns the only violet), 56px thumb, step-quantised. */
export function RadialDial({ value, min = 0, max, step = 100, size = 260, onChange, children, style, ...rest }) {
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = 225 + ratio * 270;
  const r = size / 2 - 14;
  const cx = size / 2 + r * Math.sin((angle * Math.PI) / 180);
  const cy = size / 2 - r * Math.cos((angle * Math.PI) / 180);
  const onKey = e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange?.(Math.min(max, value + step));
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange?.(Math.max(min, value - step));
  };
  return (
    <div
      role="slider" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} tabIndex={0} onKeyDown={onKey}
      style={{ position: 'relative', width: size, height: size, ...style }} {...rest}
    >
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(from 225deg, var(--text-primary) 0turn ${ratio * 0.75}turn, var(--surface-3) ${ratio * 0.75}turn 0.75turn, transparent 0.75turn 1turn)` }} />
      <div style={{ position: 'absolute', inset: 22, borderRadius: '50%', background: 'var(--page)' }} />
      <div style={{ position: 'absolute', left: cx - 28, top: cy - 28, width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--text-primary)' }} />
      </div>
      <div style={{ position: 'absolute', inset: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>{children}</div>
    </div>
  );
}

/** LineChart — the real one. 2px line, markers >= 8px only on selected points, hairline
 *  horizontal grid, no box, no dual axis, touch tooltip 48px above the finger.
 *  `discrete` draws a step line with a marker per point, for hand-entered prices. */
export function LineChart({ series = [], height = 148, gridLines = 2, labelPoints = 'extremes', discrete = false, onPoint, style, ...rest }) {
  const w = 320;
  const all = series.flatMap(s => s.values);
  const min = Math.min(...all), max = Math.max(...all) || 1;
  const y = v => height - 20 - ((v - min) / (max - min || 1)) * (height - 40);
  const x = (i, n) => (i / Math.max(1, n - 1)) * w;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} role="img" style={{ width: '100%', height: 'auto', display: 'block', ...style }} {...rest}>
      {Array.from({ length: gridLines }, (_, g) => {
        const gy = ((g + 1) / (gridLines + 1)) * (height - 20);
        return <line key={g} x1="0" y1={gy} x2={w} y2={gy} stroke="var(--gridline)" strokeWidth="1" />;
      })}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => `${x(i, s.values.length)},${y(v)}`).join(' ');
        return (
          <g key={s.label ?? si}>
            <polyline points={pts} fill="none" stroke={s.color ?? `var(--data-${si + 1})`} strokeWidth="2" strokeLinejoin="round" strokeDasharray={s.dashed ? '4 4' : undefined} />
            {(discrete ? s.values : [s.values[0], s.values[s.values.length - 1]]).map((v, i) => {
              const idx = discrete ? i : i === 0 ? 0 : s.values.length - 1;
              return <circle key={idx} cx={x(idx, s.values.length)} cy={y(s.values[idx])} r="4" fill={s.color ?? `var(--data-${si + 1})`} onPointerDown={() => onPoint?.(si, idx)} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

/** DataList — a table without borders: 2 to 4 mono columns aligned by right edge.
 *  Backs every "ver como tabla", the amortisation list and the installment preview. */
export function DataList({ columns = [], rows = [], style, ...rest }) {
  return (
    <div role="table" style={style} {...rest}>
      <div role="row" style={{ display: 'flex', gap: 12, font: '500 11px/16px var(--font-sans)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {columns.map((c, i) => <span key={c.key} role="columnheader" style={{ flex: i === 0 ? 1 : undefined, width: i === 0 ? undefined : c.width ?? 72, textAlign: i === 0 ? 'left' : 'right' }}>{c.label}</span>)}
      </div>
      {rows.map((r, ri) => (
        <div role="row" key={ri} style={{ display: 'flex', gap: 12, padding: '11px 0' }}>
          {columns.map((c, i) => (
            <span role="cell" key={c.key}
              style={{ flex: i === 0 ? 1 : undefined, width: i === 0 ? undefined : c.width ?? 72, textAlign: i === 0 ? 'left' : 'right', font: i === 0 ? '400 16px/22px var(--font-sans)' : '400 13px/22px var(--font-mono)', fontVariantNumeric: i === 0 ? 'normal' : 'tabular-nums', color: r.emphasis ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {r[c.key]}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** ChartCard — the wrapper every chart must use, because it is what guarantees the
 *  table toggle exists. Caption title, optional dimension control, chart, legend. */
export function ChartCard({ title, controls, legend, footnote, view = 'chart', onViewChange, children, style, ...rest }) {
  return (
    <Card padding={16} style={style} {...rest}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1, font: '500 11px/16px var(--font-sans)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{title}</span>
        {controls}
        <Chip icon="list" aria-pressed={view === 'table'} onClick={() => onViewChange?.(view === 'table' ? 'chart' : 'table')}>Tabla</Chip>
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
      {legend ? <div style={{ marginTop: 12 }}>{legend}</div> : null}
      {footnote ? <div style={{ font: '400 13px/19px var(--font-sans)', color: 'var(--text-muted)', marginTop: 8 }}>{footnote}</div> : null}
    </Card>
  );
}

/** DismissibleNotice — the one-step contextual tooltip. In flow, never floating, never
 *  chained: one per session, dismissed forever, tied to a `featureKey`. */
export function DismissibleNotice({ featureKey, text, actionLabel, onAction, onDismiss, style, ...rest }) {
  return (
    <Card surface={2} padding={16} data-feature={featureKey} style={style} {...rest}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <p style={{ flex: 1, margin: 0, font: '400 15px/22px var(--font-sans)', color: 'var(--text-primary)', textWrap: 'pretty' }}>{text}</p>
        <button type="button" aria-label="Cerrar" onClick={onDismiss} style={{ width: 44, height: 44, margin: -12, background: 'none', border: 0, cursor: 'pointer' }}>
          <Icon name="close" size={18} color="var(--text-muted)" />
        </button>
      </div>
      {actionLabel ? <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><Chip icon="chevron" onClick={onAction}>{actionLabel}</Chip><Chip onClick={onDismiss}>Entendido</Chip></div> : null}
    </Card>
  );
}

/** InstitutionTile — bank/wallet picker with a logo slot. `logo` is ReactNode; with no
 *  logo it falls back to the institution's initials, never to a generic icon. */
export function InstitutionTile({ name, logo, selected = false, onChange, style, ...rest }) {
  return (
    <div role="radio" aria-checked={selected} tabIndex={0} onClick={() => onChange?.(name)}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange?.(name); } }}
      style={{ width: 100, minHeight: 88, borderRadius: 'var(--radius-card)', background: selected ? 'var(--surface-3)' : 'var(--surface-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, cursor: 'pointer', ...style }} {...rest}>
      <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '600 13px/32px var(--font-sans)', color: 'var(--text-secondary)', overflow: 'hidden' }}>
        {logo ?? name.slice(0, 2).toUpperCase()}
      </span>
      <span style={{ font: '500 13px/18px var(--font-sans)', color: 'var(--text-primary)', textAlign: 'center' }}>{name}</span>
    </div>
  );
}

/** ActivityRow — who did what, when. Household feed, edit history, import log. */
export function ActivityRow({ member, text, meta, style, ...rest }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', ...style }} {...rest}>
      <Avatar name={member?.name} color={member?.color} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '400 16px/22px var(--font-sans)', color: 'var(--text-primary)', textWrap: 'pretty' }}>{text}</div>
        {meta ? <div style={{ font: '500 13px/18px var(--font-sans)', color: 'var(--text-muted)', marginTop: 1 }}>{meta}</div> : null}
      </div>
    </div>
  );
}

/** ConflictCards — two versions of the same object, only the differing fields, three
 *  non-destructive ways out. Owned by the error system, used by household sync. */
export function ConflictCards({ subject, versions = [], diffFields = [], onPick, onPickNewest, style, ...rest }) {
  return (
    <div style={style} {...rest}>
      <p style={{ margin: 0, font: '400 16px/24px var(--font-sans)', color: 'var(--text-primary)', textWrap: 'pretty' }}>
        Los dos editaron <strong style={{ fontWeight: 500 }}>{subject}</strong>. Nada se borró: elegí cuál queda.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
        {versions.map(v => (
          <Card key={v.id} padding={16}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={v.member.name} color={v.member.color} size={28} />
              <span style={{ flex: 1, font: '500 16px/22px var(--font-sans)' }}>{v.title}</span>
              <span style={{ font: '500 13px/18px var(--font-sans)', color: 'var(--text-muted)' }}>{v.when}</span>
            </div>
            {diffFields.map(f => (
              <div key={f.key} style={{ display: 'flex', gap: 12, font: '400 15px/22px var(--font-sans)', color: 'var(--text-secondary)', marginTop: 8 }}>
                <span style={{ flex: 1 }}>{f.label}</span><span style={{ color: 'var(--text-primary)' }}>{v.fields[f.key]}</span>
              </div>
            ))}
            <Button variant="secondary" size="md" onClick={() => onPick?.(v.id)} style={{ marginTop: 10 }}>Quedarme con {v.shortLabel}</Button>
          </Card>
        ))}
      </div>
      <Button variant="primary" size="lg" onClick={onPickNewest} style={{ marginTop: 16 }}>Quedarme con la más nueva</Button>
    </div>
  );
}
