import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (username === 'admin' && adminPassword && password === adminPassword) {
    const res = NextResponse.json({ ok: true, name: '管理员' });
    res.cookies.set('admin_session', 'admin', {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });
    return res;
  }

  return NextResponse.json({ ok: false, error: '用户名或密码错误' }, { status: 401 });
}
