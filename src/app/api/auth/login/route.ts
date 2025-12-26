import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const validUsername = process.env.ADMIN_USERNAME;
    const validPassword = process.env.ADMIN_PASSWORD;

    if (username === validUsername && password === validPassword) {
      // Login válido
      return NextResponse.json({ success: true });
    } else {
      // Login inválido
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