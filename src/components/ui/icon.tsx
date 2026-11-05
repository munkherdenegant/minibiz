import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';

// SF Symbols on iOS, Material Symbols on Android and web.
const icons = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  products: { ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' },
  sales: { ios: 'cart.fill', android: 'shopping_cart', web: 'shopping_cart' },
  finance: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
  profile: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },
  calendar: { ios: 'calendar', android: 'calendar_today', web: 'calendar_today' },
  mail: { ios: 'envelope', android: 'mail', web: 'mail' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  photo: { ios: 'photo', android: 'add_photo_alternate', web: 'add_photo_alternate' },
  phone: { ios: 'phone', android: 'call', web: 'call' },
  store: { ios: 'storefront', android: 'storefront', web: 'storefront' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  remove: { ios: 'minus', android: 'remove', web: 'remove' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  archive: { ios: 'archivebox', android: 'archive', web: 'archive' },
  unarchive: { ios: 'arrow.uturn.backward', android: 'unarchive', web: 'unarchive' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  expense: { ios: 'minus.circle', android: 'remove_circle', web: 'remove_circle' },
  income: { ios: 'plus.circle', android: 'add_circle', web: 'add_circle' },
  list: { ios: 'list.bullet', android: 'list', web: 'list' },
  star: { ios: 'star.fill', android: 'star', web: 'star' },
  warning: {
    ios: 'exclamationmark.triangle',
    android: 'warning',
    web: 'warning',
  },
  logout: {
    ios: 'rectangle.portrait.and.arrow.right',
    android: 'logout',
    web: 'logout',
  },
} as const;

export type IconName = keyof typeof icons;

export function Icon({
  name,
  size = 24,
  color,
}: {
  name: IconName;
  size?: number;
  color: ColorValue;
}) {
  return <SymbolView name={icons[name]} size={size} tintColor={color} />;
}
