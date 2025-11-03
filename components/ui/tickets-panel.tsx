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
          tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{ticket.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{ticket.description}</p>
                  {(ticket.creator_email || ticket.profiles?.email) && (
                    <p className="mt-2 text-xs text-slate-500">
                      Email :{' '}
                      <span className="font-medium">
                        {ticket.creator_email || ticket.profiles?.email || 'Utilisateur inconnu'}
                      </span>
                    </p>
                  )}
                </div>
                <Badge variant="outline" className={`${getStatusBadgeStyle(ticket.status)} border-transparent`}>
                  {getStatusLabel(ticket.status)}
                </Badge>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                {new Date(ticket.created_at).toLocaleString('fr-FR')}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
