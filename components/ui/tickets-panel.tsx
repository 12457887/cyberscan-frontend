'use client';

import { useMemo, useState } from 'react';
import { Badge } from './badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { TicketDialog } from './ticket-dialog';
import { Ticket } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';

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
            const showToggle = (ticket.description?.length || 0) > 160 || !!ticket.phone_number;
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
                    <p className="text-[11px] text-slate-400">
                      {localize('Créé le', 'Created on')}{' '}
                      {new Date(ticket.created_at).toLocaleString(locale)}
                    </p>
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
