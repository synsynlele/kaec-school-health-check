const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface VerifiedKhposUser {
  id: string;
  email: string;
}

export class KhposAuthError extends Error {
  constructor(
    message: string,
    public readonly status = 401,
  ) {
    super(message);
    this.name = "KhposAuthError";
  }
}

export function bearerTokenFromRequest(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function verifyKhposAccessToken(
  accessToken: string,
): Promise<VerifiedKhposUser> {
  if (!SUPABASE_URL || !SUPABASE_SERVER_KEY) {
    throw new KhposAuthError("KHP-OS authentication is not configured.", 503);
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVER_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new KhposAuthError("Your session has expired. Sign in again.", 401);
  }

  const user = (await response.json()) as {
    id?: string;
    email?: string;
    email_confirmed_at?: string | null;
  };

  const email = user.email?.trim().toLowerCase();
  if (!user.id || !email || !user.email_confirmed_at) {
    throw new KhposAuthError("A verified email is required to use KHP-OS.", 403);
  }

  return { id: user.id, email };
}
