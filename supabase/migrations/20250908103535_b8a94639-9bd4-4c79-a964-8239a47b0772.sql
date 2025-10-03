-- Fix remaining function security issues

-- Fix trigger_set_timestamp function
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix run_round_lottery function
CREATE OR REPLACE FUNCTION public.run_round_lottery(p_round_id uuid)
RETURNS jsonb AS $$
declare
  grp_id uuid;
  contrib_total numeric := 0;
  winner uuid;
  eligible_count int;
  chosen_offset int;
  eligible_user uuid;
  rem int;
  cycle_members_count int;
  member_rec record;
  winner_payout numeric;
begin
  -- Lock the round row for update
  select group_id, round_number, completed into grp_id, rem, rem from group_rounds where id = p_round_id for update;

  if grp_id is null then
    raise exception 'Round not found: %', p_round_id;
  end if;

  -- ensure round not already completed
  if (select completed from group_rounds where id = p_round_id) then
    return jsonb_build_object('status','already_completed');
  end if;

  -- compute total contributions for the round
  select coalesce(sum(amount),0) into contrib_total from contributions where round_id = p_round_id;

  if contrib_total <= 0 then
    return jsonb_build_object('status','no_contributions');
  end if;

  -- Find eligible members: those in group_members with has_won = false
  create temporary table tmp_eligible_users (user_id uuid) on commit drop;

  insert into tmp_eligible_users(user_id)
  select user_id from group_members where group_id = grp_id and has_won = false;

  select count(*) into eligible_count from tmp_eligible_users;

  if eligible_count = 0 then
    -- cycle finished: reset has_won for all, then everyone becomes eligible
    update group_members set has_won = false where group_id = grp_id;
    insert into tmp_eligible_users(user_id)
    select user_id from group_members where group_id = grp_id;
    select count(*) into eligible_count from tmp_eligible_users;
  end if;

  -- pick random offset between 0 and eligible_count-1
  chosen_offset := floor(random() * eligible_count)::int;

  -- fetch chosen user
  select user_id into eligible_user from tmp_eligible_users offset chosen_offset limit 1;

  if eligible_user is null then
    raise exception 'Failed to pick eligible user';
  end if;

  winner := eligible_user;
  winner_payout := contrib_total;

  -- mark round completed and set winner and total_amount
  update group_rounds set winner_user_id = winner, total_amount = contrib_total, completed = true where id = p_round_id;

  -- record payout
  insert into payouts(group_id, round_id, user_id, amount) values (grp_id, p_round_id, winner, winner_payout);

  -- mark the winner as has_won = true
  update group_members set has_won = true where group_id = grp_id and user_id = winner;

  -- If after this update all members have has_won=true, start a new cycle:
  select count(*) into cycle_members_count from group_members where group_id = grp_id and has_won = false;
  if cycle_members_count = 0 then
    -- reset flags for next cycle
    update group_members set has_won = false where group_id = grp_id;
  end if;

  return jsonb_build_object('status','ok','winner', winner::text, 'amount', winner_payout);
end;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;