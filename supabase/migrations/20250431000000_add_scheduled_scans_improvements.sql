-- Add is_running column to scheduled_scans
ALTER TABLE scheduled_scans 
ADD COLUMN is_running boolean DEFAULT false;

-- Add scheduled_scan_id to scans
ALTER TABLE scans
ADD COLUMN scheduled_scan_id uuid REFERENCES scheduled_scans(id);

-- Add index for better performance
CREATE INDEX idx_scheduled_scans_next_scan_date ON scheduled_scans (next_scan_date) 
WHERE is_active = true AND is_running = false;

-- Add trigger to handle scan failures
CREATE OR REPLACE FUNCTION handle_scan_failure()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'failed' AND NEW.scheduled_scan_id IS NOT NULL THEN
    UPDATE scheduled_scans
    SET is_running = false
    WHERE id = NEW.scheduled_scan_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scan_failure_trigger
AFTER UPDATE ON scans
FOR EACH ROW
WHEN (NEW.status = 'failed')
EXECUTE FUNCTION handle_scan_failure();