-- Autorise les utilisateurs authentifies a deposer des pieces jointes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE polname = 'allow_ticket_attachments_insert'
          AND schemaname = 'storage'
          AND tablename = 'objects'
    ) THEN
        EXECUTE $$
            CREATE POLICY allow_ticket_attachments_insert
            ON storage.objects
            FOR INSERT
            TO authenticated
            WITH CHECK (
                bucket_id IN ('ticket-attachments', 'cyberscan')
            );
        $$;
    END IF;
END $$;

-- Autorise la lecture publique des pieces jointes necessaires aux tickets
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE polname = 'allow_ticket_attachments_select'
          AND schemaname = 'storage'
          AND tablename = 'objects'
    ) THEN
        EXECUTE $$
            CREATE POLICY allow_ticket_attachments_select
            ON storage.objects
            FOR SELECT
            TO public
            USING (
                bucket_id IN ('ticket-attachments', 'cyberscan')
            );
        $$;
    END IF;
END $$;
