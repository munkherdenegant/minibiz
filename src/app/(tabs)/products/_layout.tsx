import { StackLayout } from '@/components/stack-layout';
import { mn } from '@/i18n/mn';

// Keep the list screen under any screen opened directly (e.g. from Home's quick
// actions), so back and the header back button always have somewhere to go.
export const unstable_settings = { anchor: 'index' };

export default function ProductsLayout() {
  return <StackLayout title={mn.tabs.products} />;
}
