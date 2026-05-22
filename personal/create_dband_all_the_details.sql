-- ================== PARAMETERS ==================
\set dbname       'test_db'
\set schemaname   'test'
\set app_prefix   'test'

\set admin_pass   'CHANGEME_ADMIN'
\set rw_pass      'CHANGEME_RW'
\set ro_pass      'CHANGEME_RO'
-- =================================================

-- 1) Create database if not exists
DO $$
DECLARE
  v_dbname   text := :'dbname';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = v_dbname) THEN
    EXECUTE format(
      'CREATE DATABASE %I WITH OWNER = postgres ENCODING ''UTF8'' LC_COLLATE ''en_US.utf8'' LC_CTYPE ''en_US.utf8'' TEMPLATE template0',
      v_dbname
    );
  END IF;
END$$;

-- Connect to the new DB
\c :dbname

-- 2) Create schema if not exists
DO $$
DECLARE
  v_schema text := :'schemaname';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = v_schema
  ) THEN
    EXECUTE format('CREATE SCHEMA %I AUTHORIZATION postgres', v_schema);
  END IF;
END$$;

-- 3) Create group roles: test_admin, test_rw, test_ro (NOLOGIN)
DO $$
DECLARE
  v_prefix text := :'app_prefix';
  r_name   text;
BEGIN
  FOREACH r_name IN ARRAY ARRAY[
    v_prefix || '_admin',
    v_prefix || '_rw',
    v_prefix || '_ro'
  ]
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r_name) THEN
      EXECUTE format(
        'CREATE ROLE %I NOLOGIN INHERIT NOCREATEDB NOCREATEROLE NOSUPERUSER NOBYPASSRLS',
        r_name
      );
    END IF;
  END LOOP;
END$$;

-- 4) Create login users and attach to group roles
DO $$
DECLARE
  v_prefix     text := :'app_prefix';
  v_admin_pass text := :'admin_pass';
  v_rw_pass    text := :'rw_pass';
  v_ro_pass    text := :'ro_pass';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_prefix || '_admin_user') THEN
    EXECUTE format(
      'CREATE USER %I WITH PASSWORD %L INHERIT LOGIN NOCREATEDB NOCREATEROLE NOSUPERUSER',
      v_prefix || '_admin_user', v_admin_pass
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_prefix || '_rw_user') THEN
    EXECUTE format(
      'CREATE USER %I WITH PASSWORD %L INHERIT LOGIN NOCREATEDB NOCREATEROLE NOSUPERUSER',
      v_prefix || '_rw_user', v_rw_pass
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_prefix || '_ro_user') THEN
    EXECUTE format(
      'CREATE USER %I WITH PASSWORD %L INHERIT LOGIN NOCREATEDB NOCREATEROLE NOSUPERUSER',
      v_prefix || '_ro_user', v_ro_pass
    );
  END IF;

  EXECUTE format('GRANT %I TO %I', v_prefix || '_admin', v_prefix || '_admin_user');
  EXECUTE format('GRANT %I TO %I', v_prefix || '_rw',    v_prefix || '_rw_user');
  EXECUTE format('GRANT %I TO %I', v_prefix || '_ro',    v_prefix || '_ro_user');
END$$;

-- 5) Schema usage + owner to admin role
DO $$
DECLARE
  v_schema text := :'schemaname';
  v_prefix text := :'app_prefix';
BEGIN
  EXECUTE format(
    'GRANT USAGE ON SCHEMA %I TO %I, %I, %I',
    v_schema,
    v_prefix || '_admin',
    v_prefix || '_rw',
    v_prefix || '_ro'
  );

  EXECUTE format(
    'ALTER SCHEMA %I OWNER TO %I',
    v_schema, v_prefix || '_admin'
  );
END$$;

-- 6) Default privileges for objects created by test_admin_user

SET ROLE :"app_prefix"_admin_user;

-- 6.1 TABLES
DO $$
DECLARE
  v_schema text := :'schemaname';
  v_prefix text := :'app_prefix';
BEGIN
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO %I',
    v_schema, v_prefix || '_ro'
  );

  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
    v_schema, v_prefix || '_rw'
  );

  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO %I',
    v_schema, v_prefix || '_admin'
  );
END$$;

-- 6.2 SEQUENCES
DO $$
DECLARE
  v_schema text := :'schemaname';
  v_prefix text := :'app_prefix';
BEGIN
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO %I',
    v_schema, v_prefix || '_ro'
  );

  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I',
    v_schema, v_prefix || '_rw'
  );

  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON SEQUENCES TO %I',
    v_schema, v_prefix || '_admin'
  );
END$$;

-- 6.3 FUNCTIONS / PROCEDURES
DO $$
DECLARE
  v_schema text := :'schemaname';
  v_prefix text := :'app_prefix';
BEGIN
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT EXECUTE ON FUNCTIONS TO %I',
    v_schema, v_prefix || '_rw'
  );

  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT EXECUTE ON FUNCTIONS TO %I',
    v_schema, v_prefix || '_ro'
  );
END$$;

RESET ROLE;
