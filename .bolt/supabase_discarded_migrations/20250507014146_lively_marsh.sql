/*
  # Add foreign key relationship for user group mapping

  1. Changes
    - Add foreign key constraint to link owc_user_usergroup_map.group_id to owc_usergroups.id
    - Update group_id column type to match owc_usergroups.id type
    - Add index on group_id for better query performance

  2. Security
    - No changes to RLS policies
*/

-- First ensure group_id is the correct type (bigint to match owc_usergroups.id)
ALTER TABLE owc_user_usergroup_map 
ALTER COLUMN group_id TYPE bigint USING group_id::bigint;

-- Add foreign key constraint
ALTER TABLE owc_user_usergroup_map
ADD CONSTRAINT fk_user_group_map_group
FOREIGN KEY (group_id) 
REFERENCES owc_usergroups(id);

-- Add index for better join performance
CREATE INDEX IF NOT EXISTS idx_user_group_map_group_id 
ON owc_user_usergroup_map(group_id);
