-- Enable helper extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Profiles (extend auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Groups
CREATE TABLE IF NOT EXISTS marup_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  contribution_amount NUMERIC(12,2) NOT NULL, -- monthly contribution per member
  max_members INT NOT NULL,                     -- how many friends in group
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true
);

-- Group memberships
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES marup_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  has_won BOOLEAN NOT NULL DEFAULT false, -- whether the member already won in current cycle
  UNIQUE(group_id, user_id)
);

-- Rounds: each group has multiple rounds (one per member per cycle)
CREATE TABLE IF NOT EXISTS group_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES marup_groups(id) ON DELETE CASCADE,
  round_number INT NOT NULL, -- 1..N within cycle
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date DATE NOT NULL, -- month when contributions must be made
  winner_user_id UUID REFERENCES auth.users(id),
  total_amount NUMERIC(12,2) DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_grp_rounds_grp ON group_rounds(group_id, round_number);

-- Contributions (money deposited by members for a round)
CREATE TABLE IF NOT EXISTS contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES marup_groups(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES group_rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK(amount > 0),
  contributed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(round_id, user_id) -- one contribution per user per round
);

CREATE INDEX IF NOT EXISTS idx_contrib_round ON contributions(round_id);

-- Payouts (record of payouts made when a member wins)
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES marup_groups(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES group_rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE marup_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY profiles_insert_own ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_own ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated USING (true);

-- Groups policies
CREATE POLICY groups_insert_owner ON marup_groups FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY groups_select_auth ON marup_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY groups_update_owner ON marup_groups FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY groups_delete_owner ON marup_groups FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Group members policies
CREATE POLICY group_members_insert_self_or_owner ON group_members FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM marup_groups g WHERE g.id = group_members.group_id AND g.owner_id = auth.uid())
);

CREATE POLICY group_members_select_member ON group_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM marup_groups g WHERE g.id = group_members.group_id AND g.owner_id = auth.uid())
);

CREATE POLICY group_members_update_own_or_owner ON group_members FOR UPDATE TO authenticated USING (
  user_id = auth.uid() OR EXISTS(SELECT 1 FROM marup_groups g WHERE g.id = group_members.group_id AND g.owner_id = auth.uid())
) WITH CHECK (true);

CREATE POLICY group_members_delete_own_or_owner ON group_members FOR DELETE TO authenticated USING (
  user_id = auth.uid() OR EXISTS(SELECT 1 FROM marup_groups g WHERE g.id = group_members.group_id AND g.owner_id = auth.uid())
);

-- Group rounds policies
CREATE POLICY group_rounds_select_member ON group_rounds FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_rounds.group_id AND gm.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM marup_groups g WHERE g.id = group_rounds.group_id AND g.owner_id = auth.uid())
);

CREATE POLICY group_rounds_insert_owner ON group_rounds FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM marup_groups g WHERE g.id = group_rounds.group_id AND g.owner_id = auth.uid())
);

-- Contributions policies
CREATE POLICY contributions_insert_member ON contributions FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = contributions.group_id AND gm.user_id = auth.uid())
);

CREATE POLICY contributions_select_member ON contributions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = contributions.group_id AND gm.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM marup_groups g WHERE g.id = contributions.group_id AND g.owner_id = auth.uid())
);

-- Payouts policies
CREATE POLICY payouts_select_member ON payouts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = payouts.group_id AND gm.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM marup_groups g WHERE g.id = payouts.group_id AND g.owner_id = auth.uid())
);

-- Lottery runner function (to be called by server with service_role)
CREATE OR REPLACE FUNCTION run_round_lottery(p_round_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
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
$$;

-- Trigger function for updating timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to profiles
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();