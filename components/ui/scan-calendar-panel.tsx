import { Calendar } from './calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { ScheduleScanDialog } from './schedule-scan-dialog';
import { ScheduledScan } from '@/lib/supabase';

interface ScanCalendarProps {
  scheduledScans: ScheduledScan[];
  onScanScheduled: () => void;
}

export function ScanCalendarPanel({ scheduledScans, onScanScheduled }: ScanCalendarProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendrier des scans programmés</CardTitle>
        <CardDescription>Vos prochains scans automatiques</CardDescription>
      </CardHeader>
      <CardContent>
        <ScheduleScanDialog onScanScheduled={onScanScheduled} />
        <div className="mt-4">
          <Calendar
            mode="multiple"
            selected={scheduledScans.map(scan => new Date(scan.next_scan_date))}
            className="rounded-md border"
          />
          <div className="mt-4 space-y-2">
            {scheduledScans.map((scan) => (
              <div key={scan.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                  <span className="text-slate-700">{scan.site_name || scan.site_url}</span>
                </div>
                <span className="text-slate-500">
                  {new Date(scan.next_scan_date).toLocaleDateString('fr-FR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
