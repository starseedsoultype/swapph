import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 1. Validate the caller's token — they must prove they own this account
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // 2. Service role client for all deletions (bypasses RLS)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Get listing IDs and photo URLs before deleting anything
    const { data: listings } = await admin
      .from('listings')
      .select('id, listing_photos(url)')
      .eq('user_id', userId);

    const listingIds: string[] = (listings || []).map((l: any) => l.id);
    const photoUrls: string[] = (listings || []).flatMap((l: any) =>
      (l.listing_photos || []).map((p: any) => p.url)
    );

    // 4. Delete wants made BY this user (on other listings)
    await admin.from('wants').delete().eq('user_id', userId);

    // 5. Delete wants made BY OTHERS on this user's listings
    if (listingIds.length > 0) {
      await admin.from('wants').delete().in('listing_id', listingIds);
    }

    // 6. Delete listing_photos explicitly (listings CASCADE would also cover this)
    if (listingIds.length > 0) {
      await admin.from('listing_photos').delete().in('listing_id', listingIds);
    }

    // 7. Delete listings (FK constraint now clear)
    await admin.from('listings').delete().eq('user_id', userId);

    // 8. Delete public.users record
    await admin.from('users').delete().eq('id', userId);

    // 9. Delete storage files
    // URL format: https://{project}.supabase.co/storage/v1/object/public/listing-photos/{listingId}/{filename}
    const storagePaths = photoUrls
      .map((url: string) => {
        const match = url.match(/\/listing-photos\/(.+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];

    if (storagePaths.length > 0) {
      await admin.storage.from('listing-photos').remove(storagePaths);
    }

    // 10. Delete auth.users — prevents silent re-creation on next login attempt
    await admin.auth.admin.deleteUser(userId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('swapph-delete-account error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
