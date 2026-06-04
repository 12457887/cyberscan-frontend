export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name } = body;

    // TODO: Appeler le backend pour démarrer l'environnement
    const response = await fetch('http://localhost:8000/sandbox/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      // throw new Error('Erreur lors du démarrage de l\'environnement');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors du démarrage de l\'environnement' },
      { status: 500 }
    );
  }
}