import { lookup } from 'dns/promises';

const CMS_SIGNATURES: Record<string, string[]> = {
  wordpress: ['wp-content', 'wp-includes', 'wp-json', 'wordpress'],
  drupal: ['/sites/default/', 'drupal.js', 'Drupal.settings', 'drupal'],
  prestashop: ['prestashop', '/modules/', 'ps_version'],
  magento: ['Magento', 'Mage.Cookies', '/skin/frontend/'],
  shopify: ['cdn.shopify.com', 'Shopify.theme', 'window.ShopifyAnalytics'],
  joomla: ['/components/com_', '/modules/mod_', 'joomla'],
  wix: ['static.parastorage.com', 'wixpress.com', '_wix'],
  squarespace: ['squarespace', 'static1.squarespace.com'],
};

type AnalyzerPayload = {
  domain: string;
  url: string | null;
  online: boolean;
  status_code: number | null;
  cms: string[];
  technologies: string[];
  ip: string | null;
  title: string;
  keywords: string[];
  emails: string[];
  phones: string[];
  error?: string | null;
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const detectCms = (html: string) => {
  const lower = html.toLowerCase();
  const detected = new Set<string>();
  for (const [cms, signatures] of Object.entries(CMS_SIGNATURES)) {
    if (signatures.some((sig) => lower.includes(sig.toLowerCase()))) {
      detected.add(cms);
    }
  }
  return Array.from(detected.values()).map(
    (cms) => cms.charAt(0).toUpperCase() + cms.slice(1)
  );
};

const extractTitle = (html: string) => {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (match?.[1]) {
    return match[1].replace(/\s+/g, ' ').trim();
  }
  return '';
};

const extractEmails = (text: string) => {
  const regex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  return Array.from(new Set(text.match(regex) ?? [])).slice(0, 5);
};

const extractPhones = (text: string) => {
  const regex = /(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g;
  return Array.from(new Set(text.match(regex) ?? [])).slice(0, 5);
};

const localAnalyzeDomain = async (domain: string): Promise<AnalyzerPayload> => {
  const baseResult: AnalyzerPayload = {
    domain,
    url: null,
    online: false,
    status_code: null,
    cms: ['Unknown'],
    technologies: [],
    ip: null,
    title: '',
    keywords: [],
    emails: [],
    phones: [],
    error: null,
  };

  try {
    const { address } = await lookup(domain);
    baseResult.ip = address;
  } catch {
    baseResult.ip = null;
  }

  const protocols = ['https://', 'http://'];
  let lastError: Error | null = null;

  for (const protocol of protocols) {
    const target = `${protocol}${domain}`;
    try {
      const res = await fetch(target, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
        cache: 'no-store',
      });

      baseResult.status_code = res.status;
      if (res.status >= 500) {
        continue;
      }

      const html = await res.text();
      baseResult.url = target;
      baseResult.online = true;
      baseResult.title = extractTitle(html);
      const cms = detectCms(html);
      if (cms.length > 0) {
        baseResult.cms = cms;
      }
      const textOnly = html.replace(/<[^>]+>/g, ' ');
      baseResult.emails = extractEmails(textOnly);
      baseResult.phones = extractPhones(textOnly);
      return baseResult;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }

  baseResult.error = lastError ? lastError.message : 'Unable to reach domain';
  return baseResult;
};

let backendAnalyzerOffline = false;

const proxyBackend = async (domain: string) => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const backendKey = process.env.NEXT_PUBLIC_BACKEND_API_KEY;
  if (backendKey) {
    headers['x-backend-api-key'] = backendKey;
  }

  const response = await fetch(
    `${backendUrl}/analyzer/analyze/${encodeURIComponent(domain)}`,
    { headers }
  );

  if (!response.ok) {
    return null;
  }
  return response.json();
};

export async function GET(
  req: Request,
  { params }: { params: { domain: string } }
) {
  try {
    const domain = params.domain;
    let payload = null;

    if (!backendAnalyzerOffline) {
      payload = await proxyBackend(domain);
      if (!payload) {
        backendAnalyzerOffline = true;
      }
    }

    if (!payload) {
      payload = await localAnalyzeDomain(domain);
    }

    return Response.json(payload);
  } catch (error) {
    console.error('Erreur analyzer:', error);
    const fallback = await localAnalyzeDomain(params.domain);
    return Response.json(fallback, { status: fallback.online ? 200 : 502 });
  }
}
