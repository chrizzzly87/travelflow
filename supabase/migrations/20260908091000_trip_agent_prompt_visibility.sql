-- Keep agent instructions out of ordinary clients.
--
-- The PoC granted every authenticated user a read of `trip_agent_definitions`
-- (model, fallback, tool allowlist) and of every published row of
-- `trip_agent_prompt_versions` (the system instructions themselves). Nothing in
-- the browser reads either table: the run loads both with the service role,
-- which bypasses RLS. Restricting the policies to administrators removes a
-- needless read of the prompt surface without changing any code path.
--
-- Safe to run twice; safe to leave unapplied (the previous, wider policies keep
-- working).

drop policy if exists "Trip agent definitions authenticated read" on public.trip_agent_definitions;
drop policy if exists "Trip agent definitions admin read" on public.trip_agent_definitions;
create policy "Trip agent definitions admin read" on public.trip_agent_definitions
for select to authenticated using (public.is_admin(auth.uid()));

drop policy if exists "Trip agent published prompts authenticated read" on public.trip_agent_prompt_versions;
drop policy if exists "Trip agent published prompts admin read" on public.trip_agent_prompt_versions;
create policy "Trip agent published prompts admin read" on public.trip_agent_prompt_versions
for select to authenticated using (public.is_admin(auth.uid()));
