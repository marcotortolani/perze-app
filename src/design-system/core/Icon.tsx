import type { CSSProperties } from "react";
import {
  AirplaneTiltIcon,
  AppleLogoIcon,
  ArrowCounterClockwiseIcon,
  ArrowDownIcon,
  ArrowsClockwiseIcon,
  ArrowUpIcon,
  BabyIcon,
  BackspaceIcon,
  BankIcon,
  BarbellIcon,
  BasketIcon,
  BeerBottleIcon,
  BicycleIcon,
  BooksIcon,
  BriefcaseIcon,
  BuildingsIcon,
  BusIcon,
  CalendarIcon,
  CameraIcon,
  CardholderIcon,
  CarIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ChartBarIcon,
  ChartLineUpIcon,
  ChartPieSliceIcon,
  CheckIcon,
  CircleHalfTiltIcon,
  ClockIcon,
  CoffeeIcon,
  CoinsIcon,
  CouchIcon,
  CreditCardIcon,
  DeviceMobileIcon,
  DownloadSimpleIcon,
  DropIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeglassesIcon,
  EyeSlashIcon,
  FingerprintIcon,
  FilmSlateIcon,
  FirstAidKitIcon,
  FlagIcon,
  FlameIcon,
  ForkKnifeIcon,
  FunnelIcon,
  GameControllerIcon,
  GasPumpIcon,
  GiftIcon,
  GlobeIcon,
  GoogleLogoIcon,
  GraduationCapIcon,
  HandCoinsIcon,
  HandshakeIcon,
  HeartbeatIcon,
  HouseIcon,
  KeyIcon,
  LightningIcon,
  ListBulletsIcon,
  ListIcon,
  LockIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  MinusIcon,
  MoneyIcon,
  MusicNotesIcon,
  PackageIcon,
  PawPrintIcon,
  PencilSimpleIcon,
  PhoneIcon,
  PiggyBankIcon,
  PizzaIcon,
  PlusIcon,
  PopcornIcon,
  ReceiptIcon,
  ScalesIcon,
  ScissorsIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  SignOutIcon,
  SoccerBallIcon,
  SquareHalfIcon,
  SquaresFourIcon,
  StethoscopeIcon,
  StorefrontIcon,
  SuitcaseRollingIcon,
  TagIcon,
  TargetIcon,
  TelevisionSimpleIcon,
  TicketIcon,
  ToolboxIcon,
  ToothIcon,
  TrainIcon,
  TrashIcon,
  TrendUpIcon,
  TShirtIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
  WarningIcon,
  WifiHighIcon,
  WrenchIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react/dist/lib/types";

/**
 * Set de íconos de línea — Phosphor (viewBox 256×256, variantes "regular"/
 * "bold"). Reemplaza el set anterior de `lucide-react` (mandato del
 * usuario: ningún ícono de la app sale de esa librería).
 */
// Exportado solo para que `category-icons.test.ts` pueda validar en tiempo
// de test que todo ícono del picker es una clave real — no lo consuma
// código de producción, que debe pasar siempre por `<Icon name="..." />`.
export const ICONS = {
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
  user: UserIcon,
  trend: TrendUpIcon,
  target: TargetIcon,
  "circle-half-tilt": CircleHalfTiltIcon,
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
  // LIB-17: caja de ahorro y cuenta corriente compartían `bank` y se veían
  // idénticas (contrato § 4, item 28) — glifo propio y distinto de `bank`.
  "bank-checking": CardholderIcon,
  // alias de los nombres que usa `lib/seed/demo-household.ts` para categorías —
  // mismo glifo que su alias corto, sin duplicar el import.
  "shopping-cart": ShoppingCartIcon,
  utensils: ForkKnifeIcon,
  "trending-up": TrendUpIcon,
  // B4 — logout (más/ajustes), agregado con el fix de sesión.
  "sign-out": SignOutIcon,
  "square-half": SquareHalfIcon,
  "squares-four": SquaresFourIcon,
  storefront: StorefrontIcon,
  // sumados para ampliar el picker de íconos de categorías (ver
  // src/lib/reference/category-icons.ts) — cubren transporte, casa,
  // salud, ocio, educación, familia, compras, plata y viajes que el set
  // original (pensado para el chrome de la app) no tenía.
  bus: BusIcon,
  train: TrainIcon,
  plane: AirplaneTiltIcon,
  bicycle: BicycleIcon,
  luggage: SuitcaseRollingIcon,
  building: BuildingsIcon,
  couch: CouchIcon,
  key: KeyIcon,
  wrench: WrenchIcon,
  lightning: LightningIcon,
  drop: DropIcon,
  flame: FlameIcon,
  phone: PhoneIcon,
  tv: TelevisionSimpleIcon,
  stethoscope: StethoscopeIcon,
  tooth: ToothIcon,
  eyeglasses: EyeglassesIcon,
  barbell: BarbellIcon,
  ball: SoccerBallIcon,
  music: MusicNotesIcon,
  gamepad: GameControllerIcon,
  popcorn: PopcornIcon,
  ticket: TicketIcon,
  graduation: GraduationCapIcon,
  books: BooksIcon,
  paw: PawPrintIcon,
  baby: BabyIcon,
  shirt: TShirtIcon,
  gift: GiftIcon,
  basket: BasketIcon,
  scissors: ScissorsIcon,
  package: PackageIcon,
  coins: CoinsIcon,
  shield: ShieldCheckIcon,
  scales: ScalesIcon,
  pie: ChartPieSliceIcon,
  toolbox: ToolboxIcon,
  beer: BeerBottleIcon,
  pizza: PizzaIcon,
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
