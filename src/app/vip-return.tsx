import { Redirect } from 'expo-router';

// Wire's hosted page returns to ashi://vip-return (through the wire-return Edge Function).
// The in-app browser picks that link up; if the router also receives it, land on the VIP
// screen. Signed-out users are sent to login by the root layout's guards.
export default function VipReturn() {
  return <Redirect href="/profile/vip" />;
}
