/*
  # Fix OSMMobilePhone field type in owcstaffmaster table
  
  1. Changes
    - Modify OSMMobilePhone column from bigint to text
    - This allows storing phone numbers with spaces, dashes, or other non-numeric characters
    
  2. Purpose
    - Fixes the error: "invalid input syntax for type bigint: "1234 5678""
    - Provides more flexibility for phone number formats
    - Maintains compatibility with existing code
*/

-- Alter the OSMMobilePhone column to use text type instead of bigint
ALTER TABLE owcstaffmaster 
  ALTER COLUMN "OSMMobilePhone" TYPE text;
