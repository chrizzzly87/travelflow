-- Explicit service-only policies make the intended isolation visible to database linting.

drop policy if exists "Trip agent runs service access" on public.trip_agent_runs;
create policy "Trip agent runs service access" on public.trip_agent_runs
for all to service_role using (true) with check (true);

drop policy if exists "Trip agent tool calls service access" on public.trip_agent_tool_calls;
create policy "Trip agent tool calls service access" on public.trip_agent_tool_calls
for all to service_role using (true) with check (true);

drop policy if exists "Trip agent usage ledger service access" on public.trip_agent_usage_ledger;
create policy "Trip agent usage ledger service access" on public.trip_agent_usage_ledger
for all to service_role using (true) with check (true);
