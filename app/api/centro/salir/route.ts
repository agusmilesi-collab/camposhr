import { NextResponse } from 'next/server';
import { COOKIE } from '@/lib/centro-cookie';

export const runtime = 'nodejs';

/** Cerrar la sesión: se borra la cookie y nada más. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
