'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';

type PredictResult = {
  url: string;
  cms?: string;
  confiance?: number;
  error?: string;
  status: 'success' | 'error';
};

export default function DashboardDetectionPage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PredictResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizeUrls = (text: string) => {
    return text
      .split(/\r?\n|,|;/)
      .map(s => s.trim())
      .filter(Boolean)
      .map((u) => {
        if (!u.startsWith('http://') && !u.startsWith('https://')) {
          return 'http://' + u;
        }
        return u;
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResults(null);

    const urls = normalizeUrls(input);
    if (urls.length === 0) {
      setError('Veuillez saisir au moins une URL.');
      return;
    }

    if (urls.length > 10) {
      setError('Maximum 10 URLs autorisées.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Erreur ${res.status}`);
      }

      const data = await res.json();
      setResults(data.resultats || []);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Détection de CMS</h1>
      <p className="text-sm text-slate-600 mb-4">Saisissez une URL ou une liste d'URLs </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://example.com\nexample2.com"
          className="w-full rounded border p-3 h-36 focus:outline-none focus:ring"
        />

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Analyse en cours...' : 'Détecter le CMS'}
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-slate-100 rounded"
            onClick={() => { setInput(''); setResults(null); setError(null); }}
          >
            Réinitialiser
          </button>
        </div>
      </form>

      {error && <div className="mt-4 text-red-600">{error}</div>}

      {results && (
        <div className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold">Résultats</h2>
          {results.length === 0 ? (
            <p className="text-sm text-slate-600">Aucun résultat.</p>
          ) : (
            results.map((r) => (
              <div key={r.url} className="p-3 bg-white border rounded shadow-sm">
                <div className="flex justify-between items-center">
                  <div className="font-medium break-all">{r.url}</div>
                  <div className="text-sm text-slate-500">{r.status === 'success' ? 'OK' : 'Erreur'}</div>
                </div>
                <div className="mt-2 text-sm">
                  {r.status === 'success' ? (
                    <>
                      <div>CMS détecté : <span className="font-semibold">{r.cms}</span></div>
                      <div>Confiance : <span className="font-semibold">{r.confiance}</span></div>
                    </>
                  ) : (
                    <div className="text-red-600">Erreur : {r.error}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      {content}
    </DashboardLayout>
  );
}
