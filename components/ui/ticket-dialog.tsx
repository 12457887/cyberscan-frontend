'use client';

import { type FormEvent, useState } from 'react';
import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { Input } from './input';
import { Textarea } from './textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { PlusCircle } from 'lucide-react';

export function TicketDialog({ onTicketCreated }: { onTicketCreated: () => void }) {
  const { user } = useAuth();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    email: '',
    phone: '',
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    setFormError(null);
    setIsLoading(true);
    try {
      const phoneValue = formData.phone.trim();
      const emailValue = formData.email.trim();

      const { error } = await supabase.from('tickets').insert({
        user_id: user.id,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        contact_email: emailValue || null,
        phone_number: phoneValue || null,
        status: 'open'
      });

      if (error) throw error;

      setFormData({ title: '', description: '', priority: 'medium', email: '', phone: '' });
      setIsOpen(false);
      onTicketCreated();
    } catch (error) {
      console.error('Error creating ticket:', error);
      setFormError(
        localize(
          'Impossible de creer le ticket. Merci de reessayer.',
          'Unable to create the ticket. Please try again.'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <PlusCircle className="mr-2 h-4 w-4" />
          {localize('Nouveau ticket', 'New ticket')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{localize('Créer un nouveau ticket', 'Create a new ticket')}</DialogTitle>
          <DialogDescription>
            {localize('Décrivez votre problème ou votre demande d’assistance', 'Describe your issue or request for assistance')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              {localize('Titre', 'Title')}
            </label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder={localize('Titre du ticket', 'Ticket title')}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              {localize('Description', 'Description')}
            </label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={localize('Décrivez votre problème en détail', 'Describe your issue in detail')}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              {localize('Email de contact', 'Contact email')}
            </label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder={localize('contact@exemple.com', 'contact@example.com')}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium">
              {localize('Numéro de téléphone', 'Phone number')}
            </label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder={localize('+33 6 12 34 56 78', '+1 555 555 5555')}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="priority" className="text-sm font-medium">
              {localize('Priorité', 'Priority')}
            </label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={localize('Sélectionnez une priorité', 'Select a priority')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{localize('Basse', 'Low')}</SelectItem>
                <SelectItem value="medium">{localize('Moyenne', 'Medium')}</SelectItem>
                <SelectItem value="high">{localize('Haute', 'High')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? localize('Création...', 'Creating...') : localize('Créer le ticket', 'Create ticket')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
