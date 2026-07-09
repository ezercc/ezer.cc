export const prerender = false;

import type { APIRoute } from 'astro';
import { Redis } from '@upstash/redis';
import { brotliDecompressSync } from 'zlib';
import nvdaData from '../../data/nvda_oq_2026fy_en_result_latest.json';
import zhongjiData from '../../data/innolight_300308_sz_2026q1_stream_with_i.frontend.json';

const getEnv = (key: string) => {
  return import.meta.env[key] || (typeof process !== 'undefined' ? process.env[key] : undefined);
};

const kvRestUrl = getEnv('UPSTASH_REDIS_KV_REST_API_URL');
const kvRestToken = getEnv('UPSTASH_REDIS_KV_REST_API_TOKEN');

const SUPABASE_URL = "https://msufgvqofnihylcnxyac.supabase.co";
const SUPABASE_SERVICE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const kv = (kvRestUrl && kvRestToken)
  ? new Redis({ url: kvRestUrl, token: kvRestToken })
  : null;

const API_BASE = (getEnv('EZER_AUDIT_API_BASE') || "https://api.ezer.cc").replace(/\/$/, "");
const BACKEND_API = `${API_BASE}/api/tasks`;
const BACKEND_TOKEN = getEnv('BACKEND_TOKEN');
const CACHE_EXPIRY = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Helper to decompress Brotli data from a Base64 string
 */
function decompressBrotliBase64(base64Str: string): any {
  try {
    const buffer = Buffer.from(base64Str, 'base64');
    const decompressed = brotliDecompressSync(buffer);
    const jsonStr = decompressed.toString('utf8');
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('[Brotli Decompression Error]', err);
    return null;
  }
}

/**
 * Helper to get user via Supabase Auth
 */
async function getSupabaseUser(cookies: string) {
  if (!cookies) {
    console.log('[Auth] No cookies found in request.');
    return null;
  }
  const match = cookies.match(/sb-msufgvqofnihylcnxyac-auth-token=([^;]+)/);
  if (!match) {
    console.log('[Auth] Supabase auth token cookie not found.');
    return null;
  }

  try {
    const sessionData = JSON.parse(decodeURIComponent(match[1]));
    const accessToken = Array.isArray(sessionData) ? sessionData[0] : sessionData.access_token;

    if (!accessToken) {
      console.warn('[Auth] Access token not found in parsed cookie session data.');
      return null;
    }

    const anonKey = getEnv('PUBLIC_SUPABASE_ANON_KEY') || 'sb_publishable_XMPIdUpNn_dPH7iKdGK_Zg_J8InT4c9';
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': anonKey
      }
    });

    if (!resp.ok) {
      const statusText = await resp.text();
      console.error(`[Auth] Failed to authenticate token via Supabase: ${resp.status} - ${statusText}`);
      return null;
    }
    const userData = await resp.json();
    console.log(`[Auth] Successfully authenticated user: ${userData.id} (${userData.email})`);
    return userData;
  } catch (e) {
    console.error('[Auth] Exception while parsing/authenticating user session:', e);
    return null;
  }
}

/**
 * Helper to manage quota via Supabase REST
 */
async function checkAndUpdateQuota(user: any) {
  if (!SUPABASE_SERVICE_KEY) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not configured, skipping quota check');
    return { allowed: true };
  }

  const uid = user.id;
  const email = user.email;

  // 1. Get current plan
  let resp = await fetch(`${SUPABASE_URL}/rest/v1/user_plans?uid=eq.${uid}`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });

  let plan = null;
  const plans = await resp.json();

  if (plans && plans.length > 0) {
    plan = plans[0];
  } else {
    // 2. Create default free plan if not exists
    const newPlan = {
      uid,
      email,
      plan_type: 'free',
      quota_remaining: 3,
      last_used_date: new Date().toISOString().split('T')[0]
    };

    await fetch(`${SUPABASE_URL}/rest/v1/user_plans`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(newPlan)
    });
    return { allowed: true, remaining: 2 }; // Just used one
  }

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.substring(0, 7); // "YYYY-MM"

  // 3. Handle Premium Logic
  if (plan.plan_type === 'premium') {
    // Check for Expiry
    if (plan.premium_end_date) {
      const endDate = new Date(plan.premium_end_date);
      if (endDate < new Date()) {
        // Plan Expired: Revert to free
        await fetch(`${SUPABASE_URL}/rest/v1/user_plans?uid=eq.${uid}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            plan_type: 'free',
            quota_remaining: 3 - 1, // Reset to 3 but consume one
            last_used_date: today,
            updated_at: new Date().toISOString()
          })
        });
        return { allowed: true, remaining: 2 };
      }
    }

    // Monthly Reset Logic for Premium
    let remaining = plan.quota_remaining;
    const lastMonth = plan.last_used_date ? plan.last_used_date.substring(0, 7) : "";
    if (lastMonth !== currentMonth) {
      remaining = 0; // Reset to 0 for new month
    }

    // Update Quota (minus values show usage)
    await fetch(`${SUPABASE_URL}/rest/v1/user_plans?uid=eq.${uid}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quota_remaining: remaining - 1,
        last_used_date: today,
        updated_at: new Date().toISOString()
      })
    });
    return { allowed: true, remaining: 99 };
  }

  // 4. Monthly Reset Logic for Free Users (changed from Daily to Monthly reset)
  let remaining = plan.quota_remaining;
  const lastMonth = plan.last_used_date ? plan.last_used_date.substring(0, 7) : "";
  if (lastMonth !== currentMonth) {
    remaining = 3; // Reset to 3 for the new month
  }

  // 5. If plan quota is available, consume it
  if (remaining > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/user_plans?uid=eq.${uid}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quota_remaining: remaining - 1,
        last_used_date: today,
        updated_at: new Date().toISOString()
      })
    });
    return { allowed: true, remaining: remaining - 1 };
  }

  // 6. If plan quota is exhausted, consume invitation/referral quota
  console.log(`[Quota] Plan quota exhausted for ${uid}. Attempting to consume invitation/referral quota...`);
  
  try {
    // 调用 Supabase 存储过程（RPC）来扣减邀请/受邀额度
    const rpcResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_user_quota_array`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: uid,
        consume_amount: 1
      })
    });

    if (rpcResp.ok) {
      const success = await rpcResp.json();
      if (success === true) {
        console.log(`[Quota] Successfully consumed 1 invitation quota via RPC for ${uid}`);
        return { allowed: true, remaining: 0, is_reward_quota: true };
      } else {
        console.warn(`[Quota] RPC returned false (insufficient reward quota) for ${uid}`);
      }
    } else {
      const errText = await rpcResp.text();
      console.error(`[Quota RPC Error] Status: ${rpcResp.status}, Body: ${errText}`);
    }
  } catch (rpcErr) {
    console.error('[Quota RPC Exception]', rpcErr);
  }

  // 7. Fallback: 如果 RPC 故障或报错，手动在 JS 里校验并扣减邀请/受邀额度（自愈模式）
  console.warn('[Quota] RPC failed or returned false. Running JS fallback for invitee/inviter quota...');
  try {
    const [profResp, invResp] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }),
      fetch(`${SUPABASE_URL}/rest/v1/invitations?user_id=eq.${uid}`, {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      })
    ]);

    if (!profResp.ok) {
      const errTxt = await profResp.text();
      console.error(`[Quota Fallback Profile Get Error] Status: ${profResp.status}, Body: ${errTxt}`);
      return { allowed: false };
    }

    const profiles = await profResp.json();
    if (!profiles || profiles.length === 0) {
      console.error(`[Quota Fallback] Profile not found for ${uid}`);
      return { allowed: false };
    }

    const profile = profiles[0];
    const regDate = new Date(profile.created_at);
    const expireDate = new Date(regDate);
    expireDate.setMonth(expireDate.getMonth() + 1);

    let inviteeAvailable = 0;
    if (profile.referred_by && expireDate > new Date()) {
      inviteeAvailable = Math.max(0, 3 - (profile.invitee_quota_used || 0));
    }

    let inviterAvailable = 0;
    let inviterRecord = null;
    if (invResp.ok) {
      const invitations = await invResp.json();
      if (invitations && invitations.length > 0) {
        inviterRecord = invitations[0];
        inviterAvailable = inviterRecord.remaining_uses || 0;
      }
    }

    console.log(`[Quota Fallback Check] User ${uid}: inviteeAvailable=${inviteeAvailable}, inviterAvailable=${inviterAvailable}`);

    if (inviteeAvailable + inviterAvailable < 1) {
      console.log(`[Quota Fallback] No available reward quota for ${uid}`);
      return { allowed: false };
    }

    // 优先扣减被邀请人额度
    if (inviteeAvailable > 0) {
      const used = profile.invitee_quota_used || 0;
      const patchResp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invitee_quota_used: used + 1,
          updated_at: new Date().toISOString()
        })
      });

      if (patchResp.ok) {
        console.log(`[Quota Fallback] Successfully consumed 1 invitee quota for ${uid}. Remaining: ${3 - (used + 1)}`);
        return { allowed: true, remaining: 0, is_reward_quota: true };
      } else {
        const errTxt = await patchResp.text();
        console.error(`[Quota Fallback PATCH Profile Error] Status: ${patchResp.status}, Body: ${errTxt}`);
      }
    } 
    // 其次扣减邀请人奖励额度
    else if (inviterAvailable > 0) {
      const patchResp = await fetch(`${SUPABASE_URL}/rest/v1/invitations?user_id=eq.${uid}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          remaining_uses: inviterAvailable - 1,
          updated_at: new Date().toISOString()
        })
      });

      if (patchResp.ok) {
        console.log(`[Quota Fallback] Successfully consumed 1 inviter quota for ${uid}. Remaining: ${inviterAvailable - 1}`);
        return { allowed: true, remaining: 0, is_reward_quota: true };
      } else {
        const errTxt = await patchResp.text();
        console.error(`[Quota Fallback PATCH Invitation Error] Status: ${patchResp.status}, Body: ${errTxt}`);
      }
    }
  } catch (fallbackErr) {
    console.error('[Quota Fallback Exception]', fallbackErr);
  }

  // 8. 确实没有可用额度了
  return { allowed: false };
}

/**
 * GET: Handles cache checking or redirects browser to direct backend fetch.
 */
export const GET: APIRoute = async ({ url, request }) => {
  const code = url.searchParams.get('code');
  const year = url.searchParams.get('year');
  const period = url.searchParams.get('period');
  const preview = url.searchParams.get('preview') === 'true';
  let lang = url.searchParams.get('lang') || 'zh';
  if (lang === 'zh-CN') lang = 'zh'; // Force normalization

  // 1. Handle "No Parameters" or "Preview" case - Load sample data
  if (preview || (!code && !year && !period)) {
    const previewData = lang === 'en' ? nvdaData.stream : zhongjiData.stream;
    return createDelayedStream(previewData);
  }

  // 1.5 Quota Enforcement (Server Side)
  const cookies = (request as any).headers.get('cookie') || '';
  const user = await getSupabaseUser(cookies);
  let isRewardQuota = false;

  if (user) {
    const quota = await checkAndUpdateQuota(user);
    if (!quota.allowed) {
      return new Response(JSON.stringify({
        error: 'Quota exceeded',
        code: 'QUOTA_EXCEEDED'
      }), { status: 403 });
    }
    if ((quota as any).is_reward_quota) {
      isRewardQuota = true;
    }
  }

  // 2. Cache Key
  const cacheKey = `cache:check:${code}:${year}:${period}:${lang}`;

  try {
    // 3. Check KV Cache
    if (kv) {
      // Use Lua script to GET and EXPIRE in one atomic command (1 command cost)
      let cachedData = await kv.eval<any>(
        "local val = redis.call('GET', KEYS[1]); if val then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return val;",
        [cacheKey],
        [CACHE_EXPIRY]
      );

      if (cachedData) {
        console.log(`[Cache Hit & Extended] ${cacheKey}`);
        
        let streamEvents = cachedData;
        
        // Handle decompression or parsing depending on format
        if (typeof cachedData === 'string') {
          try {
            // Try parsing as plain JSON first
            const parsed = JSON.parse(cachedData);
            if (Array.isArray(parsed)) {
              streamEvents = parsed;
            } else if (parsed && Array.isArray(parsed.stream)) {
              streamEvents = parsed.stream;
            } else {
              // Not standard array, try treating it as Brotli Base64
              const decompressed = decompressBrotliBase64(cachedData);
              if (decompressed) {
                streamEvents = Array.isArray(decompressed) ? decompressed : (decompressed.stream || decompressed);
              }
            }
          } catch (e) {
            // Parsing as JSON failed, so treat as Brotli Base64
            const decompressed = decompressBrotliBase64(cachedData);
            if (decompressed) {
              streamEvents = Array.isArray(decompressed) ? decompressed : (decompressed.stream || decompressed);
            }
          }
        } else if (cachedData && Array.isArray(cachedData.stream)) {
          streamEvents = cachedData.stream;
        }

        if (Array.isArray(streamEvents)) {
          return createDelayedStream(streamEvents, isRewardQuota ? { 'X-Using-Reward-Quota': 'true' } : undefined);
        } else {
          console.warn(`[Cache Corrupted or Invalid Format] ${cacheKey}`);
        }
      }
    }

    // 4. Cache Miss - In our new logic, we return the info for DIRECT browser fetch
    // to bypass Vercel serverless function 10s timeout.
    console.log(`[Cache Miss] ${cacheKey}. Redirecting frontend to direct fetch...`);

    const formattedCode = formatSymbol(code);
    const apiPeriod = period === 'full' ? 'FY' : (period || 'FY');

    return new Response(JSON.stringify({
      action: 'direct_fetch',
      config: {
        api: BACKEND_API,
        token: BACKEND_TOKEN,
        params: {
          code: formattedCode,
          year: parseInt(year || '2024'),
          period: apiPeriod,
          lang: lang === 'en' ? 'en' : 'zh-CN' // Keep backend happy if it NEEDS zh-CN, but our cacheKey is already normalized
        }
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...(isRewardQuota ? { 'X-Using-Reward-Quota': 'true' } : {})
      }
    });

  } catch (err: any) {
    console.error('[API Error in GET]', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

/**
 * POST: Allows frontend to save results into cache after completion.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV Cache not configured' }), { status: 500 });
  }

  try {
    const body = await request.json();
    const { cacheKey, data } = body;

    if (!cacheKey || !data) {
      return new Response(JSON.stringify({ error: 'Missing cacheKey or data' }), { status: 400 });
    }

    await kv.set(cacheKey, data, { ex: CACHE_EXPIRY });

    // Track in ZSET for Sitemap (uses timestamp as score)
    try {
      const parts = cacheKey.split(':'); // cache:check:code:year:period:lang
      if (parts.length >= 6) {
        const entry = `${parts[2]}:${parts[3]}:${parts[4]}:${parts[5]}`;
        await kv.zadd('analysis_index', { score: Date.now(), member: entry });
      }
    } catch (zerr) {
      console.warn('[ZSET Error]', zerr);
    }

    console.log(`[Cache Stored via POST] ${cacheKey}`);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    console.error('[API Error in POST callback]', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

/**
 * Creates a ReadableStream that outputs JSON lines with artificial delays
 * Only used for cached results or preview data to maintain "Analysis" aesthetic.
 */
function createDelayedStream(data: any[], customHeaders?: Record<string, string>) {
  const encoder = new TextEncoder();

  // Group events
  const groupA = data.filter(item => {
    const p = (item.producer || '').toUpperCase();
    return p === 'A' || p === 'NORMALIZER' || item.event === 'task_started';
  });

  const groupB = data.filter(item => {
    const p = (item.producer || '').toUpperCase();
    return p === 'B' || p === 'ANALYZER';
  });

  const groupI = data.filter(item => {
    const p = (item.producer || '').toUpperCase();
    return p === 'I' || p === 'INDUSTRY';
  });

  const groupC = data.filter(item => {
    const p = (item.producer || '').toUpperCase();
    const e = item.event || '';
    return p === 'C' || p === 'AUDITOR' || e.includes('summary') || e.includes('result');
  });

  const stream = new ReadableStream({
    async start(controller) {
      const send = async (item: any, delay = 4000) => {
        controller.enqueue(encoder.encode(JSON.stringify(item) + '\n'));
        await new Promise(r => setTimeout(r, delay));
      };

      for (const item of groupA) await send(item, 2000);

      if (groupB.length > 0) {
        await new Promise(r => setTimeout(r, 5000));
        for (const item of groupB) await send(item, 2000);
      }

      if (groupI.length > 0) {
        await new Promise(r => setTimeout(r, 5000));
        for (const item of groupI) await send(item, 2000);
      }

      if (groupC.length > 0) {
        await new Promise(r => setTimeout(r, 5000));
        for (const item of groupC) await send(item, 2000);
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache, no-transform',
      'Transfer-Encoding': 'chunked',
      'Connection': 'keep-alive',
      ...customHeaders
    }
  });
}

function formatSymbol(codeParam: string | null): string {
  if (!codeParam) return '';
  if (codeParam.includes('.')) return codeParam;
  const match = codeParam.match(/^([a-z]+)(\d+)$/i);
  if (match) {
    return `${match[2]}.${match[1].toUpperCase()}`;
  }
  return codeParam;
}
