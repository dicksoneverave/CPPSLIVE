/*
  # Add create_staff_member function

  1. New Functions
    - `create_staff_member`: A stored procedure that handles the creation of a new staff member
      - Creates user record
      - Creates profile record
      - Creates staff record
      - All operations are performed in a transaction
      
  2. Parameters
    - p_email: Staff email
    - p_name: Full name
    - p_password: Hashed password
    - p_group_id: User group ID
    - p_phone_number: Mobile phone number
    - p_osm_first_name: First name
    - p_osm_last_name: Last name
    - p_osm_designation: Staff designation
    - p_incharge_province: Province
    - p_incharge_region: Region
    - p_osm_department: Department
    - p_osm_mobile_phone: Mobile phone
    - p_osm_active: Active status
    - p_osm_locked: Locked status
    - p_osm_staff_id: Staff ID
*/

CREATE OR REPLACE FUNCTION create_staff_member(
  p_email text,
  p_name text,
  p_password text,
  p_group_id bigint,
  p_phone_number text,
  p_osm_first_name text,
  p_osm_last_name text,
  p_osm_designation text,
  p_incharge_province text,
  p_incharge_region text,
  p_osm_department text,
  p_osm_mobile_phone text,
  p_osm_active text,
  p_osm_locked bigint,
  p_osm_staff_id text
) RETURNS void AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Start transaction
  BEGIN
    -- Create user
    INSERT INTO users (email, name, password, group_id)
    VALUES (p_email, p_name, p_password, p_group_id)
    RETURNING id INTO v_user_id;

    -- Create profile
    INSERT INTO profiles (id, email, full_name, phone_number)
    VALUES (v_user_id, p_email, p_name, p_phone_number);

    -- Create staff record
    INSERT INTO owcstaffmaster (
      "OSMFirstName",
      "OSMLastName",
      "OSMDesignation",
      "InchargeProvince",
      "InchargeRegion",
      "OSMDepartment",
      "OSMMobilePhone",
      "OSMActive",
      "OSMLocked",
      "OSMStaffID",
      "CPPSID"
    ) VALUES (
      p_osm_first_name,
      p_osm_last_name,
      p_osm_designation,
      p_incharge_province,
      p_incharge_region,
      p_osm_department,
      p_osm_mobile_phone,
      p_osm_active,
      p_osm_locked,
      p_osm_staff_id,
      v_user_id
    );

    -- If we get here, commit the transaction
    COMMIT;
  EXCEPTION WHEN OTHERS THEN
    -- If we get here, rollback the transaction
    ROLLBACK;
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;
