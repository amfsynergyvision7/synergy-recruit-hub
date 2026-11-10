-- Disposable PostgreSQL 17 only. Minimal auth.users dependency contract; not a Supabase emulator.
-- No business records, no financial triggers, no production connections.
BEGIN;
CREATE SCHEMA build2_auth_fixture;
CREATE TABLE build2_auth_fixture.synthetic_users (id uuid PRIMARY KEY);
CREATE TABLE build2_auth_fixture.synthetic_profiles (
 id uuid PRIMARY KEY REFERENCES build2_auth_fixture.synthetic_users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending'
);
INSERT INTO build2_auth_fixture.synthetic_users(id) VALUES ('00000000-0000-4000-8000-000000000001');
INSERT INTO build2_auth_fixture.synthetic_profiles(id) VALUES ('00000000-0000-4000-8000-000000000001');
DO $$
BEGIN
 IF (SELECT count(*) FROM build2_auth_fixture.synthetic_profiles) <> 1 THEN
   RAISE EXCEPTION 'synthetic auth foreign-key fixture failed';
 END IF;
 BEGIN
  INSERT INTO build2_auth_fixture.synthetic_profiles(id) VALUES ('00000000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'foreign key allowed an unknown synthetic user';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
END $$;
DELETE FROM build2_auth_fixture.synthetic_users WHERE id='00000000-0000-4000-8000-000000000001';
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM build2_auth_fixture.synthetic_profiles) THEN
  RAISE EXCEPTION 'synthetic auth cascade failed';
 END IF;
END $$;
ROLLBACK;
SELECT 'PASS: disposable synthetic auth FK dependency and rollback only' AS result;
