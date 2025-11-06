'use client';

import { useState } from 'react';
import { Badge } from './badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { TicketDialog } from './ticket-dialog';
import { Ticket } from '@/lib/supabase';

interface TicketsPanelProps {
  tickets: Ticket[];
  onTicketCreated: () => void;
  isAdmin?: boolean;
}

export function TicketsPanel({ tickets, onTicketCreated, isAdmin = false }: TicketsPanelProps) {
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
        return 'Ouvert';
      case 'in_progress':
        return 'En cours';
      case 'resolved':
        return 'Résolu';
      default:
        return 'Fermé';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'Haute';
      case 'medium':
        return 'Moyenne';
      default:
        return 'Basse';
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
        <CardTitle>Tickets de support</CardTitle>
        <CardDescription>
          {isAdmin ? 'Derniers tickets reçus de vos utilisateurs' : 'Les 5 derniers tickets ouverts'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TicketDialog onTicketCreated={onTicketCreated} />
        {tickets.length === 0 ? (
          <p className="text-sm text-slate-600 text-center mt-4">Aucun ticket en cours</p>
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
                    Voir les détails
                  </button>
                )}

                {isExpanded && (
                  <div className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-600 space-y-2">
                    <div className="text-sm text-slate-700">{ticket.description}</div>
                    <div className="flex flex-wrap gap-4">
                      <span>
                        Priorité :{' '}
                        <strong className="text-slate-900">{getPriorityLabel(ticket.priority)}</strong>
                      </span>
                      <span>
                        Statut :{' '}
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
                        Téléphone :{' '}
                        <a
                          href={`tel:${ticket.phone_number}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {ticket.phone_number}
                        </a>
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400">
                      Créé le {new Date(ticket.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                )}

                {!isExpanded && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    {new Date(ticket.created_at).toLocaleString('fr-FR')}
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
