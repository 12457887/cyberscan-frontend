import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, type, version } = body;

    // TODO: Appeler le backend pour créer l'environnement sandbox
    const response = await fetch('http://localhost:8000/sandbox/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, version }),
    });

    if (!response.ok) {
      // throw new Error('Erreur lors de la création de l\'environnement');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'environnement' },
      { status: 500 }
    );
  }
}