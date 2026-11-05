import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// New projects expose keys as JSON dictionaries; older ones as the legacy single keys.
function projectKey(dictionaryName: string, legacyName: string): string {
  const dictionary = Deno.env.get(dictionaryName);
  if (dictionary) {
    const keys = JSON.parse(dictionary) as Record<string, string>;
    const key = keys.default ?? Object.values(keys)[0];
    if (key) return key;
  }
  const legacy = Deno.env.get(legacyName);
  if (!legacy) throw new Error(`${dictionaryName} / ${legacyName} is not set`);
  return legacy;
}

const url = () => Deno.env.get('SUPABASE_URL')!;

/** Service-role client: bypasses RLS. Use only after checking the caller's access. */
export function adminClient(): SupabaseClient {
  return createClient(url(), projectKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Client acting as the signed-in caller (RLS applies). Returns null when the request has
 * no valid user token. JWT checking is done here rather than by the gateway so the new
 * asymmetric signing keys work too.
 */
export async function userClient(
  request: Request,
): Promise<{ client: SupabaseClient; userId: string } | null> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const client = createClient(
    url(),
    projectKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'),
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await client.auth.getUser(authorization.slice('Bearer '.length));
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Errors are `{ error: CODE }`; the app maps CODE to a Mongolian message. */
export function errorResponse(code: string, status = 400): Response {
  return json({ error: code }, status);
}
