// supabase/functions/delete-account/index.ts
//
// Hard-delete the calling user's auth.users row. Used by the Settings →
// Danger zone → Delete account flow (#387). The browser can't run
// auth.admin.deleteUser (that requires service role), so we route it
// through this function which:
//   1. Verifies the caller's JWT (Supabase auto-validates the inbound
//      Authorization: Bearer <token> header when JWT verification is
//      enabled on the function).
//   2. Resolves the user_id from the JWT — we never trust a user_id
//      passed in the request body; that would let a logged-in user
//      delete someone else's account.
//   3. Calls auth.admin.deleteUser(user_id) via the service_role
//      client.
//
// Cascade behavior (best-effort, documented for the audit trail):
//   • The auth.users delete cascades to public.profiles via the
//     standard Supabase profile-mirror FK (ON DELETE CASCADE).
//   • profiles cascade-deletes the user's household_members rows,
//     external co-parent links (child_external_coparents — 0050),
//     and any other tables referencing profiles(id).
//   • Households the user belonged to are NOT automatically deleted.
//     If the user was the only parent, the household becomes
//     orphaned (kids + events stay but nobody can log in to manage
//     them). This is a known limitation; a future hardening pass
//     should either (a) refuse to delete the last parent of a
//     household, or (b) cascade-delete the household when the last
//     parent leaves. Surfacing in the UI with an "Are you sure?"
//     alert covers this for now — the user is informed.
//
// Deployment:
//   supabase functions deploy delete-account
//   (no --no-verify-jwt — we want the auth gate; the function reads
//   the caller's identity from the JWT)
//
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-populated env vars
// in the function's runtime.

import { createClient } from 'jsr:@supabase/supabase-js@2';

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
        return json({ error: 'Server misconfigured' }, 500);
    }

    // Resolve the caller's user_id from the JWT. The function-host
    // validates the JWT before invoking us (JWT verification enabled),
    // but we still need to extract the sub claim. Doing it via the
    // anon client + the inbound Authorization header is the cleanest
    // path — supabase.auth.getUser() validates + returns the row.
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
        return json({ error: 'Missing bearer token' }, 401);
    }
    const userClient = createClient(supabaseUrl, serviceRoleKey, {
        global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } =
        await userClient.auth.getUser();
    if (userError || !userData?.user) {
        return json({ error: 'Invalid session' }, 401);
    }
    const userId = userData.user.id;

    // Service-role client for the actual delete. Kept separate from
    // the user-context client above so the JWT extraction can't
    // accidentally propagate into the admin call.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: deleteError } =
        await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
        return json(
            { error: deleteError.message || 'Delete failed' },
            500,
        );
    }

    return json({ ok: true, deleted_user_id: userId });
});
