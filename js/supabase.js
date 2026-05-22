const SUPABASE_URL = 'https://aoasoksilellqvkfwcal.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvYXNva3NpbGVsbHF2a2Z3Y2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0Mjk5NjQsImV4cCI6MjA5NTAwNTk2NH0._YOwQJtzry2HvtD03chi19rvOhQ8L6fzf_uMzweNdus';

let _supabase = null;
let _accessToken = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: _accessToken ? { Authorization: `Bearer ${_accessToken}` } : {}
      }
    });
  }
  return _supabase;
}

function setAccessToken(token) {
  _accessToken = token;
  _supabase = null; // reset client so next call uses new token
}

// AUTH
async function authWithTelegram(initData) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/swapph-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || JSON.stringify(data));
  return data;
}

// LISTINGS
async function getListings({ category, type, city } = {}) {
  let query = getSupabase()
    .from('listings')
    .select(`
      id, title, category, type, price, size, condition,
      location, city, available_from, available_until,
      created_at, language,
      listing_photos(url, order_index),
      users(id, name, telegram_handle, avatar_url, created_at)
    `)
    .eq('is_active', true)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false });

  if (category && category !== 'all') query = query.eq('category', category);
  if (type && type !== 'all') query = query.eq('type', type);
  if (city) query = query.eq('city', city);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function getListing(id) {
  const { data, error } = await getSupabase()
    .from('listings')
    .select(`
      *,
      listing_photos(url, order_index),
      users(id, telegram_id, name, telegram_handle, instagram, avatar_url, created_at)
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function createListing(listing) {
  const { data, error } = await getSupabase()
    .from('listings')
    .insert(listing)
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

async function updateListing(id, updates) {
  const { error } = await getSupabase()
    .from('listings')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

async function closeListing(id) {
  return updateListing(id, { is_active: false });
}

async function getMyListings(userId) {
  const { data, error } = await getSupabase()
    .from('listings')
    .select(`*, listing_photos(url, order_index)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// WANTS
async function getWantsCount(listingId) {
  const { count, error } = await getSupabase()
    .from('wants')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId);
  if (error) return 0;
  return count;
}

async function hasWanted(listingId, userId) {
  const { data } = await getSupabase()
    .from('wants')
    .select('id')
    .eq('listing_id', listingId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

async function addWant(listingId, userId) {
  const { error } = await getSupabase()
    .from('wants')
    .insert({ listing_id: listingId, user_id: userId });
  if (error) throw error;
}

async function hasAnyListing(userId) {
  const { count } = await getSupabase()
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count > 0;
}

// PHOTOS
async function uploadPhoto(listingId, file, index) {
  const ext = file.name.split('.').pop();
  const fileName = `${index}_${Date.now()}.${ext}`;
  const path = `${listingId}/${fileName}`;

  const { error } = await getSupabase()
    .storage
    .from('listing-photos')
    .upload(path, file, { contentType: file.type });
  if (error) throw error;

  const { data } = getSupabase()
    .storage
    .from('listing-photos')
    .getPublicUrl(path);

  return data.publicUrl;
}

async function savePhotos(listingId, urls) {
  const photos = urls.map((url, i) => ({
    listing_id: listingId,
    url,
    order_index: i
  }));
  const { error } = await getSupabase().from('listing_photos').insert(photos);
  if (error) throw error;
}

// USERS
async function getUser(userId) {
  const { data, error } = await getSupabase()
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function updateUser(userId, updates) {
  const { error } = await getSupabase()
    .from('users')
    .update(updates)
    .eq('id', userId);
  if (error) throw error;
}

// METRICS (admin)
async function getMetrics() {
  const sb = getSupabase();

  const [usersRes, activeRes, allRes, wantsRes, photosRes, recentRes] = await Promise.all([
    sb.from('users').select('*', { count: 'exact', head: true }),
    sb.from('listings').select('id, type, created_at').eq('is_active', true),
    sb.from('listings').select('*', { count: 'exact', head: true }),
    sb.from('wants').select('*', { count: 'exact', head: true }),
    sb.from('listing_photos').select('*', { count: 'exact', head: true }),
    sb.from('listings')
      .select('id, title, type, created_at, listing_photos(url, order_index)')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const active = activeRes.data || [];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    users: usersRes.count || 0,
    listings: {
      active: active.length,
      total: allRes.count || 0,
      swap: active.filter(l => l.type === 'swap').length,
      sale: active.filter(l => l.type === 'sale').length,
      free: active.filter(l => l.type === 'free').length,
      newThisWeek: active.filter(l => l.created_at > weekAgo).length,
    },
    wants: wantsRes.count || 0,
    photos: photosRes.count || 0,
    recent: recentRes.data || [],
  };
}

// NOTIFICATIONS — fire and forget
async function notifyOwner(ownerTelegramId, listingTitle, wanterName) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/swapph-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${_accessToken}`
      },
      body: JSON.stringify({ ownerTelegramId, listingTitle, wanterName })
    });
  } catch (_) {}
}
