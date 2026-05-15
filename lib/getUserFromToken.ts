import { createHmac, timingSafeEqual } from 'node:crypto';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

function base64UrlToBuffer(segment: string): Buffer {
  let s = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  return Buffer.from(s, 'base64');
}

/** 校验 Supabase 默认 HS256 JWT，不依赖外网 Auth 接口 */
function verifySupabaseJwtHs256(
  token: string,
  secret: string,
): { sub: string; email?: string; aud?: string; role?: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h64, p64, sig64] = parts;

  let header: { alg?: string };
  try {
    header = JSON.parse(base64UrlToBuffer(h64).toString('utf8')) as { alg?: string };
  } catch {
    return null;
  }
  if (header.alg !== 'HS256') return null;

  const signingInput = `${h64}.${p64}`;
  const expectedSig = createHmac('sha256', secret).update(signingInput).digest();
  let actualSig: Buffer;
  try {
    actualSig = base64UrlToBuffer(sig64);
  } catch {
    return null;
  }
  if (actualSig.length !== expectedSig.length || !timingSafeEqual(actualSig, expectedSig)) {
    return null;
  }

  let payload: { sub?: unknown; email?: unknown; aud?: unknown; role?: unknown; exp?: unknown };
  try {
    payload = JSON.parse(base64UrlToBuffer(p64).toString('utf8')) as typeof payload;
  } catch {
    return null;
  }
  if (typeof payload.exp === 'number' && Date.now() / 1000 >= payload.exp) return null;
  if (typeof payload.sub !== 'string' || !payload.sub) return null;

  return {
    sub: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    aud: typeof payload.aud === 'string' ? payload.aud : undefined,
    role: typeof payload.role === 'string' ? payload.role : undefined,
  };
}

/**
 * 从 Route Handler 的 Authorization 解析当前用户。
 * 若配置了 SUPABASE_JWT_SECRET，在本地校验 JWT（不请求 Supabase Auth，避免网络超时）。
 * 否则回退到 supabase.auth.getUser(token)。
 */
export async function getUserFromToken(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (jwtSecret) {
    const payload = verifySupabaseJwtHs256(token, jwtSecret);
    if (!payload) {
      console.error('JWT verify failed');
      return null;
    }
    return {
      id: payload.sub,
      email: payload.email,
      aud: payload.aud ?? 'authenticated',
      role: payload.role ?? 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '',
      updated_at: '',
      identities: [],
      factors: null,
    } as unknown as User;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error) {
    console.error('getUser error:', error);
    return null;
  }
  return user;
}
