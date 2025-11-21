export const dynamic = 'force-dynamic';
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL doit être configuré pour /service/admin');
}
if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY est requis pour /service/admin');
}
if (!anonKey) {
  throw new Error('SUPABASE_ANON_KEY est requis pour /service/admin');
}

const restHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

type AdminCheckResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

async function ensureAdmin(authHeader: string | null): Promise<AdminCheckResult> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Token manquant' };
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: anonKey,
    },
  });

  if (!userResponse.ok) {
    return { ok: false, status: 401, message: 'Utilisateur non authentifié' };
  }

  const user = await userResponse.json();
  const userId = user?.id;
  if (!userId) {
    return { ok: false, status: 401, message: 'Utilisateur invalide' };
  }

  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role`,
    {
      headers: restHeaders,
    }
  );

  if (!profileResponse.ok) {
    console.error('Erreur chargement profil admin:', await profileResponse.text());
    return { ok: false, status: 500, message: 'Erreur profil' };
  }

  const profiles = await profileResponse.json();
  const role = profiles?.[0]?.role;

  if (role !== 'admin') {
    return { ok: false, status: 403, message: 'Accès refusé' };
  }

  return { ok: true };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const resource = searchParams.get('resource');

    if (resource !== 'tickets') {
      return new Response(JSON.stringify({ error: 'Ressource inconnue' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const adminCheck = await ensureAdmin(req.headers.get('authorization'));
    if (!adminCheck.ok) {
      return new Response(JSON.stringify({ error: adminCheck.message }), {
        status: adminCheck.status,
        headers: { 'content-type': 'application/json' },
      });
    }

    const ticketsResponse = await fetch(
      `${supabaseUrl}/rest/v1/tickets?select=*&order=created_at.desc`,
      {
        headers: restHeaders,
      }
    );

    if (!ticketsResponse.ok) {
      console.error('Erreur récupération tickets admin:', await ticketsResponse.text());
      return new Response(JSON.stringify({ error: 'Erreur chargement tickets' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    const tickets = await ticketsResponse.json();

    const userIds = Array.from(
      new Set(
        (Array.isArray(tickets) ? tickets : [])
          .map((ticket: any) => ticket?.user_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );

    let profilesMap: Record<string, { email: string | null; full_name: string | null }> = {};

    if (userIds.length > 0) {
      const params = new URLSearchParams();
      params.set('select', 'id,email,full_name');
      if (userIds.length === 1) {
        params.set('id', `eq.${userIds[0]}`);
      } else {
        const quoted = userIds.map((id) => `"${id}"`).join(',');
        params.set('id', `in.(${quoted})`);
      }

      const profilesResponse = await fetch(
        `${supabaseUrl}/rest/v1/profiles_extended?${params.toString()}`,
        {
          headers: restHeaders,
        }
      );

      if (!profilesResponse.ok) {
        console.error('Erreur chargement profils tickets admin:', await profilesResponse.text());
      } else {
        const profiles = await profilesResponse.json();
        if (Array.isArray(profiles)) {
          profilesMap = profiles.reduce(
            (acc: typeof profilesMap, profile: any) => {
              if (profile?.id) {
                acc[profile.id as string] = {
                  email: profile.email ?? null,
                  full_name: profile.full_name ?? null,
                };
              }
              return acc;
            },
            {} as typeof profilesMap
          );
        }
      }
    }

    const enrichedTickets = (Array.isArray(tickets) ? tickets : []).map((ticket: any) => {
      const profile = profilesMap[ticket?.user_id as string] ?? null;
      return {
        ...ticket,
        profiles: profile,
        creator_email: profile?.email ?? null,
      };
    });

    return new Response(JSON.stringify({ tickets: enrichedTickets }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('Erreur route /service/admin:', error);
    return new Response(JSON.stringify({ error: 'Erreur interne' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
