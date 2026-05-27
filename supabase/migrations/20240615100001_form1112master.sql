/*
      # Form1112Master Table
      1. Creates form1112master table for claim metadata
      2. Adds RLS policies for authenticated access
      3. Creates indexes for common query patterns
    */
    CREATE TABLE IF NOT EXISTS form1112master (
      IRN TEXT PRIMARY KEY,
      DisplayIRN TEXT NOT NULL,
      WorkerID UUID NOT NULL,
      IncidentRegion TEXT NOT NULL,
      CreatedAt TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS form1112master_workerid_idx ON form1112master (WorkerID);
    CREATE INDEX IF NOT EXISTS form1112master_region_idx ON form1112master (IncidentRegion);

    ALTER TABLE form1112master ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Allow authenticated users to view form1112master" ON form1112master
      FOR SELECT USING (true);
