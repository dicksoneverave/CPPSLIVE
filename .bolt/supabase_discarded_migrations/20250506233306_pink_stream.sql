/*
  # Add email provider to auth users

  1. Changes
    - Add provider column to auth.users table
    - Set default provider to 'email'
    - Update existing users to use email provider
*/

-- Add provider column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'auth'
    AND table_name = 'users' 
    AND column_name = 'provider'
  ) THEN
    ALTER TABLE auth.users ADD COLUMN provider text DEFAULT 'email';
  END IF;
END $$;

-- Update existing users to use email provider
UPDATE auth.users 
SET provider = 'email' 
WHERE provider IS NULL;

-- Make provider column NOT NULL
ALTER TABLE auth.users 
ALTER COLUMN provider SET NOT NULL;
