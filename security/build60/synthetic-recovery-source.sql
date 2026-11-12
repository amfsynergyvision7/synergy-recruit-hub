-- Build60: synthetic-only backup recovery database; NO CRM production data.
-- Execute only via recovery-disposable-ci.sh against localhost GitHub PG17.
CREATE TABLE public.candidates(
 id uuid PRIMARY KEY,
 assigned_recruiter uuid NOT NULL,
 stage text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.billing(
 id uuid PRIMARY KEY,
 invoice_number text NOT NULL,
 amount numeric NOT NULL,
 payment_status text NOT NULL
);
CREATE TABLE public.audit_logs(
 id uuid PRIMARY KEY,
 action text NOT NULL,
 record_id uuid NOT NULL
);
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY candidate_own_read ON public.candidates FOR SELECT
 TO authenticated USING (
 assigned_recruiter=nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
);
REVOKE ALL PRIVILEGES ON TABLE public.candidates,public.billing,public.audit_logs
 FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
GRANT SELECT ON public.candidates TO authenticated,service_role;
CREATE VIEW public.vw_candidate_filters WITH (security_invoker=true)
 AS SELECT id,assigned_recruiter,stage FROM public.candidates;
REVOKE ALL PRIVILEGES ON TABLE public.vw_candidate_filters
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.vw_candidate_filters TO authenticated,service_role;

CREATE FUNCTION public.crm_recovery_invoice_hold()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $b60_hold$
BEGIN
 RAISE EXCEPTION 'SYNTHETIC billing write HOLD' USING ERRCODE='42501';
 RETURN NULL;
END $b60_hold$;
REVOKE ALL ON FUNCTION public.crm_recovery_invoice_hold()
 FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER zz_b60_invoice_row_hold BEFORE INSERT OR UPDATE OR DELETE
 ON public.billing FOR EACH ROW EXECUTE FUNCTION public.crm_recovery_invoice_hold();
CREATE TRIGGER zz_b60_invoice_truncate_hold BEFORE TRUNCATE
 ON public.billing FOR EACH STATEMENT EXECUTE FUNCTION public.crm_recovery_invoice_hold();

INSERT INTO public.candidates(id,assigned_recruiter,stage) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','lead_received'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb','contacted');
-- Load a historical SYNTHETIC invoice BEFORE the financial triggers for
-- recovery testing; never use a test-only bypass in a release SQL proposal.
ALTER TABLE public.billing DISABLE TRIGGER USER;
INSERT INTO public.billing(id,invoice_number,amount,payment_status)
 VALUES('33333333-3333-4333-8333-333333333333','SYNTHETIC-RECOVERY-ONLY',100.0,'unpaid');
ALTER TABLE public.billing ENABLE TRIGGER USER;
INSERT INTO public.audit_logs(id,action,record_id)
 VALUES('44444444-4444-4444-8444-444444444444','synthetic_invoice_created',
 '33333333-3333-4333-8333-333333333333');
