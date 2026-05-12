
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin','recruiter','operations','finance','viewer');
CREATE TYPE public.user_status AS ENUM ('pending','approved','rejected','suspended');
CREATE TYPE public.candidate_stage AS ENUM (
  'lead_received','contacted','interested','resume_collected','submitted_to_client',
  'interview_scheduled','interview_completed','selected','offer_released','joined','rejected','dropped'
);

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  department TEXT,
  role_request TEXT,
  status public.user_status NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = _user_id AND status='approved' AND is_active=true)
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1 WHEN 'recruiter' THEN 2 WHEN 'operations' THEN 3
    WHEN 'finance' THEN 4 WHEN 'viewer' THEN 5 END
  LIMIT 1
$$;

-- ============ CLIENTS ============
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  active_positions INTEGER DEFAULT 0,
  agreement_type TEXT,
  billing_model TEXT,
  status TEXT DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- ============ JOB OPENINGS ============
CREATE TABLE public.job_openings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  location TEXT,
  salary_min NUMERIC,
  salary_max NUMERIC,
  assigned_recruiter UUID REFERENCES auth.users(id),
  open_positions INTEGER DEFAULT 1,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;

-- ============ CANDIDATES ============
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  location TEXT,
  position_applied TEXT,
  current_company TEXT,
  experience_years NUMERIC,
  current_salary NUMERIC,
  expected_salary NUMERIC,
  notice_period TEXT,
  resume_url TEXT,
  source TEXT,
  assigned_recruiter UUID REFERENCES auth.users(id),
  stage public.candidate_stage NOT NULL DEFAULT 'lead_received',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- Candidate code generator
CREATE SEQUENCE IF NOT EXISTS public.candidate_code_seq START 1000;
CREATE OR REPLACE FUNCTION public.set_candidate_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.candidate_code IS NULL THEN
    NEW.candidate_code := 'CAND-' || nextval('public.candidate_code_seq');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_candidate_code BEFORE INSERT ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.set_candidate_code();

-- ============ SUBMISSIONS ============
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.job_openings(id) ON DELETE SET NULL,
  role_title TEXT,
  submission_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'submitted',
  remarks TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Auto update candidate stage on submission
CREATE OR REPLACE FUNCTION public.on_submission_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.candidates SET stage='submitted_to_client', updated_at=now() WHERE id=NEW.candidate_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_submission_insert AFTER INSERT ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.on_submission_insert();

-- ============ INTERVIEWS ============
CREATE TABLE public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  round TEXT,
  interview_date DATE,
  interview_time TIME,
  mode TEXT,
  feedback TEXT,
  status TEXT DEFAULT 'scheduled',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.on_interview_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status='scheduled' THEN
    UPDATE public.candidates SET stage='interview_scheduled', updated_at=now() WHERE id=NEW.candidate_id AND stage NOT IN ('selected','offer_released','joined');
  ELSIF NEW.status='completed' THEN
    UPDATE public.candidates SET stage='interview_completed', updated_at=now() WHERE id=NEW.candidate_id AND stage NOT IN ('selected','offer_released','joined');
  ELSIF NEW.status='selected' THEN
    UPDATE public.candidates SET stage='selected', updated_at=now() WHERE id=NEW.candidate_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_interview_ins AFTER INSERT ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.on_interview_change();
CREATE TRIGGER trg_interview_upd AFTER UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.on_interview_change();

-- ============ OFFERS ============
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  offer_date DATE,
  joining_date DATE,
  salary NUMERIC,
  ctc NUMERIC,
  offer_status TEXT DEFAULT 'pending',
  joining_status TEXT DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.on_offer_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.offer_status='released' THEN
    UPDATE public.candidates SET stage='offer_released', updated_at=now() WHERE id=NEW.candidate_id;
  END IF;
  IF NEW.joining_status='joined' THEN
    UPDATE public.candidates SET stage='joined', updated_at=now() WHERE id=NEW.candidate_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_offer_ins AFTER INSERT ON public.offers FOR EACH ROW EXECUTE FUNCTION public.on_offer_change();
CREATE TRIGGER trg_offer_upd AFTER UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.on_offer_change();

-- ============ BILLING ============
CREATE TABLE public.billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  salary NUMERIC,
  placement_fee NUMERIC,
  gst NUMERIC,
  invoice_amount NUMERIC,
  payment_status TEXT DEFAULT 'unpaid',
  outstanding_amount NUMERIC,
  invoice_date DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.billing ENABLE ROW LEVEL SECURITY;

CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START 1000;
CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || to_char(now(),'YYYY') || '-' || nextval('public.invoice_seq');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_invoice_no BEFORE INSERT ON public.billing FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number();

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============ HANDLE NEW USER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_email TEXT := NEW.email;
  v_is_primary BOOLEAN := lower(NEW.email) = 'argha200739@gmail.com';
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, department, role_request, status, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(v_email,'@',1)),
    v_email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'role_request',
    CASE WHEN v_is_primary THEN 'approved'::user_status ELSE 'pending'::user_status END,
    true
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN v_is_primary THEN 'admin'::app_role ELSE 'viewer'::app_role END);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER t_profiles_u BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_clients_u BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_jobs_u BEFORE UPDATE ON public.job_openings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_candidates_u BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_offers_u BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_billing_u BEFORE UPDATE ON public.billing FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ RLS POLICIES ============
-- profiles: any approved user can read all; users can update own basic fields; admins can update all
CREATE POLICY "approved read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_approved(auth.uid()) OR auth.uid()=id);
CREATE POLICY "self update profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()=id);
CREATE POLICY "admin update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY "approved read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_approved(auth.uid()) OR user_id=auth.uid());
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Generic helper: approved read everywhere
-- candidates
CREATE POLICY "read candidates" ON public.candidates FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "insert candidates" ON public.candidates FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'));
CREATE POLICY "update candidates" ON public.candidates FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter') OR public.has_role(auth.uid(),'operations'));
CREATE POLICY "delete candidates" ON public.candidates FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- clients
CREATE POLICY "read clients" ON public.clients FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'));
CREATE POLICY "update clients" ON public.clients FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'));
CREATE POLICY "delete clients" ON public.clients FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- job_openings
CREATE POLICY "read jobs" ON public.job_openings FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "insert jobs" ON public.job_openings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'));
CREATE POLICY "update jobs" ON public.job_openings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'));
CREATE POLICY "delete jobs" ON public.job_openings FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- submissions
CREATE POLICY "read subs" ON public.submissions FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "insert subs" ON public.submissions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'));
CREATE POLICY "update subs" ON public.submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'));
CREATE POLICY "delete subs" ON public.submissions FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- interviews
CREATE POLICY "read int" ON public.interviews FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "insert int" ON public.interviews FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'));
CREATE POLICY "update int" ON public.interviews FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'));
CREATE POLICY "delete int" ON public.interviews FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- offers
CREATE POLICY "read off" ON public.offers FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "insert off" ON public.offers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter') OR public.has_role(auth.uid(),'operations'));
CREATE POLICY "update off" ON public.offers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations') OR public.has_role(auth.uid(),'recruiter'));
CREATE POLICY "delete off" ON public.offers FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- billing
CREATE POLICY "read bill" ON public.billing FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "insert bill" ON public.billing FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance'));
CREATE POLICY "update bill" ON public.billing FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance'));
CREATE POLICY "delete bill" ON public.billing FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- notifications
CREATE POLICY "read notif" ON public.notifications FOR SELECT TO authenticated USING (user_id=auth.uid() OR user_id IS NULL);
CREATE POLICY "insert notif" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update notif" ON public.notifications FOR UPDATE TO authenticated USING (user_id=auth.uid());

-- audit_logs
CREATE POLICY "read audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
