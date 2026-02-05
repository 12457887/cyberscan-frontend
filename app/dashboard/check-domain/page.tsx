'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Database, Search, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function CheckDomainPage() {
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any | null>(null);
  const [lastQuery, setLastQuery] = useState('');

  const normalizeQuery = (raw: string) => {
    const entries = raw
      .split(/\r?\n|,|;/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (entries.length === 0) {
      throw new Error(localize('Veuillez saisir une valeur.', 'Please enter a value.'));
    }
    if (entries.length > 1) {
      throw new Error(
        localize(
          'Veuillez saisir une seule valeur.',
          'Please enter a single value.'
        )
      );
    }
    return entries[0];
  };

  const escapeHtml = (value: any) => {
    const text = String(value ?? '');
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const normalizeDehashedQuery = (raw: string) => {
    const value = raw.trim();
    if (!value) {
      throw new Error(localize('Veuillez saisir une valeur.', 'Please enter a value.'));
    }

    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (emailRegex.test(value)) {
      return `email:${value.toLowerCase()}`;
    }

    if (/^https?:\/\//i.test(value)) {
      try {
        const parsed = new URL(value);
        let domain = (parsed.hostname || '').toLowerCase();
        if (domain.startsWith('www.')) {
          domain = domain.slice(4);
        }
        if (!domain) {
          throw new Error();
        }
        return `domain:${domain}`;
      } catch {
        throw new Error(localize('URL invalide.', 'Invalid URL.'));
      }
    }

    if (value.includes('.') && !value.includes('/') && !value.includes(' ')) {
      let domain = value.toLowerCase();
      if (domain.startsWith('www.')) {
        domain = domain.slice(4);
      }
      return `domain:${domain}`;
    }

    return value;
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return '—';
    if (Array.isArray(value)) return value.filter(Boolean).join(', ') || '—';
    if (typeof value === 'object') return JSON.stringify(value);
    const text = String(value);
    return text.length ? text : '—';
  };

  const pickValue = (entry: any, keys: string[]) => {
    for (const key of keys) {
      const value = entry?.[key];
      if (value !== undefined && value !== null && String(value).length > 0) {
        return formatValue(value);
      }
    }
    return '—';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const normalizedQuery = normalizeDehashedQuery(normalizeQuery(query));
      const response = await fetch('/api/dehashed/check-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: normalizedQuery }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || localize('Échec de la recherche DeHashed.', 'DeHashed search failed.'));
      }

      const data = await response.json();
      setResult(data);
      setLastQuery(normalizedQuery);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : localize('Échec de la recherche DeHashed.', 'DeHashed search failed.')
      );
    } finally {
      setLoading(false);
    }
  };

  const payload =
    result?.data?.data ??
    result?.data ??
    result?.payload ??
    null;
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];
  const total = typeof payload?.total === 'number' ? payload.total : entries.length;
  const usage = result?.usage ?? null;

  const exportPdf = () => {
    if (!result) {
      setError(localize('Aucun résultat à exporter.', 'No results to export.'));
      return;
    }

    const printedAt = new Date();
    const printedAtLabel = printedAt.toLocaleString();
    const title = lastQuery || localize('Recherche DeHashed', 'DeHashed search');
    const rowsHtml =
      entries.length > 0
        ? entries
            .map((entry: any) => {
              const cells = [
                pickValue(entry, ['email']),
                pickValue(entry, ['username', 'user', 'login']),
                pickValue(entry, ['name', 'full_name', 'fullname']),
                pickValue(entry, ['ip_address', 'ip', 'ipaddress']),
                pickValue(entry, ['password', 'pass', 'hashed_password', 'hash']),
                pickValue(entry, ['database_name', 'database', 'source', 'leak']),
              ];
              return `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`;
            })
            .join('')
        : `<tr><td colspan="6">${escapeHtml(localize('Aucune fuite trouvée.', 'No leaks found.'))}</td></tr>`;

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
      h1 { font-size: 20px; margin: 0; }
      .meta { margin-top: 4px; font-size: 12px; color: #475569; }
      .badges { margin-top: 12px; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #e2e8f0; font-size: 11px; margin-right: 6px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #e2e8f0; padding: 6px 8px; font-size: 11px; vertical-align: top; text-align: left; }
      th { background: #f8fafc; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">${escapeHtml(localize('Exporté le', 'Exported at'))}: ${escapeHtml(printedAtLabel)}</div>
    <div class="badges">
      <span class="badge">${escapeHtml(localize('Total', 'Total'))}: ${escapeHtml(total)}</span>
      ${
        usage
          ? `<span class="badge">${escapeHtml(localize('Usage', 'Usage'))}: ${escapeHtml(
              usage.count ?? '—'
            )}${usage.limit ? ` / ${escapeHtml(usage.limit)}` : ''}</span>`
          : ''
      }
    </div>
    <table>
      <thead>
        <tr>
          <th>Email</th>
          <th>${escapeHtml(localize('Utilisateur', 'Username'))}</th>
          <th>${escapeHtml(localize('Nom', 'Name'))}</th>
          <th>IP</th>
          <th>${escapeHtml(localize('Mot de passe / Hash', 'Password / Hash'))}</th>
          <th>${escapeHtml(localize('Source', 'Source'))}</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      setError(localize('Impossible d’ouvrir la fenêtre PDF.', 'Unable to open PDF window.'));
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {localize('Check domain', 'Check domain')}
            </h1>
            <p className="mt-1 text-slate-600">
              {localize(
                'Recherchez les fuites via DeHashed (email, domaine ou URL).',
                'Search for leaks (email, domain, or URL).'
              )}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{localize('Recherche', 'Search')}</CardTitle>
            <CardDescription>
              {localize('Saisissez un email, un domaine ou une URL.', 'Enter an email, domain, or URL.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dehashedQuery">
                  {localize('Email ou domaine', 'Email or domain')}
                </Label>
                <Input
                  id="dehashedQuery"
                  type="text"
                  placeholder={localize('email@exemple.com ou exemple.com', 'email@example.com or example.com')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  required
                />
                <p className="text-xs text-slate-500">
                  {localize('Une seule valeur par recherche.', 'One value per search.')}
                </p>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {localize('Recherche en cours...', 'Searching...')}
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    {localize('Lancer la recherche', 'Run search')}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{localize('Résultats', 'Results')}</CardTitle>
              <CardDescription>
                {lastQuery ? lastQuery : localize('Aucune recherche lancée.', 'No search yet.')}
              </CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={exportPdf} disabled={!result}>
              <Download className="mr-2 h-4 w-4" />
              {localize('Exporter PDF', 'Export PDF')}
            </Button>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {localize('Lancez une recherche pour afficher les résultats.', 'Run a search to see results.')}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {localize('Total:', 'Total:')} {total}
                  </Badge>
                  {usage && (
                    <Badge variant="outline">
                      {localize('Usage:', 'Usage:')} {usage.count ?? '—'}
                      {usage.limit ? ` / ${usage.limit}` : ''}
                    </Badge>
                  )}
                </div>

                {entries.length === 0 ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {localize('Aucune fuite trouvée.', 'No leaks found.')}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>{localize('Utilisateur', 'Username')}</TableHead>
                        <TableHead>{localize('Nom', 'Name')}</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>{localize('Mot de passe / Hash', 'Password / Hash')}</TableHead>
                        <TableHead>{localize('Source', 'Source')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry: any, index: number) => (
                        <TableRow key={`dehashed-${index}`}>
                          <TableCell className="text-xs text-slate-700">
                            {pickValue(entry, ['email'])}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {pickValue(entry, ['username', 'user', 'login'])}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {pickValue(entry, ['name', 'full_name', 'fullname'])}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {pickValue(entry, ['ip_address', 'ip', 'ipaddress'])}
                          </TableCell>
                          <TableCell className="max-w-[220px] break-words text-xs text-slate-600">
                            {pickValue(entry, ['password', 'pass', 'hashed_password', 'hash'])}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {pickValue(entry, ['database_name', 'database', 'source', 'leak'])}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
