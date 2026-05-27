/*
  # Create hash_password function and trigger

  1. New Functions
    - `hash_password` - A function that hashes passwords before they are stored in the database
      - Uses pgcrypto's crypt function with a random salt
      - Only hashes the password if it has changed
      
  2. New Triggers
    - `hash_password_trigger` - A trigger that calls the hash_password function
      - Runs before INSERT or UPDATE on the users table
      - Ensures passwords are always hashed before storage
      
  3. Purpose
    - Provides secure password storage
    - Avoids storing plaintext passwords in the database
    - Ensures consistent password hashing across the application
*/

-- Create the hash_password function
CREATE OR REPLACE FUNCTION hash_password()
RETURNS TRIGGER AS $$
BEGIN
  -- Only hash the password if it's new or has changed
  IF TG_OP = 'INSERT' OR NEW.password <> OLD.password THEN
    -- Check if the password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
    IF NEW.password IS NOT NULL AND 
       NEW.password !~ '^\$2[aby]\$' THEN
      -- Hash the password using bcrypt
      NEW.password := crypt(NEW.password, gen_salt('bf'));
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on the users table
DROP TRIGGER IF EXISTS hash_password_trigger ON users;
CREATE TRIGGER hash_password_trigger
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION hash_password();
