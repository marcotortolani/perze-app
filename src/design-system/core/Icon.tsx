import type { CSSProperties } from "react";
import {
  AppleLogoIcon,
  ArrowCounterClockwiseIcon,
  ArrowDownIcon,
  ArrowsClockwiseIcon,
  ArrowUpIcon,
  BackspaceIcon,
  BankIcon,
  BriefcaseIcon,
  CalendarIcon,
  CameraIcon,
  CarIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ChartBarIcon,
  ChartLineUpIcon,
  CheckIcon,
  ClockIcon,
  CoffeeIcon,
  CreditCardIcon,
  DeviceMobileIcon,
  DownloadSimpleIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  FingerprintIcon,
  FilmSlateIcon,
  FirstAidKitIcon,
  FlagIcon,
  ForkKnifeIcon,
  FunnelIcon,
  GasPumpIcon,
  GlobeIcon,
  GoogleLogoIcon,
  HandCoinsIcon,
  HandshakeIcon,
  HeartbeatIcon,
  HouseIcon,
  ListBulletsIcon,
  ListIcon,
  LockIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  MinusIcon,
  MoneyIcon,
  PencilSimpleIcon,
  PiggyBankIcon,
  PlusIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  TagIcon,
  TargetIcon,
  TrashIcon,
  TrendUpIcon,
  UsersIcon,
  WalletIcon,
  WarningIcon,
  WifiHighIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react/dist/lib/types";

/**
 * Set de íconos de línea — Phosphor (viewBox 256×256, variantes "regular"/
 * "bold"). Reemplaza el set anterior de `lucide-react` (mandato del
 * usuario: ningún ícono de la app sale de esa librería).
 */
const ICONS = {
  cart: ShoppingCartIcon,
  "arrow-up": ArrowUpIcon,
  "arrow-down": ArrowDownIcon,
  food: ForkKnifeIcon,
  car: CarIcon,
  home: HouseIcon,
  check: CheckIcon,
  alert: WarningIcon,
  close: XIcon,
  clock: ClockIcon,
  backspace: BackspaceIcon,
  search: MagnifyingGlassIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  list: ListBulletsIcon,
  chart: ChartBarIcon,
  more: ListIcon,
  wallet: WalletIcon,
  coffee: CoffeeIcon,
  fuel: GasPumpIcon,
  chevron: CaretRightIcon,
  "chevron-left": CaretLeftIcon,
  "chevron-down": CaretDownIcon,
  calendar: CalendarIcon,
  eye: EyeIcon,
  "eye-off": EyeSlashIcon,
  refresh: ArrowsClockwiseIcon,
  users: UsersIcon,
  trend: TrendUpIcon,
  target: TargetIcon,
  filter: FunnelIcon,
  edit: PencilSimpleIcon,
  globe: GlobeIcon,
  trash: TrashIcon,
  wifi: WifiHighIcon,
  bank: BankIcon,
  invest: ChartLineUpIcon,
  undo: ArrowCounterClockwiseIcon,
  mic: MicrophoneIcon,
  camera: CameraIcon,
  pharmacy: FirstAidKitIcon,
  tag: TagIcon,
  // sumados en el port a TSX — ver docs/perze-plan-redesign-first-5-blocks.md § Fase 3
  mail: EnvelopeIcon,
  google: GoogleLogoIcon,
  apple: AppleLogoIcon,
  lock: LockIcon,
  fingerprint: FingerprintIcon,
  install: DownloadSimpleIcon,
  flag: FlagIcon,
  "piggy-bank": PiggyBankIcon,
  "credit-card": CreditCardIcon,
  smartphone: DeviceMobileIcon,
  banknote: MoneyIcon,
  handshake: HandshakeIcon,
  receipt: ReceiptIcon,
  "heart-pulse": HeartbeatIcon,
  film: FilmSlateIcon,
  briefcase: BriefcaseIcon,
  // ícono propio de "cuenta corriente", distinto de `piggy-bank` (caja de
  // ahorro) — ver perze-brand/assets/README.md, pendiente histórico.
  "hand-coins": HandCoinsIcon,
  // alias de los nombres que usa `lib/seed/demo-household.ts` para categorías —
  // mismo glifo que su alias corto, sin duplicar el import.
  "shopping-cart": ShoppingCartIcon,
  utensils: ForkKnifeIcon,
  "trending-up": TrendUpIcon,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  /** Glifo del set de íconos de línea del sistema. */
  name: IconName;
  /** Caja renderizada en px. 20 en filas, 24 en nav, 26 en category bubbles. */
  size?: number | undefined;
  /** 1.5 por defecto (peso "regular"); 2.5 para status badges (peso "bold"). */
  strokeWidth?: number | undefined;
  color?: string | undefined;
  style?: CSSProperties | undefined;
}

/**
 * Ícono de línea del sistema. Regla dura: todo ícono tiene que ser
 * tocable o portar significado — nunca decorativo.
 */
export function Icon({ name, size = 20, strokeWidth = 1.5, color = "currentColor", style, ...rest }: IconProps) {
  const Glyph = ICONS[name];
  if (!Glyph) return null;
  return (
    <Glyph
      width={size}
      height={size}
      color={color}
      weight={strokeWidth >= 2 ? "bold" : "regular"}
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0, ...style }}
      {...rest}
    />
  );
}
