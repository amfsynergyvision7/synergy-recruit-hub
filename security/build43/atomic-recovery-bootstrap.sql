-- Build43 disposable, synthetic PostgreSQL only. Never use real CRM credentials.
CREATE TYPE public.app_role AS ENUM('admin','recruiter','operations','finance','viewer');
CREATE TYPE public.user_status AS ENUM('pending','approved','rejected');
CREATE TYPE public.candidate_stage AS ENUM('lead_received','screening','interview','offer');
CREATE TABLE public.profiles(id uuid,status public.user_status,is_active boolean);
CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
CREATE TABLE public.google_integrations(id uuid PRIMARY KEY,user_id uuid,last_synced_row int,header_row int,spreadsheet_id text,sheet_name text,connection_status text,last_error text,last_sync timestamptz);
CREATE TABLE public.candidates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),full_name text NOT NULL,mobile text,email text,location text,position_applied text,current_company text,experience_years numeric,current_salary numeric,expected_salary numeric,notice_period text,resume_url text,source text,notes text,stage public.candidate_stage NOT NULL DEFAULT 'lead_received',status text NOT NULL DEFAULT 'active',created_source text,assigned_recruiter uuid);
CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,message text,type text,related_table text,related_id uuid,CONSTRAINT b43_notification_once UNIQUE(related_table,related_id,type));
CREATE SCHEMA crm_private;
CREATE TABLE crm_private.candidate_sync_leases(owner_id uuid PRIMARY KEY,lease_token uuid NOT NULL,expires_at timestamptz NOT NULL);
INSERT INTO public.profiles VALUES('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','approved',true),('11111111-1111-4111-8111-111111111111','approved',true);
INSERT INTO public.user_roles VALUES('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','admin'),('11111111-1111-4111-8111-111111111111','recruiter');
INSERT INTO public.google_integrations(id,user_id,last_synced_row,header_row,spreadsheet_id,sheet_name)
VALUES('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',1,1,'TESTSHEET','Applicants');
INSERT INTO crm_private.candidate_sync_leases(owner_id,lease_token,expires_at)
VALUES('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222',clock_timestamp()+interval '30 minutes');
