/*
      # Form18Master Table
      1. Creates form18master table with core claim response fields
      2. Adds RLS policies for authenticated access
      3. Creates indexes for common query patterns
    */
    CREATE TABLE IF NOT EXISTS form18master (
      F18MID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      IRN TEXT NOT NULL,
      IncidentType TEXT NOT NULL,
      F18MWorkerAcceptedDate TIMESTAMPTZ,
      F18MEmployerAcceptedDate TIMESTAMPTZ,
      F18MStatus TEXT NOT NULL DEFAULT 'Pending',
      CreatedAt TIMESTAMPTZ DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS form18master_irn_idx ON form18master (IRN);
    CREATE INDEX IF NOT EXISTS form18master_status_idx ON form18master (F18MStatus);
    CREATE INDEX IF NOT EXISTS form18master_incidenttype_idx ON form18master (IncidentType);

    ALTER TABLE form18master ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Allow authenticated users to view form18master" ON form18master
      FOR SELECT USING (true);

    CREATE POLICY "Allow authenticated users to update form18master" ON form18master
      FOR UPDATE USING (true);
