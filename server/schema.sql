-- The shared rating of Klyaksa. Runs on Supabase (project "klyaksa").
-- Apply with tools/server.sh. Safe to run again: everything is create-or-replace.
--
-- The app never touches the tables directly. The public key may only call the
-- three functions below, and each player can change only her own row, proven by
-- a secret that lives in her browser (only its hash is stored here).

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

-- Creates the player on first call, afterwards updates her name, avatar,
-- language and stars. Stars only ever go up: a lost device cannot erase them.
create or replace function public.klyaksa_save(
  p_id uuid, p_secret text, p_name text, p_avatar text, p_lang text, p_stars integer, p_visible boolean
) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  h text;
  cur public.players;
  today date := (now() at time zone 'Asia/Jerusalem')::date;
  clean text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 24);
  face text := left(coalesce(nullif(btrim(p_avatar), ''), '🐱'), 16);
  tongue text := case when p_lang in ('ru', 'en', 'he') then p_lang else 'ru' end;
  total integer := greatest(0, least(coalesce(p_stars, 0), 100000));
begin
  if p_id is null or p_secret is null or char_length(p_secret) < 16 then
    raise exception 'bad player' using errcode = '22023';
  end if;
  if clean = '' then
    raise exception 'empty name' using errcode = '22023';
  end if;
  h := encode(digest(p_secret, 'sha256'), 'hex');
  select * into cur from public.players where id = p_id;
  if found then
    if cur.secret_hash <> h then
      raise exception 'not your player' using errcode = '42501';
    end if;
    update public.players
      set name = clean, avatar = face, lang = tongue, stars = greatest(cur.stars, total),
          visible = coalesce(p_visible, true), updated_at = now()
      where id = p_id
      returning stars into total;
  else
    insert into public.players (id, secret_hash, name, avatar, lang, stars, visible)
      values (p_id, h, clean, face, tongue, total, coalesce(p_visible, true));
  end if;
  insert into public.player_days (player_id, day, stars) values (p_id, today, total)
    on conflict (player_id, day) do update set stars = excluded.stars;
  return json_build_object('ok', true, 'stars', total);
end $$;

-- The rating: total stars and stars earned since Sunday (the Israeli school week).
create or replace function public.klyaksa_board(p_limit integer default 100)
returns table (id uuid, name text, avatar text, stars integer, week integer)
language sql security definer stable set search_path = public as $$
  with start as (
    select (date_trunc('week', (now() at time zone 'Asia/Jerusalem')::date + 1) - interval '1 day')::date as d
  )
  select p.id, p.name, p.avatar, p.stars,
    greatest(0, p.stars - coalesce((
      select pd.stars from public.player_days pd, start
      where pd.player_id = p.id and pd.day < start.d
      order by pd.day desc limit 1), 0))::integer as week
  from public.players p
  where p.visible
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

revoke all on function public.klyaksa_save(uuid, text, text, text, text, integer, boolean) from public;
revoke all on function public.klyaksa_board(integer) from public;
revoke all on function public.klyaksa_forget(uuid, text) from public;
grant execute on function public.klyaksa_save(uuid, text, text, text, text, integer, boolean) to anon, authenticated;
grant execute on function public.klyaksa_board(integer) to anon, authenticated;
grant execute on function public.klyaksa_forget(uuid, text) to anon, authenticated;
