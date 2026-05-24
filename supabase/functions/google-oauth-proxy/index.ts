// supabase/functions/google-oauth-proxy/index.ts
//
// Server-side proxy for Google OAuth token endpoints. The browser cannot hold the
// client_secret (it would be world-readable in the JS bundle), but Google's token
// endpoint requires it for both the initial code-exchange AND every refresh — even
// when the original /authorize call used PKCE. So we route those two operations through
// this function, which fetches the secret from Vault per-call and adds it to the request.
//
// Two actions supported on a single POST endpoint:
//   { action: "exchange", client_id, code, code_verifier, redirect_uri }
//      → for the initial OAuth code-for-tokens swap on pairing
//   { action: "refresh", client_id, refresh_token }
//      → for renewing an expired access token
//
// Auth model:
//   * JWT verification is ENABLED on this function — only signed-in OneNest users can
//     invoke it. Supabase verifies the user's JWT on the inbound request automatically.
//   * Internally we use the service_role key to call get_google_calendar_client_secret(),
//     which is itself granted EXECUTE only to service_role (migration 0019). The
//     client_secret never crosses the wire to the browser.
//
// Deployment:
//   supabase functions deploy google-oauth-proxy
//   (no --no-verify-jwt — we WANT the auth gate here)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY come from the function's auto-populated env.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

type ExchangeBody = {
    action: 'exchange';
    client_id: string;
    code: string;
    code_verifier: string;
    redirect_uri: string;
};

type RefreshBody = {
    action: 'refresh';
    client_id: string;
    refresh_token: string;
};

type RequestBody = ExchangeBody | RefreshBody;

type GoogleTokenResponse = {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    id_token?: string;
    error?: string;
    error_description?: string;
};

// CORS headers — Expo's web dev server runs on a different origin than the function host,
// so preflight + actual requests both need permissive headers. Adjust origin if we ever
// tighten this for prod.
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (req.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
        return json(
            { error: 'Function not configured (missing SUPABASE_URL or service role key)' },
            500,
        );
    }

    let body: RequestBody;
    try {
        body = (await req.json()) as RequestBody;
    } catch {
        return json({ error: 'Invalid JSON body' }, 400);
    }

    if (!body || typeof body !== 'object') {
        return json({ error: 'Body must be an object' }, 400);
    }
    if (!body.client_id || typeof body.client_id !== 'string') {
        return json({ error: 'client_id is required' }, 400);
    }

    // Pull client_secret from Vault via the SECURITY DEFINER RPC. service_role is the only
    // identity granted EXECUTE on get_google_calendar_client_secret().
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
    });
    const { data: clientSecret, error: secretErr } = await supabase.rpc(
        'get_google_calendar_client_secret',
    );
    if (secretErr) {
        console.error('Failed to read client_secret from Vault', secretErr);
        return json({ error: 'Could not read client_secret', detail: secretErr.message }, 500);
    }
    if (!clientSecret || typeof clientSecret !== 'string') {
        return json(
            {
                error:
                    'google_calendar_client_secret is empty or not set in Vault. Re-create the Vault secret and try again.',
            },
            500,
        );
    }

    // Build the form payload for Google's token endpoint.
    const params = new URLSearchParams({
        client_id: body.client_id,
        client_secret: clientSecret,
    });

    if (body.action === 'exchange') {
        if (!body.code || !body.code_verifier || !body.redirect_uri) {
            return json(
                { error: 'code, code_verifier, and redirect_uri are required for exchange' },
                400,
            );
        }
        params.set('grant_type', 'authorization_code');
        params.set('code', body.code);
        params.set('code_verifier', body.code_verifier);
        params.set('redirect_uri', body.redirect_uri);
    } else if (body.action === 'refresh') {
        if (!body.refresh_token) {
            return json({ error: 'refresh_token is required for refresh' }, 400);
        }
        params.set('grant_type', 'refresh_token');
        params.set('refresh_token', body.refresh_token);
    } else {
        return json({ error: 'Unknown action. Use "exchange" or "refresh".' }, 400);
    }

    // Talk to Google.
    const googleRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });

    const tokenResponse = (await googleRes.json().catch(() => ({}))) as GoogleTokenResponse;

    if (!googleRes.ok || tokenResponse.error) {
        // Forward Google's status + error fields so the client can branch on them.
        return json(
            {
                error: tokenResponse.error ?? `google_token_endpoint_${googleRes.status}`,
                error_description: tokenResponse.error_description,
            },
            googleRes.status,
        );
    }

    return json(tokenResponse);
});
