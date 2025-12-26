import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const validUsername = getEnv('ADMIN_USERNAME');
    const validPassword = getEnv('ADMIN_PASSWORD');

    if (username === validUsername && password === validPassword) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, message: 'Usuário ou senha incorretos' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Erro no servidor' },
      { status: 500 }
    );
  }
}