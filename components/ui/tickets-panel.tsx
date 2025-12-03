'use client';

import { useMemo, useState } from 'react';
import { Loader2, Paperclip } from 'lucide-react';
import { Badge } from './badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { TicketDialog } from './ticket-dialog';
import { Ticket, supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { Textarea } from './textarea';
import { Button } from './button';

interface TicketsPanelProps {
  tickets: Ticket[];
  onTicketCreated: () => void;
  isAdmin?: boolean;
}

export function TicketsPanel({ tickets, onTicketCreated, isAdmin = false }: TicketsPanelProps) {
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const locale = choose({ fr: 'fr-FR', en: 'en-US' });
  const statusLabels = useMemo(
    () =>
      choose({
        fr: { open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu', closed: 'Fermé' },
        en: { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' },
      }),
    [choose]
  );
  const priorityLabels = useMemo(
    () =>
      choose({
        fr: { high: 'Haute', medium: 'Moyenne', low: 'Basse' },
        en: { high: 'High', medium: 'Medium', low: 'Low' },
      }),
    [choose]
  );
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, { message: string; status: Ticket['status'] }>>({});
  const [replyErrors, setReplyErrors] = useState<Record<string, string | null>>({});
  const [sendingTicketId, setSendingTicketId] = useState<string | null>(null);

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-700';
      case 'in_progress':
        return 'bg-amber-100 text-amber-700';
      case 'resolved':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return statusLabels.open;
      case 'in_progress':
        return statusLabels.in_progress;
      case 'resolved':
        return statusLabels.resolved;
      default:
        return statusLabels.closed;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return priorityLabels.high;
      case 'medium':
        return priorityLabels.medium;
      default:
        return priorityLabels.low;
    }
  };

  const truncateDescription = (text: string, maxLength = 160) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
  };

  const toggleTicketDetails = (ticketId: string) => {
    setExpandedTicketId((prev) => (prev === ticketId ? null : ticketId));
  };

  const updateDraft = (ticketId: string, patch: Partial<{ message: string; status: Ticket['status'] }>) => {
    setReplyDrafts((prev) => ({
      ...prev,
      [ticketId]: {
        message: patch.message ?? prev[ticketId]?.message ?? '',
        status: patch.status ?? prev[ticketId]?.status ?? 'in_progress',
      },
    }));
  };

  const handleAdminResponse = async (ticket: Ticket) => {
    const ticketId = ticket.id;
    const currentDraft = replyDrafts[ticketId]?.message ?? '';
    if (!currentDraft.trim()) {
      setReplyErrors((prev) => ({ ...prev, [ticketId]: localize('Veuillez écrire une réponse.', 'Please write a reply.') }));
      return;
    }
    setReplyErrors((prev) => ({ ...prev, [ticketId]: null }));
    setSendingTicketId(ticketId);
    try {
      const nextStatus = replyDrafts[ticketId]?.status ?? (ticket.status === 'resolved' ? 'resolved' : 'in_progress');
      const { error } = await supabase
        .from('tickets')
        .update({
          admin_response: currentDraft.trim(),
          admin_response_at: new Date().toISOString(),
          status: nextStatus,
        })
        .eq('id', ticketId);

      if (error) {
        throw error;
      }
      updateDraft(ticketId, { message: '', status: nextStatus });
      onTicketCreated();
    } catch (err) {
      console.error('Erreur en répondant au ticket:', err);
      setReplyErrors((prev) => ({
        ...prev,
        [ticketId]: localize('Impossible d\'envoyer la réponse.', 'Unable to send the reply.'),
      }));
    } finally {
      setSendingTicketId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{localize('Tickets de support', 'Support tickets')}</CardTitle>
        <CardDescription>
          {isAdmin
            ? localize('Derniers tickets reçus de vos utilisateurs', 'Latest tickets received from your users')
            : localize('Les 5 derniers tickets ouverts', 'Your 5 most recent open tickets')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TicketDialog onTicketCreated={onTicketCreated} />
        {tickets.length === 0 ? (
          <p className="text-sm text-slate-600 text-center mt-4">
            {localize('Aucun ticket en cours', 'No tickets in progress')}
          </p>
        ) : (
          tickets.map((ticket) => {
            const isExpanded = expandedTicketId === ticket.id;
            const showToggle =
              (ticket.description?.length || 0) > 160 || !!ticket.phone_number || !!ticket.attachment_url;
            return (
              <div key={ticket.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{ticket.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {isExpanded ? ticket.description : truncateDescription(ticket.description)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleTicketDetails(ticket.id)}
                    className="ml-auto inline-flex"
                    title="Afficher les détails du ticket"
                  >
                    <Badge
                      variant="outline"
                      className={`${getStatusBadgeStyle(ticket.status)} border-transparent`}
                    >
                      {getStatusLabel(ticket.status)}
                    </Badge>
                  </button>
                </div>

                {showToggle && !isExpanded && (
                  <button
                    type="button"
                    onClick={() => toggleTicketDetails(ticket.id)}
                    className="mt-2 text-xs font-medium text-blue-600 hover:underline"
                  >
                    {localize('Voir les détails', 'View details')}
                  </button>
                )}

                {isExpanded && (
                  <div className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-600 space-y-2">
                    <div className="text-sm text-slate-700">{ticket.description}</div>
                    <div className="flex flex-wrap gap-4">
                      <span>
                        {localize('Priorité', 'Priority')} :{' '}
                        <strong className="text-slate-900">{getPriorityLabel(ticket.priority)}</strong>
                      </span>
                      <span>
                        {localize('Statut', 'Status')} :{' '}
                        <strong className="text-slate-900">{getStatusLabel(ticket.status)}</strong>
                      </span>
                    </div>
                    {(ticket.contact_email || ticket.creator_email || ticket.profiles?.email) && (
                      <p>
                        Email :{' '}
                        <span className="font-medium text-slate-900">
                          {ticket.contact_email ||
                            ticket.creator_email ||
                            ticket.profiles?.email ||
                            'Utilisateur inconnu'}
                        </span>
                      </p>
                    )}
                    {ticket.phone_number && (
                      <p>
                        {localize('Téléphone', 'Phone')} :{' '}
                        <a
                          href={`tel:${ticket.phone_number}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {ticket.phone_number}
                        </a>
                      </p>
                    )}
                    {ticket.attachment_url && (
                      <p className="flex items-center gap-2 text-sm text-slate-700">
                        <Paperclip className="h-4 w-4 text-slate-500" />
                        <a
                          href={ticket.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          {ticket.attachment_name || localize('Télécharger la pièce jointe', 'Download attachment')}
                        </a>
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400">
                      {localize('Créé le', 'Created on')}{' '}
                      {new Date(ticket.created_at).toLocaleString(locale)}
                    </p>

                    {ticket.admin_response && (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3 text-slate-800 text-sm">
                        <p className="text-xs uppercase font-semibold text-emerald-700 tracking-wide mb-1">
                          {localize('Réponse de l’équipe', 'Team response')}
                        </p>
                        <p>{ticket.admin_response}</p>
                        {ticket.admin_response_at && (
                          <p className="mt-1 text-[11px] text-emerald-700/70">
                            {localize('Répondu le', 'Replied on')}{' '}
                            {new Date(ticket.admin_response_at).toLocaleString(locale)}
                          </p>
                        )}
                      </div>
                    )}

                    {isAdmin && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-sm space-y-2">
                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                          {localize('Répondre au ticket', 'Reply to ticket')}
                        </p>
                        <Textarea
                          value={replyDrafts[ticket.id]?.message ?? ''}
                          onChange={(event) => updateDraft(ticket.id, { message: event.target.value })}
                          placeholder={localize(
                            'Tapez votre réponse pour le client…',
                            'Type your response to the customer…'
                          )}
                          className="text-sm"
                          rows={3}
                        />
                        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                          <select
                            value={
                              replyDrafts[ticket.id]?.status ??
                              (ticket.status === 'resolved' ? 'resolved' : 'in_progress')
                            }
                            onChange={(event) =>
                              updateDraft(ticket.id, { status: event.target.value as Ticket['status'] })
                            }
                            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="in_progress">{statusLabels.in_progress}</option>
                            <option value="resolved">{statusLabels.resolved}</option>
                            <option value="open">{statusLabels.open}</option>
                          </select>
                          <Button
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            type="button"
                            disabled={sendingTicketId === ticket.id}
                            onClick={() => handleAdminResponse(ticket)}
                          >
                            {sendingTicketId === ticket.id ? (
                              <span className="flex items-center gap-2 text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {localize('Envoi…', 'Sending…')}
                              </span>
                            ) : (
                              localize('Envoyer la réponse', 'Send reply')
                            )}
                          </Button>
                        </div>
                        {replyErrors[ticket.id] && (
                          <p className="text-xs text-red-600">{replyErrors[ticket.id]}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!isExpanded && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    {new Date(ticket.created_at).toLocaleString(locale)}
                  </p>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
