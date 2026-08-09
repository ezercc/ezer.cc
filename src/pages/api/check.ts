export const prerender = false;

import type { APIRoute } from 'astro';
import { Redis } from '@upstash/redis';
import { brotliDecompressSync } from 'zlib';
import nvdaData from '../../data/nvda_oq_2026fy_en_result_latest.json';
import zhongjiData from '../../data/innolight_300308_sz_2026q1_stream_with_i.frontend.json';

import { createSign, randomUUID } from 'crypto';

function base64UrlEncode(strOrBuffer: string | Buffer): string {
  const buf = Buffer.isBuffer(strOrBuffer) ? strOrBuffer : Buffer.from(strOrBuffer);
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function signTaskUrl(urlStr: string, taskId: string, scope: string): string {
  const privateKey = getEnv('RSA_PRIVATE_KEY');
  if (!privateKey) {
    console.warn('[BFF] RSA_PRIVATE_KEY not set in env. Skipping signature.');
    return urlStr;
  }
  try {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 600; // 10 minutes
    const jti = randomUUID ? randomUUID() : Math.random().toString(36).substring(2, 15);

    const header = {
      alg: "RS256",
      typ: "JWT"
    };

    const payload = {
      task_id: taskId,
      scope,
      aud: "ezer-backend",
      iat,
      exp,
      jti
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const sign = createSign('SHA256');
    sign.update(signingInput);
    sign.end();

    const signature = sign.sign(privateKey);
    const encodedSignature = base64UrlEncode(signature);

    const jwsToken = `${signingInput}.${encodedSignature}`;

    const url = new URL(urlStr);
    url.searchParams.set('sig', jwsToken);
    return url.toString();
  } catch (e) {
    console.error('[BFF] Failed to sign URL:', e);
    return urlStr;
  }
}

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
const PENDING_TASK_EXPIRY = 15 * 60; // Keep task/cache bindings short-lived

type PendingCheckBinding = {
  userId: string;
  taskId: string;
  cacheKey: string;
  indexEntry: string;
  resultUrl: string;
  resultKind: 'brotli' | 'json';
};

function isValidTaskId(taskId: unknown): taskId is string {
  return typeof taskId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(taskId);
}

function getCacheIndexEntry(cacheKey: string): string | null {
  const parts = cacheKey.split(':');
  if (parts.length !== 6 || parts[0] !== 'cache' || parts[1] !== 'check') return null;
  return `${parts[2]}:${parts[3]}:${parts[4]}:${parts[5]}`;
}

function isTaskResultUrl(urlStr: string, taskId: string, kind: 'brotli' | 'json'): boolean {
  try {
    const actual = new URL(urlStr);
    const expectedOrigin = new URL(BACKEND_API).origin;
    const expectedPath = `/api/tasks/${encodeURIComponent(taskId)}/${kind === 'brotli' ? 'result.br.raw' : 'result'}`;
    return actual.origin === expectedOrigin && actual.pathname === expectedPath;
  } catch {
    return false;
  }
}

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

async function consumeFreePlanQuota(uid: string, email: string) {
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_free_plan_quota`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY!,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY!}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_uid: uid,
        p_email: email || null
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[Quota Free RPC Error] Status: ${resp.status}, Body: ${errText}`);
      return null;
    }

    const result = await resp.json();
    if (!Array.isArray(result) || result.length !== 1) {
      console.error('[Quota Free RPC Error] Expected exactly one result row');
      return null;
    }

    const row = result[0];
    if (
      !row || typeof row.allowed !== 'boolean' ||
      typeof row.plan_is_free !== 'boolean' ||
      (row.remaining !== null && !Number.isInteger(row.remaining))
    ) {
      console.error('[Quota Free RPC Error] Invalid result row');
      return null;
    }

    return {
      allowed: row.allowed,
      remaining: row.remaining,
      planIsFree: row.plan_is_free
    };
  } catch (err) {
    console.error('[Quota Free RPC Exception]', err);
    return null;
  }
}

/**
 * Helper to manage quota via Supabase REST
 */
async function checkAndUpdateQuota(user: any) {
  if (!SUPABASE_SERVICE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
    return { allowed: false, configuration_error: true };
  }

  const uid = user.id;
  const email = user.email;

  // 1. Get current plan
  let resp: Response;
  try {
    resp = await fetch(`${SUPABASE_URL}/rest/v1/user_plans?uid=eq.${uid}`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });
  } catch (err) {
    console.error('[Quota Plan Get Exception]', err);
    return { allowed: false };
  }

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`[Quota Plan Get Error] Status: ${resp.status}, Body: ${errText}`);
    return { allowed: false };
  }

  let plans: any;
  try {
    plans = await resp.json();
  } catch (err) {
    console.error('[Quota Plan Get Parse Error]', err);
    return { allowed: false };
  }

  if (!Array.isArray(plans)) {
    console.error('[Quota Plan Get Error] Expected an array response');
    return { allowed: false };
  }

  let plan = null;

  if (plans && plans.length > 0) {
    plan = plans[0];
  }

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.substring(0, 7); // "YYYY-MM"

  // Atomically create and consume the first Free-plan quota. The database
  // advisory lock and unique uid index prevent concurrent first requests from
  // minting extra analyses.
  if (!plan) {
    const freeQuota = await consumeFreePlanQuota(uid, email);
    if (!freeQuota || !freeQuota.planIsFree || !freeQuota.allowed || freeQuota.remaining === null) {
      return { allowed: false };
    }
    return { allowed: true, remaining: freeQuota.remaining };
  }

  // 3. Handle Premium Logic. Stripe webhooks maintain paid_through; the
  // legacy premium_end_date remains only as a temporary compatibility fallback.
  if (plan.plan_type === 'premium') {
    const entitlementEnd = plan.paid_through || plan.premium_end_date;
    const endDate = entitlementEnd ? new Date(entitlementEnd) : null;
    const isActivePremium = endDate && !Number.isNaN(endDate.getTime()) && endDate > new Date();

    if (!isActivePremium) {
      // A cancelled or failed renewal never removes already-paid access early.
      // This downgrade happens only after the server-maintained entitlement end.
      try {
        const downgradeResp = await fetch(`${SUPABASE_URL}/rest/v1/user_plans?uid=eq.${uid}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            plan_type: 'free',
            quota_remaining: 3 - 1,
            last_used_date: today,
            updated_at: new Date().toISOString()
          })
        });

        if (!downgradeResp.ok) {
          const errText = await downgradeResp.text();
          console.error(`[Quota Premium Downgrade Error] Status: ${downgradeResp.status}, Body: ${errText}`);
          return { allowed: false };
        }
      } catch (err) {
        console.error('[Quota Premium Downgrade Exception]', err);
        return { allowed: false };
      }
      return { allowed: true, remaining: 2 };
    }

    // Monthly Reset Logic for Premium
    let remaining = plan.quota_remaining;
    const lastMonth = plan.last_used_date ? plan.last_used_date.substring(0, 7) : "";
    if (lastMonth !== currentMonth) {
      remaining = 0; // Reset to 0 for new month
    }

    // Update quota usage for reporting; active Premium access remains unlimited.
    try {
      const premiumUsageResp = await fetch(`${SUPABASE_URL}/rest/v1/user_plans?uid=eq.${uid}`, {
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

      if (!premiumUsageResp.ok) {
        const errText = await premiumUsageResp.text();
        console.warn(`[Quota Premium Usage Tracking Error] Status: ${premiumUsageResp.status}, Body: ${errText}`);
      }
    } catch (err) {
      console.warn('[Quota Premium Usage Tracking Exception]', err);
    }
    return { allowed: true, remaining: 99 };
  }

  // 4. Monthly reset and Free-plan consumption are performed atomically in
  // Supabase so simultaneous requests cannot reuse the same remaining balance.
  const freeQuota = await consumeFreePlanQuota(uid, email);
  if (!freeQuota) {
    return { allowed: false };
  }
  if (!freeQuota.planIsFree) {
    // The plan changed between the initial read and the RPC; fail closed.
    return { allowed: false };
  }
  if (freeQuota.allowed && freeQuota.remaining !== null) {
    return { allowed: true, remaining: freeQuota.remaining };
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

  if (!user) {
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED'
    }), { status: 401 });
  }

  const quota = await checkAndUpdateQuota(user);
  if ((quota as any).configuration_error) {
    return new Response(JSON.stringify({
      error: 'Database key not configured'
    }), { status: 500 });
  }
  if (!quota.allowed) {
    return new Response(JSON.stringify({
      error: 'Quota exceeded',
      code: 'QUOTA_EXCEEDED'
    }), { status: 403 });
  }
  if ((quota as any).is_reward_quota) {
    isRewardQuota = true;
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

    // 4. Cache Miss - Init task on backend server-side to hide long-term Token,
    // then return task_id and stream URLs for direct browser streaming.
    if (!kv) {
      return new Response(JSON.stringify({ error: 'KV Cache not configured' }), { status: 500 });
    }
    console.log(`[Cache Miss] ${cacheKey}. Initializing backend task from BFF...`);
    const formattedCode = formatSymbol(code);
    const apiPeriod = period === 'full' ? 'FY' : (period || 'FY');

    try {
      const taskResp = await fetch(BACKEND_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BACKEND_TOKEN}`
        },
        body: JSON.stringify({
          code: formattedCode,
          year: parseInt(year || '2024'),
          period: apiPeriod,
          lang: lang === 'en' ? 'en' : 'zh-CN'
        })
      });

      if (!taskResp.ok) {
        const errText = await taskResp.text();
        console.error(`[BFF] Backend task creation failed: ${taskResp.status} - ${errText}`);
        return new Response(JSON.stringify({ error: `Backend task creation failed: ${taskResp.status}` }), { status: 502 });
      }

      const taskData = await taskResp.json();
      const backendOrigin = new URL(BACKEND_API).origin;
      const toAbsolute = (urlStr: string | null | undefined) => {
        if (!urlStr) return null;
        try {
          return new URL(urlStr, `${backendOrigin}/`).toString();
        } catch {
          return null;
        }
      };

      console.log(`[BFF] Task created successfully. Task ID: ${taskData.task_id}`);

      const rawStream = toAbsolute(taskData.stream_url);
      const rawResult = toAbsolute(taskData.result_url);
      const rawResultBr = toAbsolute(taskData.result_br_url);
      const rawResultBrRaw = toAbsolute(taskData.result_br_raw_url);

      if (!isValidTaskId(taskData.task_id)) {
        return new Response(JSON.stringify({ error: 'Backend returned an invalid task ID' }), { status: 502 });
      }

      const resultUrl = rawResultBrRaw || rawResult;
      const resultKind: PendingCheckBinding['resultKind'] = rawResultBrRaw ? 'brotli' : 'json';
      const indexEntry = getCacheIndexEntry(cacheKey);
      if (!resultUrl || !indexEntry || !isTaskResultUrl(resultUrl, taskData.task_id, resultKind)) {
        console.error('[BFF] Backend task returned an invalid result endpoint');
        return new Response(JSON.stringify({ error: 'Backend task returned invalid result metadata' }), { status: 502 });
      }

      const pendingBinding: PendingCheckBinding = {
        userId: user.id,
        taskId: taskData.task_id,
        cacheKey,
        indexEntry,
        resultUrl,
        resultKind
      };
      const pendingKey = `pending:check:${taskData.task_id}`;
      try {
        await kv?.set(pendingKey, JSON.stringify(pendingBinding), { ex: PENDING_TASK_EXPIRY });
      } catch (pendingErr) {
        console.error('[BFF] Failed to persist pending task binding:', pendingErr);
        return new Response(JSON.stringify({ error: 'Failed to prepare cache backfill' }), { status: 500 });
      }

      return new Response(JSON.stringify({
        action: 'direct_stream',
        task_id: taskData.task_id,
        stream_url: rawStream ? signTaskUrl(rawStream, taskData.task_id, 'stream') : null,
        result_url: rawResult ? signTaskUrl(rawResult, taskData.task_id, 'result') : null,
        result_br_url: rawResultBr ? signTaskUrl(rawResultBr, taskData.task_id, 'result_br') : null,
        result_br_raw_url: rawResultBrRaw ? signTaskUrl(rawResultBrRaw, taskData.task_id, 'result_br_raw') : null,
        token: taskData.token || null
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...(isRewardQuota ? { 'X-Using-Reward-Quota': 'true' } : {})
        }
      });

    } catch (taskErr: any) {
      console.error('[BFF] Exception during backend task initialization:', taskErr);
      return new Response(JSON.stringify({ error: `Failed to initialize task: ${taskErr.message}` }), { status: 500 });
    }

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
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400 });
    }
    const { taskId } = body || {};

    const cookies = (request as any).headers.get('cookie') || '';
    const user = await getSupabaseUser(cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), { status: 401 });
    }

    if (!isValidTaskId(taskId)) {
      return new Response(JSON.stringify({ error: 'Invalid task ID' }), { status: 400 });
    }

    const pendingKey = `pending:check:${taskId}`;
    const pendingRaw = await kv.get<string>(pendingKey);
    if (!pendingRaw) {
      return new Response(JSON.stringify({ error: 'Pending task binding not found' }), { status: 404 });
    }

    let binding: PendingCheckBinding;
    try {
      binding = typeof pendingRaw === 'string' ? JSON.parse(pendingRaw) : pendingRaw as unknown as PendingCheckBinding;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid pending task binding' }), { status: 500 });
    }

    if (
      !binding || binding.taskId !== taskId || binding.userId !== user.id ||
      typeof binding.cacheKey !== 'string' || typeof binding.indexEntry !== 'string' ||
      !['brotli', 'json'].includes(binding.resultKind) ||
      !isTaskResultUrl(binding.resultUrl, taskId, binding.resultKind)
    ) {
      return new Response(JSON.stringify({ error: 'Invalid pending task binding' }), { status: 403 });
    }

    const resultResp = await fetch(binding.resultUrl, {
      headers: { 'Authorization': `Bearer ${BACKEND_TOKEN}` },
      redirect: 'error'
    });

    if (!resultResp.ok) {
      console.error(`[BFF Cache Backfill] Failed to pull results: ${resultResp.status}`);
      return new Response(JSON.stringify({ error: `Pull results failed: ${resultResp.status}` }), { status: 502 });
    }

    const uint8Array = new Uint8Array(await resultResp.arrayBuffer());
    let dataToStore: string;

    if (binding.resultKind === 'brotli') {
      try {
        const decompressed = brotliDecompressSync(Buffer.from(uint8Array));
        const parsed = JSON.parse(decompressed.toString('utf8'));
        const stream = Array.isArray(parsed) ? parsed : parsed?.stream;
        if (!Array.isArray(stream)) throw new Error('Unsupported Brotli result shape');
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid Brotli result from backend' }), { status: 502 });
      }
      let binary = '';
      for (const byte of uint8Array) binary += String.fromCharCode(byte);
      dataToStore = btoa(binary);
    } else {
      try {
        const parsed = JSON.parse(Buffer.from(uint8Array).toString('utf8'));
        const stream = Array.isArray(parsed) ? parsed : parsed?.stream;
        if (!Array.isArray(stream)) throw new Error('Unsupported JSON result shape');
        dataToStore = JSON.stringify(parsed);
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON result from backend' }), { status: 502 });
      }
    }

    const committed = await kv.eval<number>(
      `local pending = redis.call('GET', KEYS[1]);
       if not pending or pending ~= ARGV[1] then return 0 end;
       redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3]);
       redis.call('ZADD', KEYS[3], ARGV[4], ARGV[5]);
       redis.call('DEL', KEYS[1]);
       return 1;`,
      [pendingKey, binding.cacheKey, 'analysis_index'],
      [JSON.stringify(binding), dataToStore, CACHE_EXPIRY, Date.now(), binding.indexEntry]
    );

    if (Number(committed) !== 1) {
      return new Response(JSON.stringify({ error: 'Pending task already finalized or expired' }), { status: 409 });
    }

    console.log(`[Cache Stored via BFF Backfill] ${binding.cacheKey}`);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    console.error('[API Error in POST callback]', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

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
