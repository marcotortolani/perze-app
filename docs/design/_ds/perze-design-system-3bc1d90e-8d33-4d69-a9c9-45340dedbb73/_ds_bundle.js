/* @ds-bundle: {"format":4,"namespace":"APPFinanzasDesignSystem_3bc1d9","components":[{"name":"BarChart","sourcePath":"components/charts/BarChart.jsx"},{"name":"SeriesLegend","sourcePath":"components/charts/SeriesLegend.jsx"},{"name":"Sparkline","sourcePath":"components/charts/Sparkline.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"ListRow","sourcePath":"components/core/ListRow.jsx"},{"name":"SegmentedControl","sourcePath":"components/core/SegmentedControl.jsx"},{"name":"Sheet","sourcePath":"components/core/Sheet.jsx"},{"name":"StatusBadge","sourcePath":"components/core/StatusBadge.jsx"},{"name":"Switch","sourcePath":"components/core/Switch.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"ErrorState","sourcePath":"components/feedback/ErrorState.jsx"},{"name":"OfflineBanner","sourcePath":"components/feedback/OfflineBanner.jsx"},{"name":"Skeleton","sourcePath":"components/feedback/Skeleton.jsx"},{"name":"SkeletonRow","sourcePath":"components/feedback/Skeleton.jsx"},{"name":"UndoToast","sourcePath":"components/feedback/UndoToast.jsx"},{"name":"AccountCarousel","sourcePath":"components/finance/AccountCarousel.jsx"},{"name":"BudgetRing","sourcePath":"components/finance/BudgetRing.jsx"},{"name":"CategoryBubble","sourcePath":"components/finance/CategoryBubble.jsx"},{"name":"DateStrip","sourcePath":"components/finance/DateStrip.jsx"},{"name":"InsightCard","sourcePath":"components/finance/InsightCard.jsx"},{"name":"ScopeSwitcher","sourcePath":"components/finance/ScopeSwitcher.jsx"},{"name":"SplitBar","sourcePath":"components/finance/SplitBar.jsx"},{"name":"StatTile","sourcePath":"components/finance/StatTile.jsx"},{"name":"TransactionRow","sourcePath":"components/finance/TransactionRow.jsx"},{"name":"Amount","sourcePath":"components/money/Amount.jsx"},{"name":"AmountScrubber","sourcePath":"components/money/AmountScrubber.jsx"},{"name":"CurrencyChip","sourcePath":"components/money/CurrencyChip.jsx"},{"name":"FxEditor","sourcePath":"components/money/FxEditor.jsx"},{"name":"Keypad","sourcePath":"components/money/Keypad.jsx"},{"name":"PrivacyBlur","sourcePath":"components/money/PrivacyBlur.jsx"},{"name":"AppHeader","sourcePath":"components/nav/AppHeader.jsx"},{"name":"SyncDot","sourcePath":"components/nav/SyncDot.jsx"},{"name":"TabBar","sourcePath":"components/nav/TabBar.jsx"}],"sourceHashes":{"components/charts/BarChart.jsx":"4caea8a6edee","components/charts/SeriesLegend.jsx":"8ecbec9b5e95","components/charts/Sparkline.jsx":"fc3382e26233","components/core/Button.jsx":"653956202462","components/core/Card.jsx":"b3ca8dc94b18","components/core/Chip.jsx":"9993bda7abe4","components/core/Icon.jsx":"c5f3b0c8c460","components/core/Input.jsx":"d293a0772bc0","components/core/ListRow.jsx":"981831dccbee","components/core/SegmentedControl.jsx":"8c7dc4cd2b3a","components/core/Sheet.jsx":"5b6bcf7fe5ea","components/core/StatusBadge.jsx":"7cb44f5551ef","components/core/Switch.jsx":"b84bc56a3131","components/feedback/EmptyState.jsx":"2a31b0c19a35","components/feedback/ErrorState.jsx":"340f8b64e0e7","components/feedback/OfflineBanner.jsx":"f6a1cc0d7b73","components/feedback/Skeleton.jsx":"4854ada7dc1a","components/feedback/UndoToast.jsx":"ee836a9822c5","components/finance/AccountCarousel.jsx":"5d6c868e9059","components/finance/BudgetRing.jsx":"3c1e99f196aa","components/finance/CategoryBubble.jsx":"61bbdccf87c3","components/finance/DateStrip.jsx":"89e7b4155c37","components/finance/InsightCard.jsx":"796a1bf61a0e","components/finance/ScopeSwitcher.jsx":"3a19c7bbc130","components/finance/SplitBar.jsx":"0fb3fce3024c","components/finance/StatTile.jsx":"e21926108444","components/finance/TransactionRow.jsx":"861906bb2fdc","components/money/Amount.jsx":"ea49fc3b4f95","components/money/AmountScrubber.jsx":"326cb738c7cc","components/money/CurrencyChip.jsx":"8937bb150cbc","components/money/FxEditor.jsx":"6be9b8d7b119","components/money/Keypad.jsx":"b68d89450ae1","components/money/PrivacyBlur.jsx":"272816346eb4","components/nav/AppHeader.jsx":"cf1cacbb4830","components/nav/SyncDot.jsx":"6559d47663bc","components/nav/TabBar.jsx":"fd69c1ad5072","ui_kits/app/AnalyticsScreen.jsx":"21660bb2df57","ui_kits/app/AppData.jsx":"f93ec1b2e406","ui_kits/app/AppearanceScreen.jsx":"0374b5862452","ui_kits/app/BudgetScreen.jsx":"45a6f7065847","ui_kits/app/CushionScreen.jsx":"5fa7ada7dced","ui_kits/app/HomeScreen.jsx":"7ad1f1908376","ui_kits/app/MoreScreen.jsx":"58117a4aecf4","ui_kits/app/MovementsScreen.jsx":"aecb61cbbc0a","ui_kits/app/QuickAddScreen.jsx":"2df4de6aca06"},"inlinedExternals":[],"unexposedExports":[{"name":"formatAmount","sourcePath":"components/money/Amount.jsx"},{"name":"iconPaths","sourcePath":"components/core/Icon.jsx"}]} */

(() => {

const __ds_ns = (window.APPFinanzasDesignSystem_3bc1d9 = window.APPFinanzasDesignSystem_3bc1d9 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/charts/BarChart.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function BarChart({
  data = [],
  height = 130,
  color = 'var(--data-1)',
  gridLines = 3,
  labelExtremes = true,
  style,
  ...rest
}) {
  const w = 320,
    h = height,
    base = h - 30;
  const max = Math.max(...data.map(d => d.value), 1);
  const slot = w / Math.max(data.length, 1);
  const barW = Math.min(30, slot - 9);
  const maxIdx = data.findIndex(d => d.value === max);
  return /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: `0 0 ${w} ${h}`,
    style: {
      width: '100%',
      height: 'auto',
      display: 'block',
      ...style
    }
  }, rest), Array.from({
    length: gridLines
  }, (_, i) => {
    const y = base - (i + 1) / (gridLines + 1) * base;
    return /*#__PURE__*/React.createElement("line", {
      key: i,
      x1: "0",
      y1: y,
      x2: w,
      y2: y,
      stroke: "var(--gridline)",
      strokeWidth: "1"
    });
  }), data.map((d, i) => {
    const bh = d.value / max * (base - 20);
    return /*#__PURE__*/React.createElement("rect", {
      key: d.label,
      x: i * slot + (slot - barW) / 2,
      y: base - bh,
      width: barW,
      height: bh,
      rx: "var(--bar-radius)",
      fill: d.color ?? color
    });
  }), /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: base,
    x2: w,
    y2: base,
    stroke: "var(--border)",
    strokeWidth: "1"
  }), data.map((d, i) => /*#__PURE__*/React.createElement("text", {
    key: d.label,
    x: i * slot + slot / 2,
    y: base + 14,
    fontSize: "9",
    fill: "var(--text-muted)",
    textAnchor: "middle",
    fontFamily: "var(--font-sans)"
  }, d.label)), labelExtremes && data[maxIdx] ? /*#__PURE__*/React.createElement("text", {
    x: maxIdx * slot + slot / 2,
    y: base - max / max * (base - 20) - 6,
    fontSize: "10",
    fill: "var(--text-secondary)",
    textAnchor: "middle",
    fontFamily: "var(--font-mono)"
  }, data[maxIdx].display ?? '') : null);
}
Object.assign(__ds_scope, { BarChart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/charts/BarChart.jsx", error: String((e && e.message) || e) }); }

// components/charts/SeriesLegend.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SLOTS = ['var(--data-1)', 'var(--data-2)', 'var(--data-3)', 'var(--data-4)', 'var(--data-5)', 'var(--data-other)'];
function SeriesLegend({
  series = [],
  layout = 'table',
  dividers = false,
  style,
  ...rest
}) {
  const line = dividers ? '1px solid var(--border)' : 'none';
  if (layout === 'inline') {
    return /*#__PURE__*/React.createElement("div", _extends({
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 16px',
        ...style
      }
    }, rest), series.map((s, i) => /*#__PURE__*/React.createElement("span", {
      key: s.label,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontSize: 13,
        color: 'var(--text-secondary)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 10,
        height: 10,
        borderRadius: 3,
        background: s.color ?? SLOTS[i]
      }
    }), s.label)));
  }
  return /*#__PURE__*/React.createElement("table", _extends({
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("tbody", null, series.map((s, i) => /*#__PURE__*/React.createElement("tr", {
    key: s.label
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 0',
      borderTop: line,
      color: 'var(--text-primary)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: s.color ?? SLOTS[i],
      display: 'inline-block',
      marginRight: 7,
      verticalAlign: -1
    }
  }), s.label), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 0',
      borderTop: line,
      textAlign: 'right',
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--text-secondary)'
    }
  }, s.value)))));
}
Object.assign(__ds_scope, { SeriesLegend });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/charts/SeriesLegend.jsx", error: String((e && e.message) || e) }); }

// components/charts/Sparkline.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Sparkline({
  values = [],
  width = 96,
  height = 28,
  color = 'var(--data-1)',
  style,
  ...rest
}) {
  const max = Math.max(...values, 1),
    min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [i / Math.max(values.length - 1, 1) * width, height - (v - min) / span * (height - 4) - 2]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return /*#__PURE__*/React.createElement("svg", _extends({
    width: width,
    height: height,
    viewBox: `0 0 ${width} ${height}`,
    style: {
      display: 'block',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("path", {
    d: d,
    fill: "none",
    stroke: color,
    strokeWidth: "var(--line-width)",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}
Object.assign(__ds_scope, { Sparkline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/charts/Sparkline.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Card({
  surface = 1,
  bordered = false,
  padding = 20,
  radius,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: `var(--surface-${surface})`,
      borderRadius: radius ?? 'var(--radius-card)',
      padding,
      border: bordered ? '1px solid var(--border)' : 'none',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Line icons, 24x24 viewBox, 1.5px stroke, round caps — Lucide geometry.
   The paths used across the brand's own style tile are reproduced verbatim;
   the rest are the matching Lucide glyphs for the flows the system covers. */
const iconPaths = {
  cart: 'M2 3h2.2l2.5 11.5h10.6l2.4-8H6.1M8 20a1.5 1.5 0 103 0 1.5 1.5 0 10-3 0M15 20a1.5 1.5 0 103 0 1.5 1.5 0 10-3 0',
  'arrow-up': 'M12 19V5M5 12l7-7 7 7',
  'arrow-down': 'M12 5v14M19 12l-7 7-7-7',
  food: 'M6 2v20M3 2v6a3 3 0 006 0V2M17.5 2c-1.2 2-1.8 3.9-1.8 6 0 1.6.7 2.6 1.8 2.6s1.8-1 1.8-2.6c0-2.1-.6-4-1.8-6M17.5 11.5V22',
  car: 'M5 17a2 2 0 104 0 2 2 0 10-4 0M15 17a2 2 0 104 0 2 2 0 10-4 0M3 17V9l3-4h9l3 5h3v7',
  home: 'M3 10l9-7 9 7v10a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  check: 'M20 6L9 17l-5-5',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  close: 'M18 6L6 18M6 6l12 12',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18M12 7v5l3 2',
  backspace: 'M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2zM18 9l-6 6M12 9l6 6',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14M20 20l-4.2-4.2',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  chart: 'M3 3v18h18M7 15v3M12 9v9M17 5v13',
  more: 'M4 6h16M4 12h16M4 18h16',
  wallet: 'M3 8a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 10h18M16 14h2',
  coffee: 'M4 8h13v5a5 5 0 01-5 5H9a5 5 0 01-5-5zM17 9h1.5a2.5 2.5 0 010 5H17M3 21h15',
  fuel: 'M3 21V5a2 2 0 012-2h6a2 2 0 012 2v16M3 12h10M13 8h3l3 3v8a2 2 0 01-4 0v-6h-2',
  chevron: 'M9 6l6 6-6 6',
  'chevron-left': 'M15 6l-6 6 6 6',
  'chevron-down': 'M6 9l6 6 6-6',
  calendar: 'M3 9h18M7 3v4M17 3v4M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7M12 9a3 3 0 100 6 3 3 0 000-6',
  'eye-off': 'M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M6.7 6.7C4 8.3 2 12 2 12s3.6 7 10 7c2 0 3.7-.5 5.2-1.4M21.9 12.9C22 12.6 22 12 22 12s-3.6-7-10-7',
  refresh: 'M21 12a9 9 0 11-3-6.7M21 4v5h-5',
  users: 'M16 20v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 4a4 4 0 100 8 4 4 0 000-8M22 20v-2a4 4 0 00-3-3.9M16 4.1a4 4 0 010 7.8',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  target: 'M12 3a9 9 0 100 18 9 9 0 000-18M12 8a4 4 0 100 8 4 4 0 000-8M12 11a1 1 0 100 2 1 1 0 000-2',
  filter: 'M3 5h18l-7 8v6l-4-2v-4z',
  edit: 'M4 20h4L20 8a2.8 2.8 0 00-4-4L4 16z',
  trash: 'M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13',
  wifi: 'M2 8.8a16 16 0 0120 0M5 12.5a11 11 0 0114 0M8.5 16a6 6 0 017 0M12 20h.01',
  bank: 'M3 21h18M4 21V10M20 21V10M12 3l9 5H3z',
  invest: 'M4 20V9M10 20V4M16 20v-7M22 20V11',
  undo: 'M9 14L4 9l5-5M4 9h9a7 7 0 010 14H8',
  mic: 'M12 2a3 3 0 013 3v6a3 3 0 01-6 0V5a3 3 0 013-3M19 10v1a7 7 0 01-14 0v-1M12 19v3M8.5 22h7',
  camera: 'M3 8.5A2 2 0 015 6.5h2.4l1.4-2h6.4l1.4 2H19a2 2 0 012 2V18a2 2 0 01-2 2H5a2 2 0 01-2-2zM12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7',
  pharmacy: 'M10.5 20.5a4.95 4.95 0 01-7-7l6-6a4.95 4.95 0 017 7zM8.5 8.5l7 7',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 01-2.83 0l-7-7A2 2 0 013 12.2V4a1 1 0 011-1h8.2a2 2 0 011.4.58l7 7a2 2 0 010 2.82M7.5 7.5h.01'
};
function Icon({
  name,
  size = 20,
  strokeWidth = 1.5,
  color = 'currentColor',
  style,
  ...rest
}) {
  const d = iconPaths[name];
  if (!d) return null;
  return /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: color,
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    style: {
      display: 'block',
      flexShrink: 0,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("path", {
    d: d
  }));
}
Object.assign(__ds_scope, { iconPaths, Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const base = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-2)',
  width: '100%',
  border: 0,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  fontWeight: 600,
  fontSize: 17,
  lineHeight: 1,
  borderRadius: 'var(--radius-button)',
  transition: 'transform var(--duration-fast) var(--ease-spring-snappy), background var(--duration-fast) linear'
};
const variants = {
  primary: {
    background: 'var(--primary-fill)',
    color: 'var(--primary-on-fill)'
  },
  secondary: {
    background: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--primary-ink)'
  },
  danger: {
    background: 'transparent',
    color: 'var(--critical)',
    border: '1px solid var(--border)'
  }
};
function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  disabled,
  fullWidth = true,
  onClick,
  style,
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  const height = size === 'lg' ? 'var(--primary-button-height-lg)' : size === 'sm' ? 44 : 'var(--primary-button-height)';
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onClick: onClick,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      ...base,
      ...variants[variant],
      height,
      width: fullWidth ? '100%' : 'auto',
      padding: fullWidth ? 0 : '0 20px',
      fontSize: size === 'sm' ? 15 : 17,
      opacity: disabled ? 0.4 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
      transform: pressed ? 'scale(var(--press-scale))' : 'scale(1)',
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === 'sm' ? 18 : 20,
    strokeWidth: 1.75
  }) : null, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Chip({
  children,
  selected = false,
  icon,
  onClick,
  style,
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  const interactive = typeof onClick === 'function';
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    disabled: !interactive && undefined,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 36,
      padding: '0 14px',
      borderRadius: 'var(--radius-chip)',
      fontFamily: 'var(--font-sans)',
      fontWeight: 500,
      fontSize: 13,
      lineHeight: 1,
      cursor: interactive ? 'pointer' : 'default',
      background: selected ? 'var(--primary-fill)' : 'var(--surface-2)',
      color: selected ? 'var(--primary-on-fill)' : 'var(--text-secondary)',
      border: selected ? '1px solid transparent' : '1px solid var(--border)',
      transform: pressed ? 'scale(var(--press-scale))' : 'scale(1)',
      transition: 'transform var(--duration-fast) var(--ease-spring-snappy), background var(--duration-fast) linear',
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 15,
    strokeWidth: 1.75
  }) : null, children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  label,
  hint,
  invalid = false,
  multiline = false,
  style,
  ...rest
}) {
  const Tag = multiline ? 'textarea' : 'input';
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block'
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontFamily: 'var(--font-sans)',
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--text-secondary)',
      marginBottom: 8
    }
  }, label) : null, /*#__PURE__*/React.createElement(Tag, _extends({}, rest, {
    style: {
      width: '100%',
      minHeight: multiline ? 88 : 48,
      padding: multiline ? '12px 14px' : '0 14px',
      background: 'var(--surface-3)',
      color: 'var(--text-primary)',
      border: `1px solid ${invalid ? 'var(--critical)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-input)',
      fontFamily: 'var(--font-sans)',
      fontSize: 16,
      lineHeight: '24px',
      outline: 'none',
      resize: multiline ? 'vertical' : undefined,
      ...style
    }
  })), hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 12,
      color: invalid ? 'var(--critical)' : 'var(--text-muted)',
      marginTop: 6
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/ListRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function ListRow({
  label,
  meta,
  value,
  icon,
  variant = 'navigation',
  chevron,
  right,
  destructive = false,
  disabled = false,
  onClick,
  style,
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  const showChevron = chevron ?? variant === 'navigation';
  const interactive = !!onClick && !disabled;
  /* Con un control propio a la derecha (Switch) la fila NO puede ser <button>: un botón no
     puede contener contenido interactivo. En ese caso la fila es un div clickeable y el
     control anidado es el que porta el rol accesible. */
  const asButton = interactive && !right;
  const Tag = asButton ? 'button' : 'div';
  const labelColor = disabled ? 'var(--text-muted)' : destructive ? 'var(--critical)' : variant === 'action' ? 'var(--primary-ink)' : 'var(--text-primary)';
  return /*#__PURE__*/React.createElement(Tag, _extends({
    type: asButton ? 'button' : undefined,
    onClick: interactive ? onClick : undefined,
    disabled: asButton ? disabled || undefined : undefined,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      width: '100%',
      minHeight: 56,
      padding: '8px 0',
      background: 'none',
      border: 0,
      textAlign: 'left',
      cursor: interactive ? 'pointer' : 'default',
      opacity: disabled ? 0.4 : 1,
      transform: pressed && interactive ? 'scale(var(--press-scale))' : 'scale(1)',
      transition: 'transform var(--duration-fast) var(--ease-spring-snappy)',
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 12,
      background: 'var(--surface-2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 19,
    color: destructive ? 'var(--critical)' : 'var(--text-secondary)'
  })) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: '400 16px/22px var(--font-sans)',
      color: labelColor,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, label), meta ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: '500 13px/18px var(--font-sans)',
      color: 'var(--text-muted)',
      marginTop: 1
    }
  }, meta) : null), value != null ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 16px/22px var(--font-sans)',
      color: 'var(--text-secondary)',
      flexShrink: 0
    }
  }, value) : null, right, showChevron ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron",
    size: 18,
    color: "var(--text-muted)",
    style: {
      flexShrink: 0
    }
  }) : null);
}
Object.assign(__ds_scope, { ListRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ListRow.jsx", error: String((e && e.message) || e) }); }

// components/core/SegmentedControl.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Selección por SUPERFICIE, no por color de marca: el segmento activo usa superficie 3 sobre
   superficie 1. Mismo precedente que la selección de cuenta en Inicio. Así un segmentado
   no gasta el único violeta que el presupuesto de ruido permite por pantalla. */
function SegmentedControl({
  options = [],
  value,
  onChange,
  size = 'md',
  emphasis = 'surface',
  style,
  ...rest
}) {
  const brand = emphasis === 'brand';
  const active = value ?? (typeof options[0] === 'string' ? options[0] : options[0]?.id);
  /* El target es el segmento, no el contenedor: 44px reales en md, 36 en sm. */
  const height = size === 'sm' ? 36 : 44;
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    style: {
      display: 'inline-flex',
      gap: 2,
      padding: 3,
      borderRadius: 'var(--radius-chip)',
      background: 'var(--surface-2)',
      ...style
    }
  }, rest), options.map(o => {
    const id = typeof o === 'string' ? o : o.id;
    const label = typeof o === 'string' ? o : o.label;
    const icon = typeof o === 'string' ? undefined : o.icon;
    const on = id === active;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      role: "tab",
      "aria-selected": on,
      type: "button",
      onClick: () => onChange?.(id),
      style: {
        height,
        minWidth: 44,
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 'var(--radius-chip)',
        border: 0,
        cursor: 'pointer',
        background: on ? brand ? 'var(--primary-fill)' : 'var(--surface-3)' : 'transparent',
        color: on ? brand ? 'var(--primary-on-fill)' : 'var(--text-primary)' : 'var(--text-muted)',
        fontFamily: 'var(--font-sans)',
        fontSize: size === 'sm' ? 13 : 15,
        fontWeight: 500,
        lineHeight: 1,
        transition: 'background var(--duration-fast) var(--ease-spring-snappy), color var(--duration-fast) linear'
      }
    }, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: icon,
      size: 16,
      strokeWidth: 1.75
    }) : null, label);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/core/Sheet.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Sheet({
  open = true,
  title,
  children,
  onClose,
  height = 'auto',
  style,
  ...rest
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'var(--scrim)',
      transition: 'opacity var(--duration-slow) var(--ease-spring-soft)'
    }
  }), /*#__PURE__*/React.createElement("section", _extends({
    style: {
      position: 'relative',
      background: 'var(--surface-2)',
      borderRadius: 'var(--radius-sheet) var(--radius-sheet) 0 0',
      boxShadow: 'var(--shadow-sheet)',
      padding: '10px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))',
      height,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 999,
      background: 'var(--border)',
      margin: '0 auto 14px'
    }
  }), title ? /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: '0 0 16px',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-title-size)',
      lineHeight: 'var(--text-title-line)',
      fontWeight: 600,
      letterSpacing: 'var(--text-title-track)'
    }
  }, title) : null, children));
}
Object.assign(__ds_scope, { Sheet });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Sheet.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Cuándo va cada nivel:
   neutral  — falta algo que se resuelve solo (no es un problema, es un dato que todavía no llegó)
   warning  — prestá atención
   serious  — algo cambió y te conviene mirarlo
   critical — algo está mal ahora */
const map = {
  neutral: {
    color: 'var(--text-secondary)',
    background: 'var(--surface-2)',
    icon: 'clock'
  },
  good: {
    color: 'var(--good)',
    icon: 'check'
  },
  warning: {
    color: 'var(--warning)',
    icon: 'alert'
  },
  serious: {
    color: 'var(--serious)',
    icon: 'arrow-up'
  },
  critical: {
    color: 'var(--critical)',
    icon: 'close'
  }
};
function StatusBadge({
  status = 'good',
  children,
  icon,
  style,
  ...rest
}) {
  const s = map[status];
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '4px 9px',
      borderRadius: 'var(--radius-chip)',
      fontFamily: 'var(--font-sans)',
      fontWeight: 500,
      fontSize: 12,
      lineHeight: 1.4,
      color: s.color,
      background: s.background ?? `color-mix(in srgb, ${s.color} 15%, transparent)`,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon || s.icon,
    size: 13,
    strokeWidth: 2.5
  }), children);
}
Object.assign(__ds_scope, { StatusBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusBadge.jsx", error: String((e && e.message) || e) }); }

// components/core/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
  id,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const control = /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    role: "switch",
    "aria-checked": checked,
    "aria-labelledby": id,
    disabled: disabled,
    onClick: e => {
      e.stopPropagation();
      if (navigator.vibrate) navigator.vibrate(12);
      onChange?.(!checked);
    },
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: 46,
      height: 28,
      borderRadius: 999,
      padding: 3,
      flexShrink: 0,
      border: 0,
      cursor: disabled ? 'default' : 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      background: checked ? 'var(--primary-fill)' : 'var(--surface-3)',
      opacity: disabled ? 0.4 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
      outline: focus ? '2px solid var(--primary-ink)' : 'none',
      outlineOffset: 2,
      transition: 'background var(--duration-fast) var(--ease-spring-snappy)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 22,
      borderRadius: 999,
      background: checked ? 'var(--primary-on-fill)' : 'var(--text-muted)',
      transform: checked ? 'translateX(18px)' : 'translateX(0)',
      transition: 'transform var(--duration-fast) var(--ease-spring-snappy)'
    }
  }));
  if (!label) return control;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 12,
      minHeight: 'var(--touch-min)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    id: id,
    style: {
      font: '400 16px/22px var(--font-sans)',
      color: disabled ? 'var(--text-muted)' : 'var(--text-primary)'
    }
  }, label), control);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Switch.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function EmptyState({
  icon = 'wallet',
  message,
  actionLabel,
  onAction,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 16,
      padding: '48px var(--screen-padding)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 32,
    strokeWidth: 1.25,
    color: "var(--text-muted)"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15,
      lineHeight: '22px',
      color: 'var(--text-secondary)',
      maxWidth: '28ch',
      textWrap: 'pretty'
    }
  }, message), actionLabel ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    fullWidth: false,
    size: "sm",
    onClick: onAction
  }, actionLabel) : null);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ErrorState.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function ErrorState({
  what,
  next,
  onRetry,
  retryLabel = 'Reintentar',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 12,
      padding: '40px var(--screen-padding)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "alert",
    size: 28,
    strokeWidth: 1.5,
    color: "var(--critical)"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 16,
      lineHeight: '22px',
      fontWeight: 500,
      color: 'var(--text-primary)',
      maxWidth: '30ch',
      textWrap: 'pretty'
    }
  }, what), next ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 14,
      lineHeight: '20px',
      color: 'var(--text-secondary)',
      maxWidth: '32ch',
      textWrap: 'pretty'
    }
  }, next) : null, onRetry ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    fullWidth: false,
    size: "sm",
    icon: "refresh",
    onClick: onRetry,
    style: {
      marginTop: 4
    }
  }, retryLabel) : null);
}
Object.assign(__ds_scope, { ErrorState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ErrorState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/OfflineBanner.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function OfflineBanner({
  pending = 0,
  status = 'warning',
  message,
  style,
  ...rest
}) {
  const color = status === 'critical' ? 'var(--critical)' : 'var(--warning)';
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "status",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px var(--screen-padding)',
      background: `color-mix(in srgb, ${color} 12%, transparent)`,
      color,
      fontFamily: 'var(--font-sans)',
      fontSize: 13,
      fontWeight: 500,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: status === 'critical' ? 'alert' : 'wifi',
    size: 15,
    strokeWidth: 2
  }), /*#__PURE__*/React.createElement("span", null, message ?? 'Sin conexión — seguís operando normalmente.'), pending > 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, pending, " pendientes") : null);
}
Object.assign(__ds_scope, { OfflineBanner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/OfflineBanner.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Skeleton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Skeleton({
  width = '100%',
  height = 16,
  radius = 8,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'block',
      width,
      height,
      borderRadius: radius,
      background: 'var(--surface-2)',
      animation: 'ds-skel 1.4s ease-in-out infinite',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("style", null, '@keyframes ds-skel{0%,100%{opacity:1}50%{opacity:.55}}'));
}
function SkeletonRow({
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '11px 0',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(Skeleton, {
    width: 40,
    height: 40,
    radius: 12
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Skeleton, {
    width: "52%",
    height: 14
  }), /*#__PURE__*/React.createElement(Skeleton, {
    width: "34%",
    height: 11
  })), /*#__PURE__*/React.createElement(Skeleton, {
    width: 64,
    height: 14
  }));
}
Object.assign(__ds_scope, { Skeleton, SkeletonRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/UndoToast.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function UndoToast({
  message,
  onUndo,
  onDismiss,
  duration = 5000,
  visible = true,
  style,
  ...rest
}) {
  React.useEffect(() => {
    if (!visible || !onDismiss) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [visible, duration, onDismiss]);
  if (!visible) return null;
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "status",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'var(--surface-3)',
      color: 'var(--text-primary)',
      borderRadius: 'var(--radius-button)',
      padding: '12px 12px 12px 16px',
      boxShadow: 'var(--shadow-sheet)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 16,
    strokeWidth: 2.2,
    color: "var(--text-secondary)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 14,
      lineHeight: '20px'
    }
  }, message), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onUndo,
    style: {
      minHeight: 44,
      background: 'none',
      border: 0,
      cursor: 'pointer',
      color: 'var(--primary-ink)',
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      fontWeight: 500,
      padding: '0 4px'
    }
  }, "Deshacer"));
}
Object.assign(__ds_scope, { UndoToast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/UndoToast.jsx", error: String((e && e.message) || e) }); }

// components/finance/BudgetRing.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function BudgetRing({
  progress = 0,
  size = 88,
  stroke = 8,
  label,
  sublabel,
  style,
  ...rest
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const over = progress > 1;
  const main = Math.min(1, progress);
  const overArc = over ? Math.min(1, progress - 1) : 0;
  const color = over ? 'var(--critical)' : progress >= 0.8 ? 'var(--warning)' : 'var(--primary-ink)';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: size,
      height: size
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    style: {
      transform: 'rotate(-90deg)'
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "var(--surface-3)",
    strokeWidth: stroke
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: over ? 'var(--text-muted)' : color,
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeDasharray: c,
    strokeDashoffset: c * (1 - main),
    style: {
      transition: 'stroke-dashoffset var(--duration-slow) var(--ease-spring-soft)'
    }
  }), over ? /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "var(--critical)",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeDasharray: c,
    strokeDashoffset: c * (1 - overArc)
  }) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2
    }
  }, over ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "alert",
    size: 15,
    strokeWidth: 2.2,
    color: "var(--critical)"
  }) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 16,
      fontWeight: 600,
      color: over ? 'var(--critical)' : 'var(--text-primary)'
    }
  }, Math.round(progress * 100), "%"))), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--text-primary)'
    }
  }, label) : null, sublabel ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, sublabel) : null);
}
Object.assign(__ds_scope, { BudgetRing });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/BudgetRing.jsx", error: String((e && e.message) || e) }); }

// components/finance/CategoryBubble.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function CategoryBubble({
  icon = 'cart',
  label,
  selected = false,
  onClick,
  style,
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      background: 'none',
      border: 0,
      padding: 0,
      cursor: 'pointer',
      transform: pressed ? 'scale(var(--press-scale))' : 'scale(1)',
      transition: 'transform var(--duration-fast) var(--ease-spring-snappy)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 64,
      height: 64,
      borderRadius: 999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: selected ? 'var(--surface-3)' : 'var(--surface-2)',
      border: `2px solid ${selected ? 'var(--border)' : 'transparent'}`,
      transform: selected ? 'scale(1.04)' : 'scale(1)',
      transition: 'border-color var(--duration-fast) var(--ease-spring-snappy), background var(--duration-fast) linear, transform var(--duration-fast) var(--ease-spring-snappy)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 26,
    color: selected ? 'var(--text-primary)' : 'var(--text-secondary)'
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 12,
      fontWeight: 500,
      color: selected ? 'var(--text-primary)' : 'var(--text-secondary)'
    }
  }, label));
}
Object.assign(__ds_scope, { CategoryBubble });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/CategoryBubble.jsx", error: String((e && e.message) || e) }); }

// components/finance/DateStrip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const DOW = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
function DateStrip({
  days = [],
  value,
  onChange,
  onLongPress,
  style,
  ...rest
}) {
  const timer = React.useRef(null);
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      gap: 8,
      overflowX: 'auto',
      scrollSnapType: 'x mandatory',
      scrollbarWidth: 'none',
      ...style
    }
  }, rest), days.map(d => {
    const iso = typeof d === 'string' ? d : d.date;
    const named = typeof d === 'object' ? d.label : undefined;
    const dt = new Date(iso + 'T00:00:00');
    const on = iso === value;
    return /*#__PURE__*/React.createElement("button", {
      key: iso,
      type: "button",
      onClick: () => onChange?.(iso),
      onPointerDown: () => {
        timer.current = setTimeout(() => onLongPress?.(iso), 500);
      },
      onPointerUp: () => clearTimeout(timer.current),
      onPointerLeave: () => clearTimeout(timer.current),
      style: {
        scrollSnapAlign: 'center',
        flex: '0 0 auto',
        minWidth: 52,
        height: 64,
        borderRadius: 'var(--radius-input)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        cursor: 'pointer',
        background: on ? 'var(--surface-3)' : 'var(--surface-2)',
        border: 0,
        color: 'var(--text-secondary)',
        transition: 'background var(--duration-fast) var(--ease-spring-snappy)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: named ? 600 : 500,
        letterSpacing: '.04em',
        textTransform: 'uppercase',
        color: named ? 'var(--text-primary)' : on ? 'var(--text-secondary)' : 'var(--text-muted)'
      }
    }, named ?? DOW[dt.getDay()]), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        fontSize: 17,
        fontWeight: on ? 600 : 500,
        color: on ? 'var(--text-primary)' : 'var(--text-secondary)'
      }
    }, dt.getDate()));
  }));
}
Object.assign(__ds_scope, { DateStrip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/DateStrip.jsx", error: String((e && e.message) || e) }); }

// components/finance/InsightCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const COLORS = {
  good: 'var(--good)',
  warning: 'var(--warning)',
  serious: 'var(--serious)',
  critical: 'var(--critical)',
  neutral: 'var(--text-secondary)'
};
function InsightCard({
  status = 'neutral',
  icon,
  text,
  actionLabel,
  onAction,
  sparkline,
  onDismiss,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--surface-1)',
      borderRadius: 'var(--radius-card)',
      padding: 16,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon ?? (status === 'critical' ? 'alert' : status === 'good' ? 'check' : 'trend'),
    size: 20,
    strokeWidth: 1.8,
    color: COLORS[status],
    style: {
      marginTop: 2
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      lineHeight: '21px',
      color: 'var(--text-primary)',
      textWrap: 'pretty'
    }
  }, text), sparkline ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, sparkline) : null, actionLabel ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onAction,
    style: {
      marginTop: 10,
      background: 'none',
      border: 0,
      padding: 0,
      cursor: 'pointer',
      color: 'var(--primary-ink)',
      fontFamily: 'var(--font-sans)',
      fontSize: 13,
      fontWeight: 500
    }
  }, actionLabel) : null), onDismiss ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onDismiss,
    "aria-label": "Descartar",
    style: {
      background: 'none',
      border: 0,
      padding: 4,
      margin: -4,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "close",
    size: 16,
    color: "var(--text-muted)"
  })) : null);
}
Object.assign(__ds_scope, { InsightCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/InsightCard.jsx", error: String((e && e.message) || e) }); }

// components/finance/ScopeSwitcher.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Alias de SegmentedControl, no un segundo segmentado: el scope es identidad de datos,
   así que es el único caso que usa relleno de marca. */
function ScopeSwitcher({
  options = ['Personal', 'Compartido', 'Todo'],
  value,
  onChange,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.SegmentedControl, _extends({
    options: options,
    value: value,
    onChange: onChange,
    size: "sm",
    emphasis: "brand",
    style: style
  }, rest));
}
Object.assign(__ds_scope, { ScopeSwitcher });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/ScopeSwitcher.jsx", error: String((e && e.message) || e) }); }

// components/finance/SplitBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SLOTS = ['var(--data-1)', 'var(--data-2)', 'var(--data-3)', 'var(--data-4)', 'var(--data-5)'];
function SplitBar({
  parts = [],
  onChange,
  height = 12,
  style,
  ...rest
}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const barRef = React.useRef(null);
  const dragIdx = React.useRef(null);
  const move = e => {
    if (dragIdx.current == null || !onChange) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const i = dragIdx.current;
    const before = parts.slice(0, i).reduce((s, p) => s + p.value, 0) / total;
    const pairShare = (parts[i].value + parts[i + 1].value) / total;
    const next = Math.min(pairShare, Math.max(0, ratio - before));
    const copy = parts.map(p => ({
      ...p
    }));
    copy[i].value = Math.round(next * total);
    copy[i + 1].value = Math.round((pairShare - next) * total);
    onChange(copy);
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: style
  }, rest), /*#__PURE__*/React.createElement("div", {
    ref: barRef,
    onPointerMove: move,
    onPointerUp: () => {
      dragIdx.current = null;
    },
    style: {
      display: 'flex',
      gap: 2,
      height,
      borderRadius: 999,
      overflow: 'hidden',
      touchAction: 'none'
    }
  }, parts.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: p.label,
    style: {
      width: `${p.value / total * 100}%`,
      background: p.color ?? SLOTS[i % 5],
      cursor: i < parts.length - 1 && onChange ? 'ew-resize' : 'default'
    },
    onPointerDown: () => {
      if (i < parts.length - 1) dragIdx.current = i;
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px 16px',
      marginTop: 12
    }
  }, parts.map((p, i) => /*#__PURE__*/React.createElement("span", {
    key: p.label,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      fontSize: 13,
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: p.color ?? SLOTS[i % 5]
    }
  }), p.label, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--text-primary)'
    }
  }, Math.round(p.value / total * 100), "%")))));
}
Object.assign(__ds_scope, { SplitBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/SplitBar.jsx", error: String((e && e.message) || e) }); }

// components/finance/StatTile.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function StatTile({
  label,
  value,
  delta,
  deltaPolarity = 'neutral',
  deltaNote,
  style,
  ...rest
}) {
  const color = deltaPolarity === 'positive' ? 'var(--money-positive)' : deltaPolarity === 'negative' ? 'var(--money-negative-emphasis)' : 'var(--text-secondary)';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: style
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 11,
      lineHeight: '16px',
      fontWeight: 600,
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 30,
      lineHeight: '36px',
      fontWeight: 600,
      letterSpacing: '-.015em',
      marginTop: 6,
      color: 'var(--text-primary)'
    }
  }, value), delta || deltaNote ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: '18px',
      marginTop: 4,
      color: 'var(--text-secondary)'
    }
  }, delta ? /*#__PURE__*/React.createElement("span", {
    style: {
      color
    }
  }, delta) : null, delta && deltaNote ? ' ' : '', deltaNote) : null);
}
Object.assign(__ds_scope, { StatTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/StatTile.jsx", error: String((e && e.message) || e) }); }

// components/money/Amount.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SYMBOLS = {
  UYU: '$',
  USD: 'US$',
  ARS: 'AR$',
  EUR: '€',
  BRL: 'R$'
};
/* List and figure display is decimal-less; cents are opt-in via `decimals` (the keypad hero passes 2). */
const DECIMALS = {
  UYU: 0,
  USD: 0,
  ARS: 0,
  EUR: 0,
  BRL: 0,
  CLP: 0,
  JPY: 0
};
const SIZES = {
  'hero-xl': {
    fontSize: 'var(--text-hero-xl-size)',
    lineHeight: 'var(--text-hero-xl-line)',
    fontWeight: 600,
    letterSpacing: 'var(--text-hero-xl-track)'
  },
  hero: {
    fontSize: 'var(--text-hero-size)',
    lineHeight: 'var(--text-hero-line)',
    fontWeight: 600,
    letterSpacing: 'var(--text-hero-track)'
  },
  title: {
    fontSize: 'var(--text-title-size)',
    lineHeight: 'var(--text-title-line)',
    fontWeight: 600,
    letterSpacing: 'var(--text-title-track)'
  },
  body: {
    fontSize: 'var(--text-body-size)',
    lineHeight: 'var(--text-body-line)',
    fontWeight: 500
  },
  label: {
    fontSize: 'var(--text-label-size)',
    lineHeight: 'var(--text-label-line)',
    fontWeight: 500
  }
};

/** es-UY grouping: "." thousands, "," decimals. */
function formatAmount(value, currency = 'UYU', decimals) {
  const d = decimals ?? DECIMALS[currency] ?? 2;
  const abs = Math.abs(Number(value) || 0);
  const [int, frac] = abs.toFixed(d).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return frac ? `${grouped},${frac}` : grouped;
}
function Amount({
  value,
  currency = 'UYU',
  size = 'body',
  polarity,
  showSign = true,
  showArrow = false,
  tabular = false,
  mutedDecimals = false,
  decimals,
  privacy = false,
  style,
  ...rest
}) {
  const n = Number(value) || 0;
  /* `polarity` controls COLOUR only; `showSign` controls the GLYPH. They are independent, so a
     net movement total can be neutral ink and still carry its −. Balances (showSign={false})
     default to neutral ink: aqua marks the polarity of a MOVEMENT, never of a balance. */
  const pol = polarity ?? (!showSign ? 'neutral' : n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral');
  const color = pol === 'positive' ? 'var(--money-positive)' : pol === 'negative-emphasis' ? 'var(--money-negative-emphasis)' : 'var(--money-negative)';
  const dir = Math.sign(n);
  const sign = !showSign || dir === 0 ? '' : dir > 0 ? '+' : '−';
  const arrow = showArrow && dir !== 0 ? dir > 0 ? '↑ ' : '↓ ' : '';
  const text = formatAmount(n, currency, decimals);
  const [int, frac] = text.split(',');
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      fontFamily: tabular ? 'var(--font-mono)' : 'var(--font-sans)',
      fontVariantNumeric: tabular ? 'tabular-nums' : 'proportional-nums',
      color,
      whiteSpace: 'nowrap',
      ...SIZES[size],
      filter: privacy ? 'blur(8px)' : 'none',
      userSelect: privacy ? 'none' : 'auto',
      ...style
    }
  }, rest), arrow, sign, sign || arrow ? '' : '', SYMBOLS[currency] ?? currency, "\xA0", int, frac ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: mutedDecimals ? 'var(--text-muted)' : 'inherit'
    }
  }, ",", frac) : null);
}
Object.assign(__ds_scope, { formatAmount, Amount });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/money/Amount.jsx", error: String((e && e.message) || e) }); }

// components/finance/AccountCarousel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function AccountCarousel({
  accounts = [],
  activeId,
  onSelect,
  privacy = false,
  style,
  ...rest
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current) ref.current.scrollLeft = 0;
  }, []);
  return /*#__PURE__*/React.createElement("div", _extends({
    ref: ref,
    style: {
      display: 'flex',
      gap: 12,
      overflowX: 'auto',
      scrollSnapType: 'x mandatory',
      padding: '0 var(--screen-padding)',
      margin: '0 calc(-1 * var(--screen-padding))',
      scrollPaddingInlineStart: 'var(--screen-padding)',
      scrollbarWidth: 'none',
      ...style
    }
  }, rest), accounts.map(a => {
    const on = a.id === activeId;
    return /*#__PURE__*/React.createElement("button", {
      key: a.id,
      type: "button",
      onClick: () => onSelect?.(a.id),
      style: {
        scrollSnapAlign: 'start',
        flex: '0 0 auto',
        width: 208,
        textAlign: 'left',
        cursor: 'pointer',
        background: on ? 'var(--surface-2)' : 'var(--surface-1)',
        borderRadius: 'var(--radius-card)',
        padding: 16,
        border: 0,
        transition: 'background var(--duration-fast) var(--ease-spring-snappy)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text-secondary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, a.institution), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        color: 'var(--text-muted)'
      }
    }, a.currency)), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Amount, {
      value: a.balance,
      currency: a.currency,
      size: "body",
      showSign: false,
      polarity: "neutral",
      privacy: privacy
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6,
        fontSize: 12,
        color: 'var(--text-muted)'
      }
    }, a.name, a.country ? ` · ${a.country}` : ''));
  }));
}
Object.assign(__ds_scope, { AccountCarousel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/AccountCarousel.jsx", error: String((e && e.message) || e) }); }

// components/finance/TransactionRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function TransactionRow({
  icon = 'cart',
  merchant,
  meta,
  value,
  currency = 'UYU',
  secondary,
  polarity,
  privacy = false,
  onClick,
  style,
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '11px 0',
      cursor: onClick ? 'pointer' : 'default',
      transform: pressed && onClick ? 'scale(var(--press-scale))' : 'scale(1)',
      transition: 'transform var(--duration-fast) var(--ease-spring-snappy)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 12,
      background: 'var(--surface-2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 19,
    color: "var(--text-secondary)"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 16,
      lineHeight: '22px',
      fontWeight: 400,
      color: 'var(--text-primary)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, merchant), meta ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 13,
      lineHeight: '18px',
      color: 'var(--text-muted)',
      marginTop: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, meta) : null), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: 'right',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Amount, {
    value: value,
    currency: currency,
    size: "body",
    polarity: polarity,
    tabular: true,
    privacy: privacy,
    style: {
      display: 'block'
    }
  }), secondary ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 12,
      color: 'var(--text-muted)',
      marginTop: 1
    }
  }, secondary) : null));
}
Object.assign(__ds_scope, { TransactionRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/TransactionRow.jsx", error: String((e && e.message) || e) }); }

// components/money/AmountScrubber.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function AmountScrubber({
  value,
  currency = 'UYU',
  step = 10,
  onChange,
  onOpenKeypad,
  style,
  ...rest
}) {
  const drag = React.useRef(null);
  const [active, setActive] = React.useState(false);
  const onPointerDown = e => {
    drag.current = {
      x: e.clientX,
      start: value,
      t: Date.now()
    };
    setActive(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = e => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const velocity = Math.min(6, 1 + Math.abs(dx) / 60);
    onChange?.(Math.max(0, Math.round((drag.current.start + dx * step * velocity) / step) * step));
  };
  const onPointerUp = () => {
    const quick = drag.current && Date.now() - drag.current.t < 180;
    drag.current = null;
    setActive(false);
    if (quick) onOpenKeypad?.();
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    onPointerDown: onPointerDown,
    onPointerMove: onPointerMove,
    onPointerUp: onPointerUp,
    onPointerCancel: onPointerUp,
    style: {
      display: 'inline-flex',
      alignItems: 'baseline',
      touchAction: 'none',
      cursor: 'ew-resize',
      transform: active ? 'scale(1.02)' : 'scale(1)',
      transition: 'transform var(--duration-fast) var(--ease-spring-snappy)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Amount, {
    value: value,
    currency: currency,
    size: "hero-xl",
    showSign: false,
    mutedDecimals: true
  }));
}
Object.assign(__ds_scope, { AmountScrubber });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/money/AmountScrubber.jsx", error: String((e && e.message) || e) }); }

// components/money/CurrencyChip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const FLAGS = {
  UYU: '🇺🇾',
  USD: '🇺🇸',
  ARS: '🇦🇷',
  EUR: '🇪🇺',
  BRL: '🇧🇷'
};
function CurrencyChip({
  currency = 'UYU',
  selected = false,
  onClick,
  showChevron = true,
  style,
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      height: 36,
      padding: '0 12px',
      borderRadius: 'var(--radius-chip)',
      cursor: 'pointer',
      background: selected ? 'var(--primary-fill)' : 'var(--surface-2)',
      color: selected ? 'var(--primary-on-fill)' : 'var(--text-primary)',
      border: selected ? '1px solid transparent' : '1px solid var(--border)',
      fontFamily: 'var(--font-mono)',
      fontWeight: 500,
      fontSize: 13,
      lineHeight: 1,
      transform: pressed ? 'scale(var(--press-scale))' : 'scale(1)',
      transition: 'transform var(--duration-fast) var(--ease-spring-snappy)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 15
    }
  }, FLAGS[currency] ?? '🏳'), currency, showChevron ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 14,
    strokeWidth: 1.75
  }) : null);
}
Object.assign(__ds_scope, { CurrencyChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/money/CurrencyChip.jsx", error: String((e && e.message) || e) }); }

// components/money/FxEditor.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function FxEditor({
  from = 'USD',
  to = 'UYU',
  rate,
  suggested,
  source = 'DolarApi · oficial',
  ageHours = 0,
  stale = false,
  onChange,
  onOpenKeypad,
  style,
  ...rest
}) {
  const baseRate = suggested ?? rate;
  const pct = Math.max(-5, Math.min(5, (rate - baseRate) / baseRate * 100));
  return /*#__PURE__*/React.createElement("div", _extends({
    style: style
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 11,
      lineHeight: '16px',
      fontWeight: 500,
      letterSpacing: '.02em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, from, " \u2192 ", to), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onOpenKeypad,
    style: {
      background: 'none',
      border: 0,
      padding: 0,
      marginTop: 4,
      cursor: 'pointer',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-hero-size)',
      lineHeight: 'var(--text-hero-line)',
      fontWeight: 600,
      letterSpacing: 'var(--text-hero-track)'
    }
  }, __ds_scope.formatAmount(rate, to, 2))), stale ? /*#__PURE__*/React.createElement(__ds_scope.StatusBadge, {
    status: "warning",
    icon: "clock"
  }, "hace ", ageHours, " h") : null), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: -5,
    max: 5,
    step: 0.1,
    value: pct,
    onChange: e => onChange?.(baseRate * (1 + Number(e.target.value) / 100)),
    style: {
      width: '100%',
      margin: '16px 0 8px',
      accentColor: 'var(--primary-fill)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 11,
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u22125%"), /*#__PURE__*/React.createElement("span", null, source), /*#__PURE__*/React.createElement("span", null, "+5%")));
}
Object.assign(__ds_scope, { FxEditor });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/money/FxEditor.jsx", error: String((e && e.message) || e) }); }

// components/money/Keypad.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const KEYS = [['1', '2', '3', '+'], ['4', '5', '6', '−'], ['7', '8', '9', '×'], [',', '0', 'backspace', '÷']];
const OPS = ['+', '−', '×', '÷'];
function Key({
  label,
  onPress,
  onLongPress
}) {
  const [pressed, setPressed] = React.useState(false);
  const timer = React.useRef(null);
  const isOp = OPS.includes(label);
  const down = () => {
    setPressed(true);
    if (navigator.vibrate) navigator.vibrate(8);
    if (onLongPress) timer.current = setTimeout(onLongPress, 500);
  };
  const up = () => {
    setPressed(false);
    clearTimeout(timer.current);
  };
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onPointerDown: down,
    onPointerUp: up,
    onPointerLeave: up,
    onClick: () => onPress(label),
    style: {
      height: 'var(--keypad-key-height)',
      borderRadius: 'var(--radius-keypad-key)',
      border: 0,
      background: pressed ? 'var(--primary-fill)' : isOp ? 'var(--surface-2)' : 'var(--surface-3)',
      color: pressed ? 'var(--primary-on-fill)' : isOp ? 'var(--text-secondary)' : 'var(--text-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: isOp ? 22 : 32,
      fontWeight: 500,
      fontVariantNumeric: 'tabular-nums',
      transform: pressed ? 'scale(var(--press-scale))' : 'scale(1)',
      transition: 'transform var(--duration-fast) var(--ease-spring-snappy), background var(--duration-micro) linear'
    }
  }, label === 'backspace' ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "backspace",
    size: 24,
    strokeWidth: 1.8
  }) : label);
}
function Keypad({
  onKey,
  onClear,
  gap = 8,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap,
      ...style
    }
  }, rest), KEYS.flat().map(k => /*#__PURE__*/React.createElement(Key, {
    key: k,
    label: k,
    onPress: onKey,
    onLongPress: k === 'backspace' ? onClear : undefined
  })));
}
Object.assign(__ds_scope, { Keypad });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/money/Keypad.jsx", error: String((e && e.message) || e) }); }

// components/money/PrivacyBlur.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function PrivacyBlur({
  active = false,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-block',
      filter: active ? 'blur(8px)' : 'none',
      userSelect: active ? 'none' : 'auto',
      pointerEvents: active ? 'none' : 'auto',
      transition: 'filter var(--duration-base) var(--ease-spring-soft)',
      ...style
    },
    "aria-hidden": active || undefined
  }, rest), children);
}
Object.assign(__ds_scope, { PrivacyBlur });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/money/PrivacyBlur.jsx", error: String((e && e.message) || e) }); }

// components/nav/SyncDot.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SyncDot({
  state = 'synced',
  pending = 0,
  style,
  ...rest
}) {
  const color = state === 'synced' ? 'var(--text-muted)' : 'var(--warning)';
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 999,
      background: color,
      animation: state === 'syncing' ? 'ds-sync-pulse 1.2s var(--ease-spring-soft) infinite' : 'none'
    }
  }), state === 'offline' && pending > 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: 11,
      color: 'var(--warning)'
    }
  }, pending) : null, /*#__PURE__*/React.createElement("style", null, '@keyframes ds-sync-pulse{0%,100%{opacity:1}50%{opacity:.3}}'));
}
Object.assign(__ds_scope, { SyncDot });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/nav/SyncDot.jsx", error: String((e && e.message) || e) }); }

// components/nav/AppHeader.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function AppHeader({
  title,
  scope,
  onScopeChange,
  scopeOptions,
  onSearch,
  onBack,
  syncState = 'synced',
  pending = 0,
  showScope = true,
  right,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("header", _extends({
    style: {
      height: 'var(--header-height)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '0 var(--screen-padding)',
      background: 'var(--page)',
      ...style
    }
  }, rest), onBack ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onBack,
    "aria-label": "Volver",
    style: {
      width: 44,
      height: 44,
      marginLeft: -12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'none',
      border: 0,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-left",
    size: 22,
    color: "var(--text-secondary)"
  })) : null, showScope && !onBack ? /*#__PURE__*/React.createElement(__ds_scope.ScopeSwitcher, {
    value: scope,
    onChange: onScopeChange,
    options: scopeOptions
  }) : null, title ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 17,
      fontWeight: 600,
      letterSpacing: '-.01em',
      color: 'var(--text-primary)'
    }
  }, title) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), right, onSearch ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onSearch,
    "aria-label": "Buscar",
    style: {
      width: 44,
      height: 44,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'none',
      border: 0,
      cursor: 'pointer',
      marginRight: -10
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "search",
    size: 20,
    color: "var(--text-secondary)"
  })) : null, /*#__PURE__*/React.createElement(__ds_scope.SyncDot, {
    state: syncState,
    pending: pending
  }));
}
Object.assign(__ds_scope, { AppHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/nav/AppHeader.jsx", error: String((e && e.message) || e) }); }

// components/nav/TabBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const DEFAULT_TABS = [{
  id: 'home',
  label: 'Inicio',
  icon: 'home'
}, {
  id: 'movements',
  label: 'Movim.',
  icon: 'list'
}, {
  id: 'add',
  label: '',
  icon: 'plus',
  fab: true
}, {
  id: 'analytics',
  label: 'Análisis',
  icon: 'chart'
}, {
  id: 'more',
  label: 'Más',
  icon: 'more'
}];
function TabBar({
  tabs = DEFAULT_TABS,
  active,
  onChange,
  style,
  ...rest
}) {
  const [pressed, setPressed] = React.useState(null);
  return /*#__PURE__*/React.createElement("nav", _extends({
    style: {
      height: 'var(--tabbar-height)',
      display: 'flex',
      alignItems: 'center',
      background: 'var(--page)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      ...style
    }
  }, rest), tabs.map(t => {
    const on = t.id === active;
    if (t.fab) {
      return /*#__PURE__*/React.createElement("button", {
        key: t.id,
        type: "button",
        onClick: () => onChange?.(t.id),
        "aria-label": "Agregar",
        onPointerDown: () => setPressed(t.id),
        onPointerUp: () => setPressed(null),
        onPointerLeave: () => setPressed(null),
        style: {
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          background: 'none',
          border: 0,
          cursor: 'pointer'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: 'var(--fab-size)',
          height: 'var(--fab-size)',
          borderRadius: 999,
          background: 'var(--primary-fill)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--shadow-sheet)',
          transform: `translateY(-18px) scale(${pressed === t.id ? 'var(--press-scale)' : '1'})`,
          transition: 'transform var(--duration-fast) var(--ease-spring-snappy)'
        }
      }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
        name: "plus",
        size: 28,
        strokeWidth: 2,
        color: "var(--primary-on-fill)"
      })));
    }
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      type: "button",
      onClick: () => onChange?.(t.id),
      style: {
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        background: 'none',
        border: 0,
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: t.icon,
      size: 22,
      strokeWidth: on ? 1.9 : 1.5,
      color: on ? 'var(--primary-ink)' : 'var(--text-muted)'
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-sans)',
        fontSize: 11,
        fontWeight: 500,
        color: on ? 'var(--primary-ink)' : 'var(--text-muted)'
      }
    }, t.label));
  }));
}
Object.assign(__ds_scope, { TabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/nav/TabBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/AnalyticsScreen.jsx
try { (() => {
const {
  AppHeader,
  Card,
  BarChart,
  SeriesLegend,
  Chip,
  Icon
} = window.APPFinanzasDesignSystem_3bc1d9;

/* Un solo héroe: gasto del mes. "Meses de colchón" se mudó a su propia pantalla.
   La vista de tabla es un control real de 44px con estado visible, y existe de verdad. */
function ChartViewToggle({
  view,
  onChange
}) {
  const opts = [{
    id: 'chart',
    icon: 'chart',
    label: 'Gráfico'
  }, {
    id: 'table',
    icon: 'list',
    label: 'Tabla'
  }];
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: 'flex',
      gap: 2,
      padding: 3,
      borderRadius: 999,
      background: 'var(--surface-2)'
    }
  }, opts.map(o => {
    const on = o.id === view;
    return /*#__PURE__*/React.createElement("button", {
      key: o.id,
      role: "tab",
      "aria-selected": on,
      type: "button",
      onClick: () => onChange(o.id),
      style: {
        height: 38,
        minWidth: 44,
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        border: 0,
        cursor: 'pointer',
        background: on ? 'var(--surface-3)' : 'transparent',
        color: on ? 'var(--text-primary)' : 'var(--text-muted)',
        font: '500 13px/1 var(--font-sans)',
        transition: 'background var(--duration-fast) var(--ease-spring-snappy)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: o.icon,
      size: 16,
      strokeWidth: 1.75
    }), o.label);
  }));
}
function AnalyticsScreen({
  scope,
  setScope,
  onOpenCushion
}) {
  const [range, setRange] = React.useState('8 meses');
  const [view, setView] = React.useState('chart');
  const caption = {
    font: '500 11px/16px var(--font-sans)',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)'
  };
  const monthTable = window.MONTHS.map(m => ({
    label: m.label,
    value: `$ ${(m.value * 1000 + 18740).toLocaleString('es-UY')}`,
    color: 'var(--data-1)'
  }));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(AppHeader, {
    showScope: false,
    title: "An\xE1lisis",
    scope: scope,
    onScopeChange: setScope,
    syncState: "synced"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px var(--screen-padding) 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: caption
  }, "Gasto del mes"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 40px/44px var(--font-sans)',
      letterSpacing: '-.015em',
      marginTop: 6
    }
  }, "$ 63.740"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      font: '500 13px/18px var(--font-sans)',
      color: 'var(--text-secondary)'
    }
  }, "\u2193 2,8% vs. junio")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      padding: '20px var(--screen-padding) 0'
    }
  }, ['3 meses', '8 meses', 'Año'].map(r => /*#__PURE__*/React.createElement(Chip, {
    key: r,
    selected: r === range,
    onClick: () => setRange(r)
  }, r))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--screen-padding)',
      marginTop: 'var(--block-gap)'
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 13px/18px var(--font-sans)'
    }
  }, "Gasto por mes"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 11px/16px var(--font-sans)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, range, " \xB7 UYU")), /*#__PURE__*/React.createElement(ChartViewToggle, {
    view: view,
    onChange: setView
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, view === 'chart' ? /*#__PURE__*/React.createElement(BarChart, {
    data: window.MONTHS
  }) : /*#__PURE__*/React.createElement(SeriesLegend, {
    series: monthTable
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--screen-padding)',
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 13px/18px var(--font-sans)'
    }
  }, "Exposici\xF3n por moneda"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 11px/16px var(--font-sans)',
      color: 'var(--text-muted)',
      margin: '2px 0 8px'
    }
  }, "% del patrimonio \xB7 julio 2026"), /*#__PURE__*/React.createElement(SeriesLegend, {
    series: [{
      label: 'USD',
      value: '48,2%'
    }, {
      label: 'UYU',
      value: '31,6%'
    }, {
      label: 'ARS',
      value: '14,9%'
    }, {
      label: 'EUR',
      value: '3,8%'
    }, {
      label: 'Otros',
      value: '1,5%',
      color: 'var(--data-other)'
    }]
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--screen-padding)',
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onOpenCushion,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      minHeight: 44,
      background: 'none',
      border: 0,
      padding: '11px 0',
      cursor: 'pointer',
      font: '400 16px/22px var(--font-sans)',
      color: 'var(--text-secondary)'
    }
  }, "Colch\xF3n \xB7 6,7 meses ", /*#__PURE__*/React.createElement(Icon, {
    name: "chevron",
    size: 18,
    color: "var(--text-muted)"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 120
    }
  }));
}
Object.assign(window, {
  AnalyticsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/AnalyticsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/AppData.jsx
try { (() => {
const ACCOUNTS = [{
  id: 'itau',
  institution: 'Itaú',
  name: 'Caja de Ahorro',
  balance: 184200,
  currency: 'UYU',
  country: 'UY'
}, {
  id: 'brou',
  institution: 'Brou',
  name: 'Débito',
  balance: 41800,
  currency: 'UYU',
  country: 'UY'
}, {
  id: 'wise',
  institution: 'Wise',
  name: 'Multi-moneda',
  balance: 2340,
  currency: 'USD',
  country: 'BE'
}, {
  id: 'ppi',
  institution: 'PPI',
  name: 'Inversiones',
  balance: 6120,
  currency: 'USD',
  country: 'AR'
}];
const MOVEMENTS = [{
  id: 'm1',
  day: 'Hoy',
  icon: 'cart',
  merchant: 'Tienda Inglesa',
  meta: 'Itaú Caja de Ahorro · Supermercado',
  value: -4280
}, {
  id: 'm2',
  day: 'Hoy',
  icon: 'coffee',
  merchant: 'La Farmacia',
  meta: 'Visa · Café',
  value: -320
}, {
  id: 'm3',
  day: 'Hoy',
  icon: 'fuel',
  merchant: 'Ancap Punta Carretas',
  meta: 'Itaú Crédito · Nafta',
  value: -2650
}, {
  id: 'm4',
  day: 'Ayer',
  icon: 'arrow-up',
  merchant: 'Sueldo',
  meta: 'Brou Débito · Ingreso',
  value: 92400
}, {
  id: 'm5',
  day: 'Ayer',
  icon: 'home',
  merchant: 'Alquiler',
  meta: 'Itaú Caja de Ahorro · Vivienda',
  value: -32000
}, {
  id: 'm6',
  day: 'Ayer',
  icon: 'food',
  merchant: 'PedidosYa',
  meta: 'Visa · Delivery',
  value: -1180,
  secondary: 'compartido'
}, {
  id: 'm7',
  day: 'Martes 21',
  icon: 'invest',
  merchant: 'Aporte FCI',
  meta: 'PPI · Inversiones',
  value: -400,
  currency: 'USD'
}, {
  id: 'm8',
  day: 'Martes 21',
  icon: 'cart',
  merchant: 'Devoto',
  meta: 'Itaú Crédito · Supermercado',
  value: -2140
}];
const MONTHS = [{
  label: 'Dic',
  value: 48
}, {
  label: 'Ene',
  value: 62
}, {
  label: 'Feb',
  value: 40
}, {
  label: 'Mar',
  value: 70,
  display: '$ 71.200'
}, {
  label: 'Abr',
  value: 53
}, {
  label: 'May',
  value: 34
}, {
  label: 'Jun',
  value: 59
}, {
  label: 'Jul',
  value: 45
}];
const CATEGORIES = [{
  id: 'super',
  icon: 'cart',
  label: 'Súper'
}, {
  id: 'comida',
  icon: 'food',
  label: 'Comida'
}, {
  id: 'auto',
  icon: 'car',
  label: 'Auto'
}, {
  id: 'casa',
  icon: 'home',
  label: 'Casa'
}, {
  id: 'cafe',
  icon: 'coffee',
  label: 'Café'
}, {
  id: 'salud',
  icon: 'target',
  label: 'Salud'
}];
const FREQUENT = [{
  id: 'f1',
  label: 'Café',
  value: 180,
  icon: 'coffee',
  category: 'cafe'
}, {
  id: 'f2',
  label: 'Súper',
  value: 4280,
  icon: 'cart',
  category: 'super'
}, {
  id: 'f3',
  label: 'Nafta',
  value: 2650,
  icon: 'fuel',
  category: 'auto'
}, {
  id: 'f4',
  label: 'Almuerzo',
  value: 620,
  icon: 'food',
  category: 'comida'
}];

/* Los totales por día se expresan en UYU: los movimientos en USD se convierten a este rate
   (el mismo que muestra FxEditor) antes de sumarse. Nunca se suman dos monedas. */
const FX_USD_UYU = 39.85;
Object.assign(window, {
  ACCOUNTS,
  MOVEMENTS,
  MONTHS,
  CATEGORIES,
  FREQUENT,
  FX_USD_UYU
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/AppData.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/AppearanceScreen.jsx
try { (() => {
const {
  AppHeader,
  ListRow,
  Switch
} = window.APPFinanzasDesignSystem_3bc1d9;

/* Salió de "Más", que volvió a ser índice puro.
   Filas y toggles son ListRow + Switch del sistema; antes estaban copiados a mano. */
function AppearanceScreen({
  onBack,
  privacy,
  setPrivacy,
  theme,
  setTheme,
  offline,
  setOffline
}) {
  const rows = [{
    icon: privacy ? 'eye-off' : 'eye',
    label: 'Modo privacidad',
    meta: 'Difumina los montos',
    on: privacy,
    set: setPrivacy
  }, {
    icon: 'home',
    label: 'Tema oscuro',
    meta: theme === 'dark' ? 'Activado' : 'Desactivado',
    on: theme === 'dark',
    set: v => setTheme(v ? 'dark' : 'light')
  }, {
    icon: 'wifi',
    label: 'Simular offline',
    meta: 'Demo de estado sin conexión',
    on: offline,
    set: setOffline
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(AppHeader, {
    title: "Apariencia",
    onBack: onBack,
    syncState: "synced"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px var(--screen-padding) 0'
    }
  }, rows.map(r => /*#__PURE__*/React.createElement(ListRow, {
    key: r.label,
    icon: r.icon,
    label: r.label,
    meta: r.meta,
    variant: "value",
    chevron: false,
    onClick: () => r.set(!r.on),
    right: /*#__PURE__*/React.createElement(Switch, {
      checked: r.on,
      onChange: r.set
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 120
    }
  }));
}
Object.assign(window, {
  AppearanceScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/AppearanceScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/BudgetScreen.jsx
try { (() => {
const {
  AppHeader,
  BudgetRing,
  Amount,
  StatusBadge
} = window.APPFinanzasDesignSystem_3bc1d9;

/* Salió de Inicio: era su segundo trabajo. Acá la tasa de ahorro es la cifra héroe. */
function BudgetScreen({
  onBack
}) {
  const caption = {
    font: '500 11px/16px var(--font-sans)',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)'
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(AppHeader, {
    title: "Presupuesto",
    onBack: onBack,
    syncState: "synced"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px var(--screen-padding) 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: caption
  }, "Tasa de ahorro \xB7 julio"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 40px/44px var(--font-sans)',
      letterSpacing: '-.015em',
      marginTop: 6
    }
  }, "31%"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      font: '500 13px/18px var(--font-sans)',
      color: 'var(--text-secondary)'
    }
  }, "\u2191 6 pts vs. junio")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--screen-padding)',
      marginTop: 'var(--block-gap)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: caption
  }, "Categor\xEDas"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 24,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(BudgetRing, {
    progress: 0.62,
    label: "S\xFAper",
    sublabel: "$ 8.400 / 13.500"
  }), /*#__PURE__*/React.createElement(BudgetRing, {
    progress: 1.14,
    label: "Delivery",
    sublabel: "$ 4.560 / 4.000"
  }), /*#__PURE__*/React.createElement(BudgetRing, {
    progress: 0.41,
    label: "Nafta",
    sublabel: "$ 3.280 / 8.000"
  }), /*#__PURE__*/React.createElement(BudgetRing, {
    progress: 0.86,
    label: "Casa",
    sublabel: "$ 34.400 / 40.000"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--screen-padding)',
      marginTop: 'var(--block-gap)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(StatusBadge, {
    status: "critical"
  }, "Delivery excedido por $ 560")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 120
    }
  }));
}
Object.assign(window, {
  BudgetScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/BudgetScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/CushionScreen.jsx
try { (() => {
const {
  AppHeader,
  BarChart,
  StatusBadge
} = window.APPFinanzasDesignSystem_3bc1d9;

/* "Meses de colchón" salió de Análisis: ahí competía con el gasto del mes por ser el héroe. */
function CushionScreen({
  onBack
}) {
  const caption = {
    font: '500 11px/16px var(--font-sans)',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)'
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(AppHeader, {
    title: "Colch\xF3n",
    onBack: onBack,
    syncState: "synced"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px var(--screen-padding) 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: caption
  }, "Meses de colch\xF3n"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 40px/44px var(--font-sans)',
      letterSpacing: '-.015em',
      marginTop: 6
    }
  }, "6,7"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      font: '500 13px/18px var(--font-sans)',
      color: 'var(--text-secondary)'
    }
  }, "objetivo: 6 \xB7 gasto base $ 63.740")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--screen-padding)',
      marginTop: 'var(--block-gap)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: caption
  }, "Evoluci\xF3n"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(BarChart, {
    data: [{
      label: 'Feb',
      value: 41
    }, {
      label: 'Mar',
      value: 45
    }, {
      label: 'Abr',
      value: 52
    }, {
      label: 'May',
      value: 58
    }, {
      label: 'Jun',
      value: 62
    }, {
      label: 'Jul',
      value: 67,
      display: '6,7'
    }]
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--screen-padding)',
      marginTop: 'var(--block-gap)'
    }
  }, /*#__PURE__*/React.createElement(StatusBadge, {
    status: "good"
  }, "Por encima del objetivo desde mayo")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 120
    }
  }));
}
Object.assign(window, {
  CushionScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/CushionScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/HomeScreen.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  AppHeader,
  Amount,
  AccountCarousel,
  InsightCard,
  TransactionRow,
  Sparkline,
  PrivacyBlur,
  OfflineBanner,
  Sheet,
  Icon
} = window.APPFinanzasDesignSystem_3bc1d9;

/* Presupuesto de ruido: 1 héroe (patrimonio) · 1 violeta visible (FAB) · 1 primaria (FAB)
   Los anillos y el KPI de ahorro viven en Presupuesto; los insights, en un drawer. */
function HomeScreen({
  scope,
  setScope,
  privacy,
  offline,
  onOpenMovements
}) {
  const [account, setAccount] = React.useState('itau');
  const [insights, setInsights] = React.useState(false);
  const caption = {
    font: '500 11px/16px var(--font-sans)',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)'
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(AppHeader, {
    scope: scope,
    onScopeChange: setScope,
    onSearch: () => {},
    syncState: offline ? 'offline' : 'synced',
    pending: offline ? 3 : 0
  }), offline ? /*#__PURE__*/React.createElement(OfflineBanner, {
    pending: 3
  }) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px var(--screen-padding) 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: caption
  }, "Patrimonio neto"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(PrivacyBlur, {
    active: privacy
  }, /*#__PURE__*/React.createElement(Amount, {
    value: 428900,
    size: "hero",
    showSign: false,
    polarity: "neutral"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      font: '500 13px/18px var(--font-sans)',
      color: 'var(--text-secondary)'
    }
  }, "\u2191 4,2% vs. junio")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--block-gap)'
    }
  }, /*#__PURE__*/React.createElement(AccountCarousel, {
    accounts: window.ACCOUNTS,
    activeId: account,
    onSelect: setAccount,
    privacy: privacy
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--screen-padding)',
      marginTop: 'var(--block-gap)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: caption
  }, "\xDAltimos movimientos"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, window.MOVEMENTS.slice(0, 3).map(m => /*#__PURE__*/React.createElement(TransactionRow, _extends({
    key: m.id
  }, m, {
    privacy: privacy,
    onClick: () => {}
  })))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onOpenMovements,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      minHeight: 44,
      background: 'none',
      border: 0,
      padding: '11px 0',
      cursor: 'pointer',
      font: '400 16px/22px var(--font-sans)',
      color: 'var(--text-secondary)'
    }
  }, "Ver todos los movimientos ", /*#__PURE__*/React.createElement(Icon, {
    name: "chevron",
    size: 18,
    color: "var(--text-muted)"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setInsights(true),
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      minHeight: 44,
      background: 'none',
      border: 0,
      padding: '11px 0',
      cursor: 'pointer',
      font: '400 16px/22px var(--font-sans)',
      color: 'var(--text-secondary)'
    }
  }, "2 novedades ", /*#__PURE__*/React.createElement(Icon, {
    name: "chevron",
    size: 18,
    color: "var(--text-muted)"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 120
    }
  }), /*#__PURE__*/React.createElement(Sheet, {
    open: insights,
    title: "Novedades",
    onClose: () => setInsights(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(InsightCard, {
    status: "serious",
    text: "Netflix pas\xF3 de $ 590 a $ 740 este mes.",
    actionLabel: "Ver suscripciones",
    onDismiss: () => {},
    sparkline: /*#__PURE__*/React.createElement(Sparkline, {
      values: [590, 590, 590, 640, 740],
      color: "var(--serious)"
    })
  }), /*#__PURE__*/React.createElement(InsightCard, {
    status: "warning",
    text: "Delivery ya consumi\xF3 114% del presupuesto de julio.",
    actionLabel: "Ver presupuesto",
    onDismiss: () => {}
  }))));
}
Object.assign(window, {
  HomeScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/HomeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/MoreScreen.jsx
try { (() => {
const {
  AppHeader,
  ListRow
} = window.APPFinanzasDesignSystem_3bc1d9;

/* Índice puro: sin controles de estado, sin toggles. La apariencia es su propia pantalla.
   Las filas son ListRow del sistema: antes eran un Row copiado a mano acá y en Apariencia. */
function MoreScreen({
  onOpenBudget,
  onOpenAppearance
}) {
  const sections = [{
    icon: 'wallet',
    label: 'Cuentas',
    meta: '4 activas · 2 monedas'
  }, {
    icon: 'target',
    label: 'Presupuesto',
    meta: 'julio · 4 categorías',
    onClick: onOpenBudget
  }, {
    icon: 'invest',
    label: 'Inversiones',
    meta: 'US$ 6.120 · PPI'
  }, {
    icon: 'users',
    label: 'Grupo familiar',
    meta: 'Ana, Lu'
  }, {
    icon: 'refresh',
    label: 'Recurrentes',
    meta: '7 suscripciones'
  }, {
    icon: 'eye',
    label: 'Apariencia',
    meta: 'Tema, privacidad',
    onClick: onOpenAppearance
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(AppHeader, {
    showScope: false,
    title: "M\xE1s",
    syncState: "synced"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px var(--screen-padding) 0'
    }
  }, sections.map(s => /*#__PURE__*/React.createElement(ListRow, {
    key: s.label,
    icon: s.icon,
    label: s.label,
    meta: s.meta,
    onClick: s.onClick ?? (() => {})
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 120
    }
  }));
}
Object.assign(window, {
  MoreScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/MoreScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/MovementsScreen.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  AppHeader,
  Chip,
  TransactionRow,
  EmptyState,
  Input,
  Icon,
  Sheet,
  Button,
  Amount
} = window.APPFinanzasDesignSystem_3bc1d9;

/* Los filtros se fueron a un sheet detrás de un solo control del header. */
function MovementsScreen({
  scope,
  setScope,
  privacy
}) {
  const [filter, setFilter] = React.useState('Todos');
  const [query, setQuery] = React.useState('');
  const [sheet, setSheet] = React.useState(false);
  const filters = ['Todos', 'Gastos', 'Ingresos', 'Compartidos'];
  const rows = window.MOVEMENTS.filter(m => {
    if (filter === 'Gastos' && m.value > 0) return false;
    if (filter === 'Ingresos' && m.value < 0) return false;
    if (filter === 'Compartidos' && m.secondary !== 'compartido') return false;
    return m.merchant.toLowerCase().includes(query.toLowerCase());
  });
  const days = [...new Set(rows.map(r => r.day))];
  const caption = {
    font: '500 11px/16px var(--font-sans)',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)'
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(AppHeader, {
    showScope: false,
    title: "Movimientos",
    syncState: "synced",
    right: /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setSheet(true),
      "aria-label": "Filtros",
      style: {
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 0,
        cursor: 'pointer',
        position: 'relative'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "filter",
      size: 20,
      color: filter === 'Todos' ? 'var(--text-secondary)' : 'var(--primary-ink)'
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px var(--screen-padding) 0'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Buscar comercio",
    value: query,
    onChange: e => setQuery(e.target.value)
  })), rows.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: "search",
    message: `No hay movimientos para "${query || filter}" en julio.`,
    actionLabel: "Limpiar filtros",
    onAction: () => {
      setQuery('');
      setFilter('Todos');
    }
  }) : days.map(day => /*#__PURE__*/React.createElement("div", {
    key: day,
    style: {
      padding: '0 var(--screen-padding)',
      marginTop: 'var(--block-gap)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: caption
  }, day), /*#__PURE__*/React.createElement(Amount, {
    value: rows.filter(r => r.day === day).reduce((s, r) => s + r.value * (r.currency === 'USD' ? window.FX_USD_UYU : 1), 0),
    size: "label",
    polarity: "neutral",
    tabular: true,
    style: {
      color: 'var(--text-muted)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2
    }
  }, rows.filter(r => r.day === day).map(m => /*#__PURE__*/React.createElement(TransactionRow, _extends({
    key: m.id
  }, m, {
    privacy: privacy,
    onClick: () => {}
  })))))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 120
    }
  }), /*#__PURE__*/React.createElement(Sheet, {
    open: sheet,
    title: "Filtros",
    onClose: () => setSheet(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8
    }
  }, filters.map(ff => /*#__PURE__*/React.createElement(Chip, {
    key: ff,
    selected: ff === filter,
    onClick: () => setFilter(ff)
  }, ff))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => setSheet(false)
  }, "Ver ", rows.length, " movimientos"))));
}
Object.assign(window, {
  MovementsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/MovementsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/QuickAddScreen.jsx
try { (() => {
const {
  Keypad,
  Amount,
  CategoryBubble,
  Chip,
  DateStrip,
  CurrencyChip,
  Button,
  Icon,
  Sheet,
  FxEditor
} = window.APPFinanzasDesignSystem_3bc1d9;

/* Paso 1 — MONTO. Paso 2 — CLASIFICAR. Dos trabajos, dos pantallas (spec §1.1).
   Camino de 3 taps: FAB → monto en el keypad → chip de frecuente (trae categoría) = guardado directo. */
function QuickAddScreen({
  onClose,
  onSave
}) {
  const [step, setStep] = React.useState(1);
  const [raw, setRaw] = React.useState('');
  const [currency, setCurrency] = React.useState('UYU');
  const [category, setCategory] = React.useState(null);
  const [date, setDate] = React.useState('2026-07-24');
  const [fxOpen, setFxOpen] = React.useState(false);
  const value = Number(raw || 0) / 100;
  const push = k => {
    if (k === 'backspace') return setRaw(r => r.slice(0, -1));
    if (/[0-9]/.test(k)) return setRaw(r => r.length > 9 ? r : r + k);
  };

  /* Un frecuente ya trae categoría: se guarda en el acto, sin paso 2. */
  const useFrequent = fq => {
    if (!value) {
      setRaw(String(fq.value * 100));
    }
    onSave(value || fq.value, currency, fq.label);
  };
  const shell = children => /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface-1)'
    }
  }, children);
  if (step === 2) {
    return shell(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        height: 'var(--header-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--screen-padding)'
      }
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setStep(1),
      "aria-label": "Volver al monto",
      style: {
        width: 44,
        height: 44,
        marginLeft: -12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 0,
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-left",
      size: 22,
      color: "var(--text-secondary)"
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '500 13px/18px var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--text-secondary)'
      }
    }, currency === 'USD' ? 'US$' : '$', " ", value.toLocaleString('es-UY'))), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '4px var(--screen-padding) 0'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '500 11px/16px var(--font-sans)',
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)'
      }
    }, "Categor\xEDa"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 14,
        marginTop: 14,
        flexWrap: 'wrap'
      }
    }, window.CATEGORIES.map(c => /*#__PURE__*/React.createElement(CategoryBubble, {
      key: c.id,
      icon: c.icon,
      label: c.label,
      selected: c.id === category,
      onClick: () => setCategory(c.id)
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '500 11px/16px var(--font-sans)',
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        marginTop: 28
      }
    }, "Fecha"), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14
      }
    }, /*#__PURE__*/React.createElement(DateStrip, {
      value: date,
      onChange: setDate,
      days: [{
        date: '2026-07-24',
        label: 'Hoy'
      }, {
        date: '2026-07-23',
        label: 'Ayer'
      }, '2026-07-22', '2026-07-21', '2026-07-20']
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 'var(--screen-padding)'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      size: "lg",
      disabled: !category,
      onClick: () => onSave(value, currency, window.CATEGORIES.find(c => c.id === category)?.label)
    }, "Guardar gasto"))));
  }
  return shell(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 'var(--header-height)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 var(--screen-padding)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    "aria-label": "Cerrar",
    style: {
      width: 44,
      height: 44,
      marginLeft: -12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'none',
      border: 0,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "close",
    size: 22,
    color: "var(--text-secondary)"
  })), /*#__PURE__*/React.createElement(CurrencyChip, {
    currency: currency,
    onClick: () => setCurrency(c => c === 'UYU' ? 'USD' : 'UYU')
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px var(--screen-padding) 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 11px/16px var(--font-sans)',
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, "Gasto \xB7 ", currency), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      minHeight: 64
    }
  }, /*#__PURE__*/React.createElement(Amount, {
    value: value,
    currency: currency,
    size: "hero-xl",
    showSign: false,
    decimals: 2,
    mutedDecimals: true
  })), currency !== 'UYU' ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setFxOpen(true),
    style: {
      marginTop: 8,
      background: 'none',
      border: 0,
      padding: 0,
      cursor: 'pointer',
      color: 'var(--text-secondary)',
      font: '500 13px/18px var(--font-sans)',
      textDecoration: 'underline',
      textUnderlineOffset: 3
    }
  }, "1 USD = 39,85 UYU \xB7 editar") : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      padding: '20px var(--screen-padding) 0',
      overflowX: 'auto',
      scrollbarWidth: 'none'
    }
  }, window.FREQUENT.map(fq => /*#__PURE__*/React.createElement(Chip, {
    key: fq.id,
    icon: fq.icon,
    onClick: () => useFrequent(fq)
  }, fq.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--screen-padding)'
    }
  }, /*#__PURE__*/React.createElement(Keypad, {
    onKey: push,
    onClear: () => setRaw('')
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--screen-padding)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    disabled: !value,
    onClick: () => setStep(2)
  }, "Siguiente")), /*#__PURE__*/React.createElement(Sheet, {
    open: fxOpen,
    title: "Tipo de cambio",
    onClose: () => setFxOpen(false)
  }, /*#__PURE__*/React.createElement(FxEditor, {
    from: "USD",
    to: "UYU",
    rate: 39.85,
    suggested: 39.85,
    ageHours: 26,
    stale: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => setFxOpen(false)
  }, "Usar este rate")))));
}
Object.assign(window, {
  QuickAddScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/QuickAddScreen.jsx", error: String((e && e.message) || e) }); }

__ds_ns.BarChart = __ds_scope.BarChart;

__ds_ns.SeriesLegend = __ds_scope.SeriesLegend;

__ds_ns.Sparkline = __ds_scope.Sparkline;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.ListRow = __ds_scope.ListRow;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Sheet = __ds_scope.Sheet;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.ErrorState = __ds_scope.ErrorState;

__ds_ns.OfflineBanner = __ds_scope.OfflineBanner;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.SkeletonRow = __ds_scope.SkeletonRow;

__ds_ns.UndoToast = __ds_scope.UndoToast;

__ds_ns.AccountCarousel = __ds_scope.AccountCarousel;

__ds_ns.BudgetRing = __ds_scope.BudgetRing;

__ds_ns.CategoryBubble = __ds_scope.CategoryBubble;

__ds_ns.DateStrip = __ds_scope.DateStrip;

__ds_ns.InsightCard = __ds_scope.InsightCard;

__ds_ns.ScopeSwitcher = __ds_scope.ScopeSwitcher;

__ds_ns.SplitBar = __ds_scope.SplitBar;

__ds_ns.StatTile = __ds_scope.StatTile;

__ds_ns.TransactionRow = __ds_scope.TransactionRow;

__ds_ns.Amount = __ds_scope.Amount;

__ds_ns.AmountScrubber = __ds_scope.AmountScrubber;

__ds_ns.CurrencyChip = __ds_scope.CurrencyChip;

__ds_ns.FxEditor = __ds_scope.FxEditor;

__ds_ns.Keypad = __ds_scope.Keypad;

__ds_ns.PrivacyBlur = __ds_scope.PrivacyBlur;

__ds_ns.AppHeader = __ds_scope.AppHeader;

__ds_ns.SyncDot = __ds_scope.SyncDot;

__ds_ns.TabBar = __ds_scope.TabBar;

})();
