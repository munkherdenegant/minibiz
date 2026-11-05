// Wire's success_url/cancel_url must be http(s), so the hosted page returns here and this
// redirects into the app (ashi://…, or exp://… in Expo Go), which closes the browser.

const ALLOWED = /^(ashi|exp|exps):\/\/[^\s]*$/;

Deno.serve((request) => {
  const to = new URL(request.url).searchParams.get('to');
  if (!to || !ALLOWED.test(to)) return new Response('Invalid return address', { status: 400 });
  return new Response(null, { status: 302, headers: { Location: to } });
});
