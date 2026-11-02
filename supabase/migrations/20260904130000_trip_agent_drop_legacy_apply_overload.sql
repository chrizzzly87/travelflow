-- Removes the pre-share-token overload of apply_trip_agent_change_set.
--
-- 20260904120000 added a `p_share_token` parameter. `create or replace function`
-- cannot change a signature, so it created a second function rather than
-- replacing the first: the 5-argument version survived, still carrying the
-- defects that migration fixed (a stale proposal whose status update is rolled
-- back by the exception, and no editable-share or trip-expiry check).
--
-- PostgREST picks an overload by the argument names in the request, so the
-- current server code reaches the 6-argument version — but any caller omitting
-- the token silently gets the old behaviour. Drop it.

drop function if exists public.apply_trip_agent_change_set(uuid, uuid, text[], jsonb, jsonb);
