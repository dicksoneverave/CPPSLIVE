/*
  # Create chronoforms8 table for form configurations

  1. New Tables
    - `chronoforms8` - Stores form configurations and metadata
      - `id` (uuid, primary key)
      - `alias` (text, unique identifier for forms)
      - `elements` (jsonb, form configuration)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policy for public read access
*/

-- Create the forms table
CREATE TABLE IF NOT EXISTS chronoforms8 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text UNIQUE NOT NULL,
  elements jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE chronoforms8 ENABLE ROW LEVEL SECURITY;

-- Create policy for reading form configurations
CREATE POLICY "Anyone can read form configurations" 
  ON chronoforms8
  FOR SELECT
  TO PUBLIC
  USING (true);

-- Insert the worker registration form configuration
INSERT INTO chronoforms8 (alias, elements)
VALUES (
  'newemployersearchworkerregistration',
  '{
    "fields": [
      {
        "name": "firstName",
        "type": "text",
        "label": "First Name",
        "required": true
      },
      {
        "name": "lastName",
        "type": "text",
        "label": "Last Name",
        "required": true
      },
      {
        "name": "email",
        "type": "email",
        "label": "Email Address",
        "required": true
      },
      {
        "name": "phone",
        "type": "tel",
        "label": "Phone Number",
        "required": true
      },
      {
        "name": "dateOfBirth",
        "type": "date",
        "label": "Date of Birth",
        "required": true
      },
      {
        "name": "gender",
        "type": "select",
        "label": "Gender",
        "required": true,
        "options": ["Male", "Female", "Other"]
      },
      {
        "name": "address",
        "type": "text",
        "label": "Address",
        "required": true
      },
      {
        "name": "city",
        "type": "text",
        "label": "City",
        "required": true
      },
      {
        "name": "state",
        "type": "text",
        "label": "State/Province",
        "required": true
      },
      {
        "name": "postalCode",
        "type": "text",
        "label": "Postal Code",
        "required": true
      },
      {
        "name": "occupation",
        "type": "text",
        "label": "Occupation",
        "required": true
      },
      {
        "name": "employmentStatus",
        "type": "select",
        "label": "Employment Status",
        "required": true,
        "options": ["Full-time", "Part-time", "Contract", "Temporary"]
      }
    ],
    "targetTable": "workers"
  }'::jsonb
);
