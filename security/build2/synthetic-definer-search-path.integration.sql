-- Disposable-only regression for SECURITY DEFINER search_path and unqualified object resolution.
-- This does not execute or alter any live function.
CREATE SCHEMA build2_trusted;
CREATE SCHEMA build2_attacker;
CREATE TABLE build2_trusted.stage_history (id integer PRIMARY KEY, stage text);
CREATE TABLE build2_attacker.stage_history (id integer PRIMARY KEY, stage text);
CREATE FUNCTION build2_trusted.unsafe_writer() RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER AS $fn$
 BEGIN INSERT INTO stage_history VALUES(1,'unsafe'); END $fn$;
CREATE FUNCTION build2_trusted.safe_writer() RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,build2_trusted AS $fn$
 BEGIN INSERT INTO build2_trusted.stage_history VALUES(2,'safe'); END $fn$;
-- Simulate a definer executing with caller-selected search_path. The unsafe
-- function resolves its unqualified table to attacker schema.
SET search_path=build2_attacker,build2_trusted,pg_catalog;
SELECT build2_trusted.unsafe_writer();
SELECT build2_trusted.safe_writer();
RESET search_path;
DO $check$
BEGIN
 IF (SELECT count(*) FROM build2_attacker.stage_history WHERE id=1)<>1
 OR EXISTS(SELECT 1 FROM build2_trusted.stage_history WHERE id=1)
 OR (SELECT count(*) FROM build2_trusted.stage_history WHERE id=2)<>1
 OR EXISTS(SELECT 1 FROM build2_attacker.stage_history WHERE id=2)
 THEN RAISE EXCEPTION 'search_path boundary not reproduced'; END IF;
END $check$;
SELECT 'PASS: unqualified definer target follows unsafe search_path; qualified fixed-path writer stays trusted' AS result;
