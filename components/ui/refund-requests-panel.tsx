'use client';

import type { RefundRequest } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Button } from './button';
import { formatDateDMY } from '@/lib/date';
import { Loader2 } from 'lucide-react';

const statusStyles: Record<RefundRequest['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

type RefundRequestsPanelProps = {
  requests: RefundRequest[];
  loading: boolean;
  error: string | null;
  onDecision: (requestId: string, decision: 'approve' | 'reject', note?: string) => Promise<void>;
  actionRequestId: string | null;
};

export function RefundRequestsPanel({ requests, loading, error, onDecision, actionRequestId }: RefundRequestsPanelProps) {
  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return `${formatDateDMY(date)} ${date.toLocaleTimeString('fr-FR', { timeStyle: 'short' })}`;
  };

  const handleDecision = async (request: RefundRequest, decision: 'approve' | 'reject') => {
    if (decision === 'approve') {
      const confirmed = window.confirm('Approve this refund request?');
      if (!confirmed) return;
      await onDecision(request.id, 'approve');
    } else {
      const note = window.prompt('Reason for rejection (optional)?') || undefined;
      await onDecision(request.id, 'reject', note);
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>Refund requests</CardTitle>
        <CardDescription>Review and approve or reject customer refund requests.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading refund requests…
          </div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-slate-500 text-center">No refund requests at the moment.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const amountLabel =
                typeof request.amount_cents === 'number'
                  ? `${(request.amount_cents / 100).toFixed(2)} ${request.currency || 'EUR'}`
                  : '—';
              const isPending = request.status === 'pending';
              const isActing = actionRequestId === request.id;

              return (
                <div key={request.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-slate-900">Invoice {request.invoice_number || '—'}</p>
                        <Badge className={`${statusStyles[request.status]} border-transparent`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Requested on {formatDateTime(request.created_at)}
                      </p>
                      {request.reason && (
                        <p className="text-sm text-slate-600 mt-2">Reason: {request.reason}</p>
                      )}
                      {request.profiles?.email && (
                        <p className="text-xs text-slate-500 mt-1">{request.profiles.email}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase text-slate-500">Amount</p>
                      <p className="text-lg font-semibold text-slate-900">{amountLabel}</p>
                    </div>
                  </div>
                  {request.status !== 'pending' && request.decision_reason && (
                    <p className="mt-3 text-xs text-slate-500">
                      Decision note: {request.decision_reason}
                    </p>
                  )}
                  {isPending && (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        variant="outline"
                        disabled={isActing}
                        onClick={() => handleDecision(request, 'reject')}
                        className="sm:w-auto"
                      >
                        {isActing ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing…
                          </span>
                        ) : (
                          'Reject'
                        )}
                      </Button>
                      <Button
                        className="sm:w-auto"
                        disabled={isActing}
                        onClick={() => handleDecision(request, 'approve')}
                      >
                        {isActing ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing…
                          </span>
                        ) : (
                          'Approve & refund'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
