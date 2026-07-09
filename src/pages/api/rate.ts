export const prerender = false;

import type { APIRoute } from 'astro';

const getEnv = (key: string) => {
  return import.meta.env[key] || (typeof process !== 'undefined' ? process.env[key] : undefined);
};

const SUPABASE_URL = "https://msufgvqofnihylcnxyac.supabase.co";
const SUPABASE_SERVICE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

/**
 * Helper to get user via Supabase Auth
 */
async function getSupabaseUser(cookies: string) {
  if (!cookies) return null;
  const match = cookies.match(/sb-msufgvqofnihylcnxyac-auth-token=([^;]+)/);
  if (!match) return null;

  try {
    const sessionData = JSON.parse(decodeURIComponent(match[1]));
    const accessToken = Array.isArray(sessionData) ? sessionData[0] : sessionData.access_token;

    if (!accessToken) return null;

    const anonKey = getEnv('PUBLIC_SUPABASE_ANON_KEY') || 'sb_publishable_XMPIdUpNn_dPH7iKdGK_Zg_J8InT4c9';
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': anonKey
      }
    });

    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    return null;
  }
}

/**
 * GET: Fetches the current user's rating for the specified slug (if logged in)
 */
export const GET: APIRoute = async ({ url, request }) => {
  const slug = url.searchParams.get('slug');
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400 });
  }

  const cookies = (request as any).headers.get('cookie') || '';
  const user = await getSupabaseUser(cookies);

  if (!user) {
    return new Response(JSON.stringify({ hasRated: false, loggedIn: false }), { status: 200 });
  }

  if (!SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Database key not configured' }), { status: 500 });
  }

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/analysis_ratings?user_id=eq.${user.id}&target_slug=eq.${slug}`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });

    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    const data = await resp.json();
    if (data && data.length > 0) {
      return new Response(JSON.stringify({
        hasRated: true,
        loggedIn: true,
        rating: data[0].rating,
        comment: data[0].comment
      }), { status: 200 });
    }

    return new Response(JSON.stringify({ hasRated: false, loggedIn: true }), { status: 200 });
  } catch (err: any) {
    console.error('[API Error in GET /api/rate]', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

/**
 * POST: Inserts or updates the current user's rating for the specified slug
 */
export const POST: APIRoute = async ({ request }) => {
  const cookies = (request as any).headers.get('cookie') || '';
  const user = await getSupabaseUser(cookies);

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Please log in first.' }), { status: 401 });
  }

  if (!SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Database key not configured' }), { status: 500 });
  }

  try {
    const body = await request.json();
    const { slug, rating, comment } = body;

    if (!slug || !rating) {
      return new Response(JSON.stringify({ error: 'Missing slug or rating' }), { status: 400 });
    }

    if (!['S', 'A', 'B', 'C'].includes(rating)) {
      return new Response(JSON.stringify({ error: 'Invalid rating value' }), { status: 400 });
    }

    // Require comment for B and C ratings
    if (['B', 'C'].includes(rating) && (!comment || comment.trim().length < 5)) {
      return new Response(JSON.stringify({ error: '请填写至少5个字的反馈意见，以便我们改进分析算法。' }), { status: 400 });
    }

    // Parse slug: e.g. "300308.SZ-2026-Q1"
    const parts = slug.split('-');
    const company_code = parts[0] || '';
    const year = parseInt(parts[1] || new Date().getFullYear().toString());
    const period = parts[2] || 'FY';

    const payload = {
      user_id: user.id,
      target_slug: slug,
      company_code,
      year,
      period,
      rating,
      comment: ['B', 'C'].includes(rating) ? comment.trim() : null,
      updated_at: new Date().toISOString()
    };

    // PostgREST upsert request
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/analysis_ratings?on_conflict=user_id,target_slug`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[Supabase REST Error]', errText);
      return new Response(JSON.stringify({ error: '保存评分失败，请稍后重试。' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    console.error('[API Error in POST /api/rate]', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
