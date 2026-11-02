-- Trip Agent: correct the edit-permission check and the stale-proposal write.
--
-- Two defects found in review of the PoC:
--   1. `trip_agent_can_edit` accepted only owners and explicit collaborators, so
--      an authenticated editor working through an editable share link was
--      refused, and a trip past `trip_expires_at` was still editable.
--   2. `apply_trip_agent_change_set` marked a proposal `stale` and then raised
--      in the same transaction, which rolls the status update back: the row
--      stayed `pending` and the panel kept offering a dead proposal.

-- Expiry belongs in the base check; share access needs proof of the token, so
-- it is a separate function the caller uses when a token was presented.
create or replace function public.trip_agent_can_edit(p_trip_id text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select p_user_id is not null and exists (
    select 1
      from public.trips t
     where t.id = p_trip_id
       and t.status = 'active'
       and (t.trip_expires_at is null or t.trip_expires_at > now())
       and (
         t.owner_id = p_user_id
         or exists (
           select 1 from public.trip_collaborators tc
            where tc.trip_id = t.id
              and tc.user_id = p_user_id
              and tc.role = 'editor'
         )
       )
  );
$$;

/**
 * Edit permission for an authenticated user who presented a share token.
 * The token must be an active, unexpired editable share for that trip; holding
 * one is what grants the access, so the token is required rather than implied.
 */
create or replace function public.trip_agent_can_edit_with_share(
  p_trip_id text,
  p_user_id uuid,
  p_share_token text
)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.trip_agent_can_edit(p_trip_id, p_user_id)
    or (
      p_user_id is not null
      and p_share_token is not null
      and exists (
        select 1
          from public.trip_shares ts
          join public.trips t on t.id = ts.trip_id
         where ts.trip_id = p_trip_id
           and ts.token = p_share_token
           and ts.mode = 'edit'
           and ts.revoked_at is null
           and (ts.expires_at is null or ts.expires_at > now())
           and t.status = 'active'
           and (t.trip_expires_at is null or t.trip_expires_at > now())
      )
    );
$$;

create or replace function public.apply_trip_agent_change_set(
  p_actor_id uuid,
  p_change_set_id uuid,
  p_selected_operation_ids text[],
  p_trip_data jsonb,
  p_view_settings jsonb default null,
  p_share_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_change public.trip_agent_change_sets%rowtype;
  v_trip public.trips%rowtype;
  v_version_id uuid;
  v_operation_ids text[];
  v_status text;
begin
  select * into v_change from public.trip_agent_change_sets
   where id = p_change_set_id for update;
  if not found or v_change.status <> 'pending' then
    raise exception 'TRIP_AGENT_CHANGE_SET_NOT_PENDING';
  end if;

  select * into v_trip from public.trips where id = v_change.trip_id for update;
  if not found or not public.trip_agent_can_edit_with_share(v_change.trip_id, p_actor_id, p_share_token) then
    raise exception 'TRIP_AGENT_EDIT_ACCESS_REQUIRED';
  end if;

  -- A stale proposal is reported as a result, not as an exception: raising here
  -- would roll back the very status update that records it.
  if coalesce((v_trip.data ->> 'updatedAt')::bigint, 0) <> v_change.base_trip_updated_at then
    update public.trip_agent_change_sets
       set status = 'stale'
     where id = p_change_set_id;
    return jsonb_build_object('status', 'stale', 'trip', null, 'versionId', null);
  end if;

  select coalesce(array_agg(value ->> 'id'), '{}') into v_operation_ids
    from jsonb_array_elements(v_change.operations);
  if p_selected_operation_ids is null
     or cardinality(p_selected_operation_ids) = 0
     or not p_selected_operation_ids <@ v_operation_ids then
    raise exception 'TRIP_AGENT_INVALID_OPERATION_SELECTION';
  end if;

  update public.trips
     set data = p_trip_data,
         title = coalesce(nullif(p_trip_data ->> 'title', ''), title),
         start_date = coalesce(nullif(p_trip_data ->> 'startDate', '')::date, start_date),
         view_settings = coalesce(p_view_settings, view_settings),
         updated_at = now()
   where id = v_change.trip_id;

  insert into public.trip_versions(trip_id, data, view_settings, label, created_by)
  values (v_change.trip_id, p_trip_data, coalesce(p_view_settings, v_trip.view_settings), 'Trip Agent: ' || v_change.summary, p_actor_id)
  returning id into v_version_id;

  v_status := case when cardinality(p_selected_operation_ids) = cardinality(v_operation_ids)
    then 'applied' else 'applied_partial' end;
  update public.trip_agent_change_sets
     set status = v_status,
         selected_operation_ids = p_selected_operation_ids,
         applied_version_id = v_version_id,
         applied_at = now()
   where id = p_change_set_id;

  insert into public.trip_user_events(trip_id, owner_id, action, source, metadata)
  values (
    v_change.trip_id,
    v_trip.owner_id,
    'agent_change_set_applied',
    'trip_agent',
    jsonb_build_object('actor_id', p_actor_id, 'change_set_id', p_change_set_id, 'version_id', v_version_id, 'operation_count', cardinality(p_selected_operation_ids))
  );

  return jsonb_build_object('trip', p_trip_data, 'versionId', v_version_id, 'status', v_status);
end;
$$;

revoke all on function public.trip_agent_can_edit_with_share(text, uuid, text) from public, anon, authenticated;
revoke all on function public.apply_trip_agent_change_set(uuid, uuid, text[], jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.trip_agent_can_edit_with_share(text, uuid, text) to service_role;
grant execute on function public.apply_trip_agent_change_set(uuid, uuid, text[], jsonb, jsonb, text) to service_role;
