-- Single round-trip move commit. Apply in the Supabase SQL editor BEFORE
-- deploying the client built from this branch — the client calls this RPC for
-- every in-game move. It is additive: older clients that still issue the two
-- separate UPDATEs (games row, then hands) keep working unchanged.
--
-- Today a move is two sequential round trips: a compare-and-swap UPDATE on the
-- games row, then a second UPDATE on the hand rows. This function does both in
-- one transaction, halving the commit latency and closing the partial-failure
-- window (board committed, hands never written) that the client's
-- writeHandsAfterCommit retry existed to paper over.
--
-- SECURITY INVOKER: the function runs as the calling user, so the same RLS that
-- governs the two direct UPDATEs today still governs every write here.

create or replace function public.commit_move(
  p_game_id uuid,
  p_expected_version int,
  p_patch jsonb,
  -- [{ "id": "<game_players.id>", "hand": [...],
  --    "is_eliminated": bool?, "has_called_uno": bool? }]
  p_hands jsonb default '[]'::jsonb
) returns boolean
language plpgsql
security invoker
as $$
declare
  v_row public.games;
  v_hand jsonb;
begin
  -- CAS: lock and read the row only if it is still at the version the caller
  -- computed from. A stale version (someone else wrote first) finds nothing,
  -- so we return false and the client resyncs — same contract as the old
  -- UPDATE ... WHERE version = expected touching 0 rows.
  select * into v_row
  from public.games
  where id = p_game_id and version = p_expected_version
  for update;

  if not found then
    return false;
  end if;

  -- Overlay the patch onto the locked row. jsonb_populate_record coerces each
  -- present key to the games column type (so no per-column casts here) and
  -- leaves absent columns untouched; a key present with JSON null sets the
  -- column to SQL NULL — which is exactly what current_player_id / winner_id
  -- need (a turn can advance to null, a game can clear its winner).
  v_row := jsonb_populate_record(v_row, p_patch);

  update public.games set
    deck = v_row.deck,
    discard_pile = v_row.discard_pile,
    current_color = v_row.current_color,
    current_player_id = v_row.current_player_id,
    direction = v_row.direction,
    draw_stack = v_row.draw_stack,
    turn_state = v_row.turn_state,
    roulette_target_color = v_row.roulette_target_color,
    winner_id = v_row.winner_id,
    status = v_row.status,
    version = p_expected_version + 1
  where id = p_game_id;

  -- Hand rows in the same transaction. is_eliminated / has_called_uno are
  -- optional per element: absent → keep the row's current value.
  for v_hand in select * from jsonb_array_elements(p_hands)
  loop
    update public.game_players gp set
      hand = v_hand->'hand',
      is_eliminated = coalesce((v_hand->>'is_eliminated')::boolean, gp.is_eliminated),
      has_called_uno = coalesce((v_hand->>'has_called_uno')::boolean, gp.has_called_uno)
    where gp.id::text = (v_hand->>'id');
  end loop;

  return true;
end;
$$;
