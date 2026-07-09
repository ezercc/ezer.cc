import { Redis } from '@upstash/redis';

export const prerender = false; // SSR mode

export async function GET() {
  const kvRestUrl = import.meta.env.UPSTASH_REDIS_KV_REST_API_URL;
  const kvRestToken = import.meta.env.UPSTASH_REDIS_KV_REST_API_TOKEN;
  const kv = new Redis({ url: kvRestUrl, token: kvRestToken });

  // 1. Fetch latest entries from Redis ZSET (up to 1000 items)
  // entries format: "code:year:period:lang"
  const entries = await kv.zrange<string[]>('analysis_index', 0, 1000, { rev: true });

  const baseUrl = import.meta.env.SITE.replace(/\/$/, ''); // Remove trailing slash if any

  // 2. Build XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  for (const entry of entries) {
    const [code, year, period, lang] = entry.split(':');
    const slugCode = code.replace('.', '_');
    const slugPeriod = period === 'full' ? 'FY' : period;
    const slug = `${slugCode}-${year}-${slugPeriod}`;

    const path = lang === 'en' ? `/en/analysis/${slug}` : `/analysis/${slug}`;
    const url = `${baseUrl}${path}`;

    xml += `
  <url>
    <loc>${url}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }

  xml += `
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400', // 7 days
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
