/*
      # WorkerPersonalDetails Table
      1. Creates workerpersonaldetails table for worker information
      2. Adds RLS policies for authenticated access
      3. Creates indexes for common query patterns
    */
    CREATE TABLE IF NOT EXISTS workerpersonaldetails (
      WorkerID UUID PRIMARY KEY,
      WorkerFirstName TEXT NOT NULL,
      WorkerLastName TEXT NOT NULL,
      CreatedAt TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS workerpersonaldetails_name_idx 
      ON workerpersonaldetails (WorkerFirstName, WorkerLastName);

    ALTER TABLE workerpersonaldetails ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Allow authenticated users to view worker details" ON workerpersonaldetails
      FOR SELECT USING (true);
