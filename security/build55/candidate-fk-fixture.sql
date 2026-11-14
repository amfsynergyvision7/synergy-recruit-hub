-- Synthetic reproduction of the 11 current candidate FK dependency edges.
-- Eight dependent relationship rows are test-only.
ALTER TABLE public.billing ADD COLUMN candidate_uuid uuid;
ALTER TABLE public.billing ADD CONSTRAINT build55_billing_id_fk
 FOREIGN KEY(candidate_id) REFERENCES public.candidates(id) ON DELETE SET NULL;
ALTER TABLE public.billing ADD CONSTRAINT build55_billing_uuid_fk
 FOREIGN KEY(candidate_uuid) REFERENCES public.candidates(id) ON DELETE SET NULL;
CREATE TABLE public.submissions(
 candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
 candidate_uuid uuid REFERENCES public.candidates(id) ON DELETE CASCADE
);
CREATE TABLE public.interviews(
 candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
 candidate_uuid uuid REFERENCES public.candidates(id) ON DELETE CASCADE
);
CREATE TABLE public.offers(
 candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
 candidate_uuid uuid REFERENCES public.candidates(id) ON DELETE CASCADE
);
CREATE TABLE public.candidate_stage_history(
 candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE
);
INSERT INTO public.submissions VALUES
 ('11111111-1111-4111-8111-111111111111',null),
 (null,'11111111-1111-4111-8111-111111111111');
INSERT INTO public.interviews VALUES
 ('11111111-1111-4111-8111-111111111111',null),
 (null,'11111111-1111-4111-8111-111111111111');
INSERT INTO public.offers VALUES
 ('11111111-1111-4111-8111-111111111111',null),
 (null,'11111111-1111-4111-8111-111111111111');
INSERT INTO public.candidate_stage_history VALUES
 ('11111111-1111-4111-8111-111111111111');
INSERT INTO public.billing(candidate_id,candidate_uuid) VALUES
 ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111');
