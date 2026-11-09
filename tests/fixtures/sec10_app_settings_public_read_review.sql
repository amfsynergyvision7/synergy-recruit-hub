-- SEC-10 review-only production policy migration. DO NOT APPLY WITHOUT APPROVAL.
-- Compiled inside BEGIN/ROLLBACK against production schema.
-- This changes public branding behavior; verify login/onboarding screens first.
begin;
drop policy "public read app settings" on public.app_settings;
create policy "sec10 authenticated read app settings" on public.app_settings
for select to authenticated using (
 (select auth.uid()) is not null
 and public.is_approved((select auth.uid()))
);
revoke select on public.app_settings from anon;
rollback;
