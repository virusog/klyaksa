-- The shared class rating of Blobika. Runs on Supabase (project "klyaksa").
-- Apply with tools/server.sh. Safe to run again.
--
-- The app never touches the tables directly. The public key may only call the
-- three functions below, and each player can change only her own row, proven by
-- a secret that lives in her browser (only its hash is stored here).
--
-- Every player belongs to a class, named by a code that comes with the class's
-- invitation link (https://blobika.com/?class=CODE). A class sees only itself,
-- and a device without a code is never sent to the server at all.
--
-- Moderation, by hand with tools/server.sh:
--   hide a name:     update players set visible = false where class_code = 'CODE' and name = 'Name';
--   see a class:     select name, avatar, stars, visible, updated_at from players where class_code = 'CODE' order by stars desc;
--   remove a class:  delete from players where class_code = 'CODE';

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.players (
  id uuid primary key,
  secret_hash text not null,
  name text not null check (char_length(name) between 1 and 24),
  avatar text not null default '🐱' check (char_length(avatar) between 1 and 16),
  lang text not null default 'ru' check (lang in ('ru', 'en', 'he')),
  stars integer not null default 0 check (stars between 0 and 100000),
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.players add column if not exists class_code text not null default '';
create index if not exists players_class on public.players (class_code, stars desc);

-- One row per player per day with her star total at the end of that day,
-- so "this week" can be counted from the last total before the week began.
create table if not exists public.player_days (
  player_id uuid not null references public.players (id) on delete cascade,
  day date not null,
  stars integer not null,
  primary key (player_id, day)
);

alter table public.players enable row level security;
alter table public.player_days enable row level security;
revoke all on public.players, public.player_days from anon, authenticated;

drop function if exists public.klyaksa_save(uuid, text, text, text, text, integer, boolean);
drop function if exists public.klyaksa_board(integer);

-- The day the current school week began (Sunday, Israel time).
create or replace function public.klyaksa_week_start() returns date
language sql stable set search_path = public as $$
  select (date_trunc('week', (now() at time zone 'Asia/Jerusalem')::date + 1) - interval '1 day')::date;
$$;

-- A class code as the app writes it: 4 to 24 of a-z, 0-9 and '-'. Anything else is ''.
create or replace function public.klyaksa_class(p text) returns text
language sql immutable as $$
  select case when lower(btrim(coalesce(p, ''))) ~ '^[a-z0-9-]{4,24}$' then lower(btrim(p)) else '' end;
$$;

-- Creates the player on first call, afterwards updates her name, avatar,
-- language, class and stars. Stars only ever go up: a lost device cannot erase
-- them. To keep the board honest, a player can gain at most 400 stars a day,
-- a new player starts with at most 3000, and a class takes at most 60 new
-- players a day.
create or replace function public.klyaksa_save(
  p_id uuid, p_secret text, p_class text, p_name text, p_avatar text, p_lang text, p_stars integer, p_visible boolean
) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  h text;
  cur public.players;
  today date := (now() at time zone 'Asia/Jerusalem')::date;
  klass text := klyaksa_class(p_class);
  -- Invisible and direction-changing characters are dropped, so a name cannot look empty or reorder its row.
  clean text := left(btrim(regexp_replace(regexp_replace(coalesce(p_name, ''),
    '[\u0001-\u001F\u007F-\u009F­͏؜ᅟᅠ᠎​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ]', '', 'g'),
    '\s+', ' ', 'g')), 24);
  face text := case when p_avatar = any (array['🐱','🐶','🦊','🐰','🐼','🐨','🐯','🦁','🐸','🐵','🦄','🐧',
    '🦉','🐙','🐬','🦋','🐞','🐢','🦖','🐲','🌸','🌈','⭐','🍓']) then p_avatar else '🐱' end;
  tongue text := case when p_lang in ('ru', 'en', 'he') then p_lang else 'ru' end;
  total integer := greatest(0, least(coalesce(p_stars, 0), 100000));
  before_today integer;
  fresh integer;
begin
  if p_id is null or p_secret is null or char_length(p_secret) < 16 then
    raise exception 'bad player' using errcode = '22023';
  end if;
  if klass = '' then
    raise exception 'no class' using errcode = '22023';
  end if;
  if clean !~ '[[:alpha:]]' then
    raise exception 'empty name' using errcode = '22023';
  end if;
  h := encode(digest(p_secret, 'sha256'), 'hex');
  select * into cur from public.players where id = p_id;
  if found then
    if cur.secret_hash <> h then
      raise exception 'not your player' using errcode = '42501';
    end if;
    select pd.stars into before_today from public.player_days pd
      where pd.player_id = p_id and pd.day < today order by pd.day desc limit 1;
    total := greatest(cur.stars, least(total, coalesce(before_today, cur.stars) + 400));
    update public.players
      set name = clean, avatar = face, lang = tongue, class_code = klass, stars = total,
          visible = coalesce(p_visible, true), updated_at = now()
      where id = p_id;
  else
    select count(*) into fresh from public.players
      where class_code = klass and created_at > now() - interval '1 day';
    if fresh >= 60 then
      raise exception 'class is full for today' using errcode = '54000';
    end if;
    total := least(total, 3000);
    insert into public.players (id, secret_hash, name, avatar, lang, stars, visible, class_code)
      values (p_id, h, clean, face, tongue, total, coalesce(p_visible, true), klass);
    -- What she brought with her counts as before this week, so "this week" starts at 0.
    insert into public.player_days (player_id, day, stars) values (p_id, klyaksa_week_start() - 1, total)
      on conflict (player_id, day) do nothing;
  end if;
  insert into public.player_days (player_id, day, stars) values (p_id, today, total)
    on conflict (player_id, day) do update set stars = excluded.stars;
  return json_build_object('ok', true, 'stars', total);
end $$;

-- One class's rating: total stars and stars earned since Sunday (the Israeli
-- school week). No ids leave the server; "me" marks the asking player's own row.
-- Players who have not opened the app for 90 days drop off.
create or replace function public.klyaksa_board(p_class text, p_id uuid default null, p_secret text default null, p_limit integer default 100)
returns table (name text, avatar text, stars integer, week integer, me boolean)
language sql security definer stable set search_path = public, extensions as $$
  select p.name, p.avatar, p.stars,
    greatest(0, p.stars - coalesce((
      select pd.stars from public.player_days pd
      where pd.player_id = p.id and pd.day < klyaksa_week_start()
      order by pd.day desc limit 1), 0))::integer as week,
    (p.id = p_id and p.secret_hash = encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex')) as me
  from public.players p
  where p.class_code = klyaksa_class(p_class) and klyaksa_class(p_class) <> ''
    and p.visible and p.updated_at > now() - interval '90 days'
  order by p.stars desc, p.created_at
  limit least(greatest(coalesce(p_limit, 100), 1), 300);
$$;

-- Removes the player and her history, for a parent who wants her out of the rating.
create or replace function public.klyaksa_forget(p_id uuid, p_secret text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.players
    where id = p_id and secret_hash = encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex');
  return json_build_object('ok', found);
end $$;

-- Supabase grants new functions to anon by default, so the helpers are closed explicitly.
revoke all on function public.klyaksa_week_start() from public, anon, authenticated;
revoke all on function public.klyaksa_class(text) from public, anon, authenticated;
revoke all on function public.klyaksa_save(uuid, text, text, text, text, text, integer, boolean) from public;
revoke all on function public.klyaksa_board(text, uuid, text, integer) from public;
revoke all on function public.klyaksa_forget(uuid, text) from public;
grant execute on function public.klyaksa_save(uuid, text, text, text, text, text, integer, boolean) to anon, authenticated;
grant execute on function public.klyaksa_board(text, uuid, text, integer) to anon, authenticated;
grant execute on function public.klyaksa_forget(uuid, text) to anon, authenticated;
