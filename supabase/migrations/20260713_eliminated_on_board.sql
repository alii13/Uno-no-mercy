-- Move elimination onto the version-CAS'd board. Apply in the Supabase SQL
-- editor BEFORE deploying the client built from this branch. Additive and
-- backward compatible: older clients never send eliminated_user_ids, so
-- jsonb_populate_record leaves the locked row's value untouched for them.
--
-- Why: is_eliminated lives on game_players rows, synced only by best-effort
-- broadcasts + a throttled pgchanges backstop. A peer that misses one frame
-- keeps a knocked-out player "active" forever, then hands them the turn via a
-- write that lands (only games.version is compare-and-swapped, not the hand
-- rows) — a permanent soft-lock. Putting the eliminated set on the games row
-- makes it ride the same version gate as the rest of the board.

alter table public.games
  add column if not exists eliminated_user_ids jsonb not null default '[]'::jsonb;

-- Recreate commit_move with eliminated_user_ids added to the explicit UPDATE
-- column list. The RPC lists columns by name; a key present in p_patch for a
-- column NOT in this list is silently dropped, so this line is what makes
-- eliminated_user_ids actually commit. Everything else is unchanged from
-- 20260711_commit_move_rpc.sql. SECURITY INVOKER preserved.

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
  select * into v_row
  from public.games
  where id = p_game_id and version = p_expected_version
  for update;

  if not found then
    return false;
  end if;

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
    eliminated_user_ids = v_row.eliminated_user_ids,
    winner_id = v_row.winner_id,
    status = v_row.status,
    version = p_expected_version + 1
  where id = p_game_id;

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
