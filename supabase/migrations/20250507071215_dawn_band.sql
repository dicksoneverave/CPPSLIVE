/*
  # Add worker registration form configuration

  1. New Tables
    - `owc_chronoforms8` - Stores form configurations
      - `id` (bigint, primary key)
      - `title` (text)
      - `alias` (text)
      - `published` (text)
      - `elements` (jsonb)
      - `params` (jsonb)

  2. Security
    - Enable RLS on owc_chronoforms8 table
    - Add policy for public read access
*/

-- Create the forms table
CREATE TABLE IF NOT EXISTS owc_chronoforms8 (
  id bigint PRIMARY KEY,
  title text,
  alias text,
  published text,
  elements jsonb,
  params jsonb
);

-- Enable RLS
ALTER TABLE owc_chronoforms8 ENABLE ROW LEVEL SECURITY;

-- Create policy for reading form configurations
CREATE POLICY "Anyone can read form configurations" 
  ON owc_chronoforms8
  FOR SELECT
  TO PUBLIC
  USING (true);

-- Insert the worker registration form configuration
INSERT INTO owc_chronoforms8 (id, title, alias, published, elements, params)
VALUES (
  1,
  'Search Worker Registration',
  'newemployersearchworkerregistration',
  '1',
  '{
    "1": {
      "id": "1",
      "icon": "",
      "type": "page",
      "alias": "page1",
      "title": "Page1"
    },
    "2": {
      "id": "2",
      "name": "html",
      "type": "views",
      "parent": "1",
      "section": "load",
      "settings": {
        "name": "SearchWorkerRegistration",
        "disabled": "",
        "designer_label": "SearchWorkerRegistration",
        "designer_label_color": ""
      },
      "behaviors": [
        "html.php",
        "wizard_settings"
      ]
    },
    "3": {
      "id": "3",
      "name": "html",
      "type": "views",
      "parent": "1",
      "section": "load",
      "behaviors": [
        "html.php"
      ]
    },
    "4": {
      "id": "4",
      "name": "field_hidden",
      "type": "views",
      "parent": "1",
      "section": "load",
      "fieldname": "EmployerID"
    },
    "5": {
      "id": "5",
      "name": "field_hidden",
      "type": "views",
      "parent": "1",
      "section": "load",
      "fieldname": "EmployerCPPSID"
    }
  }'::jsonb,
  '{}'::jsonb
);
