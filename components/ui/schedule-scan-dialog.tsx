import { useState } from 'react';
import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { Calendar } from './calendar';
import { Input } from './input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { CalendarPlus } from 'lucide-react';

export function ScheduleScanDialog({ onScanScheduled }: { onScanScheduled: () => void }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [formData, setFormData] = useState({
    site_url: '',
    scan_type: 'light',
    frequency: 'weekly'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDate) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from('scheduled_scans').insert({
        user_id: user.id,
        site_url: formData.site_url,
        site_name: formData.site_url,
        scan_type: formData.scan_type,
        frequency: formData.frequency,
        next_scan_date: selectedDate.toISOString(),
        last_scan_date: null,
        is_active: true,
        is_running: false,
      });

      if (error) throw error;

      setFormData({ site_url: '', scan_type: 'light', frequency: 'weekly' });
      setSelectedDate(undefined);
      setIsOpen(false);
      onScanScheduled();
    } catch (error) {
      console.error('Error scheduling scan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <CalendarPlus className="mr-2 h-4 w-4" />
          Programmer un scan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Programmer un nouveau scan</DialogTitle>
          <DialogDescription>
            Choisissez une date et configurez les paramètres du scan
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="site_url" className="text-sm font-medium">URL du site</label>
            <Input
              id="site_url"
              type="url"
              value={formData.site_url}
              onChange={(e) => setFormData(prev => ({ ...prev, site_url: e.target.value }))}
              placeholder="https://example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="scan_type" className="text-sm font-medium">Type de scan</label>
            <Select
              value={formData.scan_type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, scan_type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez le type de scan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Léger</SelectItem>
                <SelectItem value="complete">Complet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="frequency" className="text-sm font-medium">Fréquence</label>
            <Select
              value={formData.frequency}
              onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez la fréquence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Hebdomadaire</SelectItem>
                <SelectItem value="monthly">Mensuel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Date du premier scan</label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date() || date < new Date('1900-01-01')}
              initialFocus
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading || !selectedDate}>
              {isLoading ? 'Programmation...' : 'Programmer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
