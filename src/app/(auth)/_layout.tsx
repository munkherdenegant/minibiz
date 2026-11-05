import { Stack } from 'expo-router';

// Login is always underneath, so "back to login" works after a direct visit.
export const unstable_settings = { anchor: 'login' };

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
