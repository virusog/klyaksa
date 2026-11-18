-- "My class" of Blobika: the class star rating, the class drawings and the class
-- chat. Runs on Supabase (project "klyaksa"). Apply with tools/server.sh. Safe to run again.
--
-- The app never touches the tables directly. The public key may only call the
-- klyaksa_* functions granted at the end of this file, and each player can change
-- only her own things, proven by a secret that lives in her browser (only its
-- hash is stored here). No player id ever leaves the server.
--
-- Every player belongs to a class, named by a code that comes with the class's
-- invitation link (https://blobika.com/?class=CODE). A class sees only itself,
-- and a device without a code is never sent to the server at all. Drawings and
-- chat always use the class on her own player row, never one sent by the app.
--
-- Moderation, by hand with tools/server.sh "<sql>":
--   see a class:       select name, avatar, stars, visible, updated_at from players where class_code = 'CODE' order by stars desc;
--   block a player:    update players set visible = false where class_code = 'CODE' and name = 'Name';
--                      (hides her rating row, her drawings, her messages and her hearts at once; her own
--                       saves never undo it. Leaving and joining again, or a device that cleared its storage,
--                       comes back as a new player: watch for her name and block again, or remove the class.)
--   remove a class:    delete from players where class_code = 'CODE';   (cascades to everything of theirs)
--   see a class chat:  select m.id, p.name, m.kind, m.body, m.hidden, m.created_at from messages m
--                        join players p on p.id = m.player_id where m.class_code = 'CODE' order by m.id desc limit 100;
--   hide a message:    update messages set hidden = true where id = N;      delete it: delete from messages where id = N;
--   see the drawings:  select d.id, p.name, d.title, d.hidden, d.created_at from posts d
--                        join players p on p.id = d.player_id where d.class_code = 'CODE' order by d.id desc;
--   hide a drawing:    update posts set hidden = true where id = N;         delete it: delete from posts where id = N;
--   undo two reports:  update messages set hidden = false where id = N; delete from reports where kind = 'msg' and target = N;
--                      (for a drawing: update posts ... and kind = 'post')
--   see the reports:   select kind, target, count(*) from reports group by 1, 2 order by 3 desc;
--   this week's ones:  select r.kind, r.target, count(*), max(r.created_at) from reports r
--                        where r.created_at > now() - interval '7 days' group by 1, 2 order by 4 desc;
--                      (nobody is told about a report: look here now and then)
--   a class move:      insert into class_moves values ('typo', 'class-xxxxxx') on conflict do nothing;
--                      (a typed or saved 'typo' becomes 'class-xxxxxx' on her next save; to move those
--                       already there now: update players set class_code = 'class-xxxxxx' where class_code = 'typo';)
--   add a bad word:    insert into bad_words values ('word') on conflict do nothing;
--                      (lower case; matched anywhere inside words, any case; '=word' matches only the whole word)
--
-- Nothing is kept longer than it is shown: each new drawing first deletes drawings older than
-- 90 days, messages older than 30 and reports older than 91. A message or drawing that its author
-- deletes is only emptied and hidden, so it still counts toward her limits until it is purged.

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
-- When she came into her class (null: when she was created). A class takes at most 60 a day.
alter table public.players add column if not exists joined_at timestamptz;
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

-- Class aliases for mistyped codes, added by hand (see the header). A code
-- found here is replaced by its to_code wherever the app sends a class.
create table if not exists public.class_moves (
  from_code text primary key,
  to_code text not null
);

-- Drawings shown to the class. The JPEGs are small: thumb up to 45 KB, image up to 450 KB.
create table if not exists public.posts (
  id bigserial primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  class_code text not null,
  title text not null,
  thumb bytea not null,
  image bytea not null,
  w integer,
  h integer,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists posts_class on public.posts (class_code, created_at desc);
create index if not exists posts_player on public.posts (player_id, created_at desc);
-- Her name and avatar when she posted, so a later rename does not change who drew it,
-- and the bytes it took, still counted after she deletes it.
alter table public.posts add column if not exists name text;
alter table public.posts add column if not exists avatar text;
alter table public.posts add column if not exists bytes integer not null default 0;
update public.posts set bytes = octet_length(thumb) + octet_length(image) where bytes = 0;
create index if not exists posts_at on public.posts (created_at);

-- One heart per player per drawing.
create table if not exists public.post_likes (
  post_id bigint references public.posts (id) on delete cascade,
  player_id uuid references public.players (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, player_id)
);
create index if not exists post_likes_player on public.post_likes (player_id);

-- The class chat. kind 'text' is what she typed, 'result' a finished lesson or
-- game ({"t","what","stars"} as JSON), 'post' the notice of a shared drawing
-- ({"post","what"}), written only by klyaksa_post_add.
create table if not exists public.messages (
  id bigserial primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  class_code text not null,
  kind text not null check (kind in ('text', 'result', 'post')),
  body text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_class on public.messages (class_code, id desc);
create index if not exists messages_player on public.messages (player_id, created_at desc);
create index if not exists messages_at on public.messages (created_at);
-- Her name and avatar when she wrote it (see posts).
alter table public.messages add column if not exists name text;
alter table public.messages add column if not exists avatar text;

-- Who reported which message or drawing. Two different reporters hide it for everyone.
create table if not exists public.reports (
  reporter uuid references public.players (id) on delete cascade,
  kind text check (kind in ('msg', 'post')),
  target bigint,
  created_at timestamptz default now(),
  primary key (reporter, kind, target)
);
create index if not exists reports_target on public.reports (kind, target);
create index if not exists reports_at on public.reports (created_at);

-- Roots of words a child should not see in the chat, replaced by '***'.
create table if not exists public.bad_words (
  word text primary key
);
-- These three were roots, and masked 'ослаблять', 'влюблять' and 'утварь': now whole words.
delete from public.bad_words where word in ('блять', 'блят', 'тварь');
insert into public.bad_words (word) values
  ('=хуй'), ('=хуя'), ('=хуи'), ('=педик'), ('хуйн'), ('хуев'), ('хуёв'), ('нахуй'), ('пизд'),
  ('=блять'), ('блядь'), ('бляд'), ('=блят'), ('сука'), ('суки'), ('сучар'), ('=ебан'), ('ебанут'), ('ебаны'), ('ебаная'), ('ебано'), ('ёбан'),
  ('ебуч'), ('ебло'), ('ебну'), ('ёбну'), ('заеб'), ('заёб'), ('уебок'), ('уёбок'), ('уебищ'),
  ('долбоеб'), ('долбоёб'), ('выебан'), ('мудак'), ('мудил'), ('гандон'), ('гондон'), ('говно'),
  ('говню'), ('дерьм'), ('жопа'), ('жопу'), ('жопе'), ('залуп'), ('шлюх'), ('шалав'), ('пидор'),
  ('пидар'), ('дебил'), ('идиот'), ('кретин'), ('придур'), ('дурак'), ('дурочк'), ('уродин'),
  ('уродк'), ('тупица'), ('лошара'), ('жирдяй'), ('сволоч'), ('скотин'), ('=тварь'), ('мразь'),
  ('ублюд'), ('падла'), ('гнида'), ('засранец'), ('засранк'), ('fuck'), ('shit'), ('bitch'),
  ('asshole'), ('bastard'), ('cunt'), ('whore'), ('slut'), ('dumbass'), ('moron'), ('retard'),
  ('nigger'), ('faggot'), ('wtf'), ('stfu'), ('idiot'), ('זונה'), ('בן זונה'), ('שרמוטה'), ('שרמוט'),
  ('מניאק'), ('מנייק'), ('כוסאמק'), ('כוס אמק'), ('כוס אמא'), ('תזדיין'), ('תזדייני'), ('מזדיין'),
  ('מטומטם'), ('מטומטמת'), ('טמבל'), ('טמבלית'), ('אידיוט'), ('דביל'), ('דבילית'), ('מפגר'), ('מפגרת'),
  ('סתום ת'), ('סתמי ת'),
  -- What children call each other.
  ('=дура'), ('=дуры'), ('=дуру'), ('=тупая'), ('=тупой'), ('=жирная'), ('=лохушка'), ('=лох'), ('=овца'),
  ('=свинья'), ('убей себя'), ('заткнись'), ('=stupid'), ('=ugly'), ('=loser'), ('=dumb'), ('shut up'),
  ('kill yourself'), ('מכוערת'), ('טיפש'), ('דפוקה'), ('סתומה'), ('שמנה'), ('תמותי'),
  -- Apps a stranger would move her to. Hebrew ones are roots: ב/ל/ה stick to the front.
  ('whatsapp'), ('вотсап'), ('ватсап'), ('вацап'), ('telegram'), ('телеграм'), ('instagram'), ('инстаграм'),
  ('=insta'), ('=инста'), ('=инсту'), ('tiktok'), ('тикток'), ('snapchat'), ('снэпчат'), ('discord'), ('дискорд'),
  ('וואטסאפ'), ('ווטסאפ'), ('טלגרם'), ('אינסטגרם'), ('טיקטוק')
  on conflict do nothing;

alter table public.class_moves enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.bad_words enable row level security;
revoke all on public.class_moves, public.posts, public.post_likes, public.messages, public.reports, public.bad_words
  from public, anon, authenticated;
revoke all on sequence public.posts_id_seq, public.messages_id_seq from public, anon, authenticated;

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

-- A class code through class_moves: a known typo becomes the real class.
create or replace function public.klyaksa_moved(p text) returns text
language sql stable set search_path = public as $$
  select coalesce((select nullif(klyaksa_class(m.to_code), '') from public.class_moves m where m.from_code = p and p <> ''), p);
$$;

-- Her own player row, proven by the secret. Only a visible player of a class
-- may use the class drawings and chat; anyone else gets 42501.
create or replace function public.klyaksa_me(p_id uuid, p_secret text) returns public.players
language plpgsql stable set search_path = public, extensions as $$
declare
  cur public.players;
begin
  select * into cur from public.players where id = p_id;
  if not found or p_secret is null or cur.secret_hash <> encode(digest(p_secret, 'sha256'), 'hex')
     or not cur.visible or cur.class_code = '' then
    raise exception 'not a player of a class' using errcode = '42501';
  end if;
  return cur;
end $$;

-- Text the way names are tidied: invisible and direction-changing characters
-- dropped (and the keycap mark, so 0️⃣5️⃣4️⃣ is plain digits), whitespace collapsed,
-- trimmed, cut to n characters.
create or replace function public.klyaksa_clean(p text, n integer) returns text
language sql immutable as $$
  select left(btrim(regexp_replace(regexp_replace(coalesce(p, ''),
    '[\u0001-\u001F\u007F-\u009F\u20E3­͏؜ᅟᅠ᠎​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ]', '', 'g'),
    '\s+', ' ', 'g')), n);
$$;

-- Bad words become '***', in any case. A word is matched anywhere, or only as
-- a whole word when it is stored as '=word'.
create or replace function public.klyaksa_mask_words(p text) returns text
language plpgsql stable set search_path = public as $$
declare
  pat text;
begin
  select string_agg(case when left(b.word, 1) = '=' and char_length(b.word) > 1
           then '\m' || regexp_replace(substr(b.word, 2), '([^[:alnum:]])', '\\\1', 'g') || '\M'
           else regexp_replace(b.word, '([^[:alnum:]])', '\\\1', 'g') end,
         '|' order by char_length(b.word) desc)
    into pat from public.bad_words b where btrim(b.word, '= ') <> '';
  if pat is null or p is null then
    return p;
  end if;
  return regexp_replace(p, pat, '***', 'gi');
end $$;

-- Everything a classmate could use to reach her outside the app becomes '***':
-- e-mail addresses, @handles, links (http://, www., name.com and friends), phone
-- numbers (7 or more digits, maybe split by up to 3 spaces, dashes, dots, slashes,
-- commas or brackets; not by + = :, so sums stay), app names and bad words.
create or replace function public.klyaksa_mask(p text) returns text
language sql stable set search_path = public as $$
  select klyaksa_mask_words(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(coalesce(p, ''),
              '[[:alnum:]._%+-]+@[[:alnum:]-]+(\.[[:alnum:]-]+)+', '***', 'g'),
            '@[[:alnum:]_.]{3,}', '***', 'g'),
          '(https?://|www\.)\S+', '***', 'gi'),
        '([[:alnum:]_-]+\.)+(com|ru|net|org|il|io|app|me|ly|gg|co|info|xyz|рф|be|ee|tv|site|ua|uk|us|link|online|top|live|ws)\M([/?#]\S*)?', '***', 'gi'),
      '\+?\(?\d([ ._/,()–—-]{0,3}\d){6,}', '***', 'g'));
$$;

-- Creates the player on first call, afterwards updates her name, avatar,
-- language, class and stars. Stars only ever go up: a lost device cannot erase
-- them. To keep the board honest, a player can gain at most 400 stars a day,
-- a new player starts with at most 3000, and a class takes at most 60 new
-- players a day (counting those who moved in from another class).
-- The name is masked like the chat, since every classmate sees it. "visible"
-- is set only for a new player: a block by hand (see the header) stays.
-- Moving to another class takes her drawings and messages out of the old one.
-- A class code found in class_moves is replaced by the real one; "class" in the
-- answer is the class actually stored, for the app to adopt.
create or replace function public.klyaksa_save(
  p_id uuid, p_secret text, p_class text, p_name text, p_avatar text, p_lang text, p_stars integer, p_visible boolean
) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  h text;
  cur public.players;
  today date := (now() at time zone 'Asia/Jerusalem')::date;
  klass text := klyaksa_moved(klyaksa_class(p_class));
  -- Invisible and direction-changing characters are dropped, so a name cannot look empty or reorder its row.
  clean text := klyaksa_mask(klyaksa_clean(p_name, 24));
  face text := case when p_avatar = any (array['🐱','🐶','🦊','🐰','🐼','🐨','🐯','🦁','🐸','🐵','🦄','🐧',
    '🦉','🐙','🐬','🦋','🐞','🐢','🦖','🐲','🌸','🌈','⭐','🍓']) then p_avatar else '🐱' end;
  tongue text := case when p_lang in ('ru', 'en', 'he') then p_lang else 'ru' end;
  total integer := greatest(0, least(coalesce(p_stars, 0), 100000));
  before_today integer;
  fresh integer;
  known boolean;
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
  select * into cur from public.players where id = p_id for update;
  known := found;
  if known and cur.secret_hash <> h then
    raise exception 'not your player' using errcode = '42501';
  end if;
  if not known or cur.class_code <> klass then
    select count(*) into fresh from public.players
      where class_code = klass and coalesce(joined_at, created_at) > now() - interval '1 day';
    if fresh >= 60 then
      raise exception 'class is full for today' using errcode = '54000';
    end if;
  end if;
  if known then
    select pd.stars into before_today from public.player_days pd
      where pd.player_id = p_id and pd.day < today order by pd.day desc limit 1;
    total := greatest(cur.stars, least(total, coalesce(before_today, cur.stars) + 400));
    if cur.class_code <> klass then
      -- Emptied and hidden, not deleted, so they still count toward her limits.
      update public.posts set hidden = true, thumb = '\xffd8ff'::bytea, image = '\xffd8ff'::bytea
        where player_id = p_id and class_code <> klass and octet_length(image) > 3;
      update public.messages set hidden = true, body = case when kind = 'post' then body else '' end
        where player_id = p_id and class_code <> klass and not hidden;
    end if;
    update public.players
      set name = clean, avatar = face, lang = tongue, stars = total, updated_at = now(),
          joined_at = case when class_code <> klass then now() else joined_at end, class_code = klass
      where id = p_id;
  else
    total := least(total, 3000);
    insert into public.players (id, secret_hash, name, avatar, lang, stars, visible, class_code)
      values (p_id, h, clean, face, tongue, total, coalesce(p_visible, true), klass);
    -- What she brought with her counts as before this week, so "this week" starts at 0.
    insert into public.player_days (player_id, day, stars) values (p_id, klyaksa_week_start() - 1, total)
      on conflict (player_id, day) do nothing;
  end if;
  insert into public.player_days (player_id, day, stars) values (p_id, today, total)
    on conflict (player_id, day) do update set stars = excluded.stars;
  return json_build_object('ok', true, 'stars', total, 'class', klass);
end $$;

-- One class's rating: total stars and stars earned since Sunday (the Israeli
-- school week). No ids leave the server; "me" marks the asking player's own row.
-- A code in class_moves shows the real class, as klyaksa_save stores it.
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
  where p.class_code = klyaksa_moved(klyaksa_class(p_class)) and klyaksa_class(p_class) <> ''
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

-- Is there anybody in this class? For the app to warn about a mistyped code.
-- The code goes through class_moves; a code without the 'class-' prefix that
-- nobody uses becomes 'class-' || code when that class has players.
-- "players" counts the visible players seen in the last 90 days; "class" is ''
-- for a code that is not a class code at all.
create or replace function public.klyaksa_class_check(p_class text) returns json
language plpgsql security definer stable set search_path = public, extensions as $$
declare
  c text := klyaksa_moved(klyaksa_class(p_class));
  c2 text;
  n integer := 0;
  n2 integer;
begin
  if c <> '' then
    select count(*) into n from public.players p
      where p.class_code = c and p.visible and p.updated_at > now() - interval '90 days';
    if n = 0 and c not like 'class-%' then
      c2 := klyaksa_moved(klyaksa_class('class-' || c));
      if c2 <> '' then
        select count(*) into n2 from public.players p
          where p.class_code = c2 and p.visible and p.updated_at > now() - interval '90 days';
        if n2 > 0 then
          c := c2;
          n := n2;
        end if;
      end if;
    end if;
  end if;
  return json_build_object('class', c, 'players', n);
end $$;

-- Shows one of her drawings to her class, and puts a notice of it in the class chat.
-- p_thumb and p_image are base64 JPEGs without a data: prefix. At most 10 drawings
-- per player and 60 per class in 24 hours, deleted ones included. The free database
-- holds 500 MB, so all classes together get at most 30 MB of drawings a day and
-- 300 MB in all. It first throws away what nobody is shown any more (see the header).
create or replace function public.klyaksa_post_add(
  p_id uuid, p_secret text, p_title text, p_thumb text, p_image text, p_w integer, p_h integer
) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  me public.players := klyaksa_me(p_id, p_secret);
  th bytea;
  im bytea;
  clean text;
  n integer;
  new_id bigint;
begin
  if p_thumb is null or p_image is null or char_length(coalesce(p_title, '')) > 1000 then
    raise exception 'no picture' using errcode = '22023';
  end if;
  -- Measured before decoding: base64 is 4/3 of the bytes.
  if char_length(p_thumb) > 61000 or char_length(p_image) > 610000 then
    raise exception 'picture too big' using errcode = '54000';
  end if;
  begin
    th := decode(p_thumb, 'base64');
    im := decode(p_image, 'base64');
  exception when others then
    raise exception 'not base64' using errcode = '22023';
  end;
  if octet_length(th) > 45000 or octet_length(im) > 450000 then
    raise exception 'picture too big' using errcode = '54000';
  end if;
  if substring(th from 1 for 3) <> '\xffd8ff'::bytea or substring(im from 1 for 3) <> '\xffd8ff'::bytea then
    raise exception 'not a jpeg' using errcode = '22023';
  end if;
  clean := klyaksa_mask(klyaksa_clean(p_title, 60));
  delete from public.posts where created_at < now() - interval '90 days';
  delete from public.messages where created_at < now() - interval '30 days';
  delete from public.reports where created_at < now() - interval '91 days';
  -- One at a time per player, so the limits below cannot be raced.
  perform 1 from public.players where id = me.id for update;
  select count(*) into n from public.posts where player_id = me.id and created_at > now() - interval '24 hours';
  if n >= 10 then
    raise exception 'too many drawings today' using errcode = '54000';
  end if;
  select count(*) into n from public.posts where class_code = me.class_code and created_at > now() - interval '24 hours';
  if n >= 60 then
    raise exception 'too many drawings in the class today' using errcode = '54000';
  end if;
  if (select coalesce(sum(bytes), 0) from public.posts where created_at > now() - interval '24 hours') > 30000000
     or (select coalesce(sum(octet_length(thumb) + octet_length(image)), 0) from public.posts) > 300000000 then
    raise exception 'no room for drawings' using errcode = '54000';
  end if;
  insert into public.posts (player_id, class_code, title, thumb, image, w, h, name, avatar, bytes)
    values (me.id, me.class_code, clean, th, im,
      case when p_w between 1 and 10000 then p_w end, case when p_h between 1 and 10000 then p_h end,
      me.name, me.avatar, octet_length(th) + octet_length(im))
    returning id into new_id;
  insert into public.messages (player_id, class_code, kind, body, name, avatar)
    values (me.id, me.class_code, 'post', json_build_object('post', new_id, 'what', clean)::text, me.name, me.avatar);
  return json_build_object('ok', true, 'id', new_id);
end $$;

-- The drawings of her class: newest first, or with p_sort 'week' the drawings
-- since Sunday with the most hearts first. Drawings older than 90 days, hidden
-- ones, ones of blocked players and ones she reported are left out.
create or replace function public.klyaksa_posts(p_id uuid, p_secret text, p_sort text default 'new', p_limit integer default 60)
returns table (id bigint, name text, avatar text, title text, thumb text, w integer, h integer,
               hearts integer, liked boolean, mine boolean, at timestamptz)
language plpgsql security definer stable set search_path = public, extensions as $$
#variable_conflict use_column
declare
  v_me public.players := klyaksa_me(p_id, p_secret);
  v_week boolean := coalesce(p_sort, '') = 'week';
  v_since timestamptz := case when coalesce(p_sort, '') = 'week'
    then klyaksa_week_start()::timestamp at time zone 'Asia/Jerusalem' else now() - interval '90 days' end;
begin
  -- The drawings are chosen first and only those few thumbnails are encoded.
  return query
  select q.id, q.name, q.avatar, q.title, translate(encode(t.thumb, 'base64'), E'\n', ''), q.w, q.h,
    q.hearts, q.liked, q.mine, q.at
  from (
    select s.* from (
      select d.id, coalesce(d.name, a.name) as name, coalesce(d.avatar, a.avatar) as avatar, d.title, d.w, d.h,
        (select count(*) from public.post_likes l join public.players lp on lp.id = l.player_id
          where l.post_id = d.id and lp.visible)::integer as hearts,
        exists (select 1 from public.post_likes l where l.post_id = d.id and l.player_id = v_me.id) as liked,
        d.player_id = v_me.id as mine, d.created_at as at
      from public.posts d join public.players a on a.id = d.player_id
      where d.class_code = v_me.class_code and not d.hidden and a.visible
        and d.created_at > now() - interval '90 days' and d.created_at >= v_since
        and not exists (select 1 from public.reports r where r.reporter = v_me.id and r.kind = 'post' and r.target = d.id)
    ) s
    order by case when v_week then s.hearts else 0 end desc, s.at desc, s.id desc
    limit least(greatest(coalesce(p_limit, 60), 1), 60)
  ) q join public.posts t on t.id = q.id
  order by case when v_week then q.hearts else 0 end desc, q.at desc, q.id desc;
end $$;

-- The full picture of a drawing of her class.
create or replace function public.klyaksa_post_image(p_id uuid, p_secret text, p_post bigint) returns json
language plpgsql security definer stable set search_path = public, extensions as $$
declare
  me public.players := klyaksa_me(p_id, p_secret);
  im bytea;
begin
  select d.image into im from public.posts d join public.players a on a.id = d.player_id
    where d.id = p_post and d.class_code = me.class_code and not d.hidden and a.visible;
  if not found then
    raise exception 'no such drawing' using errcode = '22023';
  end if;
  return json_build_object('image', translate(encode(im, 'base64'), E'\n', ''));
end $$;

-- A heart for a classmate's drawing (p_on true) or taking it back. Her own drawings cannot get her heart.
create or replace function public.klyaksa_like(p_id uuid, p_secret text, p_post bigint, p_on boolean) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  me public.players := klyaksa_me(p_id, p_secret);
  author uuid;
begin
  select d.player_id into author from public.posts d join public.players a on a.id = d.player_id
    where d.id = p_post and d.class_code = me.class_code and not d.hidden and a.visible;
  if not found then
    raise exception 'no such drawing' using errcode = '22023';
  end if;
  if author = me.id then
    raise exception 'her own drawing' using errcode = '22023';
  end if;
  if coalesce(p_on, true) then
    insert into public.post_likes (post_id, player_id) values (p_post, me.id) on conflict do nothing;
  else
    delete from public.post_likes where post_id = p_post and player_id = me.id;
  end if;
  return json_build_object(
    'hearts', (select count(*) from public.post_likes l join public.players lp on lp.id = l.player_id
               where l.post_id = p_post and lp.visible)::integer,
    'liked', exists (select 1 from public.post_likes l where l.post_id = p_post and l.player_id = me.id));
end $$;

-- Takes her own drawing back from the class, with its notice in the chat. The
-- pictures are emptied and the row hidden, not deleted: it still counts toward
-- the limits, and the reports on it stay.
create or replace function public.klyaksa_post_delete(p_id uuid, p_secret text, p_post bigint) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  me public.players := klyaksa_me(p_id, p_secret);
begin
  update public.posts set hidden = true, thumb = '\xffd8ff'::bytea, image = '\xffd8ff'::bytea
    where id = p_post and player_id = me.id;
  if not found then
    return json_build_object('ok', false);
  end if;
  update public.messages m set hidden = true
    where m.player_id = me.id and m.kind = 'post'
      and (case when m.kind = 'post' then (m.body::json ->> 'post')::bigint end) = p_post;
  return json_build_object('ok', true);
end $$;

-- Writes to her class chat. kind 'text': tidied, cut to 200 characters, links,
-- phone numbers, e-mails and bad words masked. kind 'result': a JSON object
-- {"t": lesson|game|coloring|draw, "what": text, "stars": 0..3}, stored as the
-- server re-writes it. kind 'post' only comes from klyaksa_post_add.
-- At most one message in 2 seconds, 30 in 10 minutes and 300 a day, deleted ones included.
-- Returns the stored body, which is exactly what the class sees.
create or replace function public.klyaksa_chat_send(p_id uuid, p_secret text, p_kind text, p_body text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  me public.players := klyaksa_me(p_id, p_secret);
  b text;
  j jsonb;
  what text;
  st jsonb;
  last_at timestamptz;
  n10 integer;
  nday integer;
  new_id bigint;
begin
  if p_body is null or char_length(p_body) > 2000 then
    raise exception 'bad message' using errcode = '22023';
  end if;
  if p_kind = 'text' then
    b := klyaksa_clean(p_body, 200);
    -- Something besides punctuation and spaces: a letter, a digit or an emoji.
    if b !~ '[^[:punct:][:space:][:cntrl:]$+<=>^`|~]' then
      raise exception 'empty message' using errcode = '22023';
    end if;
    b := klyaksa_mask(b);
  elsif p_kind = 'result' then
    begin
      j := p_body::jsonb;
    exception when others then
      raise exception 'bad result' using errcode = '22023';
    end;
    if jsonb_typeof(j) <> 'object' or coalesce(j ->> 't', '') not in ('lesson', 'game', 'coloring', 'draw')
       or jsonb_typeof(j -> 'what') is distinct from 'string' then
      raise exception 'bad result' using errcode = '22023';
    end if;
    what := klyaksa_mask(klyaksa_clean(j ->> 'what', 80));
    if what = '' then
      raise exception 'bad result' using errcode = '22023';
    end if;
    st := j -> 'stars';
    if st is not null and jsonb_typeof(st) <> 'null' then
      if jsonb_typeof(st) <> 'number' or (st::text) !~ '^[0-3]$' then
        raise exception 'bad result' using errcode = '22023';
      end if;
      b := jsonb_build_object('t', j ->> 't', 'what', what, 'stars', st::text::integer)::text;
    else
      b := jsonb_build_object('t', j ->> 't', 'what', what)::text;
    end if;
  else
    raise exception 'bad kind' using errcode = '22023';
  end if;
  -- One at a time per player, so the limits below cannot be raced.
  perform 1 from public.players where id = me.id for update;
  select max(created_at), count(*) filter (where created_at > now() - interval '10 minutes'), count(*)
    into last_at, n10, nday
    from public.messages
    where player_id = me.id and kind <> 'post' and created_at > now() - interval '24 hours';
  if last_at > now() - interval '2 seconds' or n10 >= 30 or nday >= 300 then
    raise exception 'too fast' using errcode = '54000';
  end if;
  insert into public.messages (player_id, class_code, kind, body, name, avatar)
    values (me.id, me.class_code, p_kind, b, me.name, me.avatar) returning id into new_id;
  return json_build_object('id', new_id, 'body', b);
end $$;

-- Her class chat, oldest first: the newest p_limit messages, or with p_after
-- the messages after that id (for polling). Only the last 30 days; hidden
-- messages, messages of blocked players, ones she reported and notices of
-- drawings that are gone for her are left out.
create or replace function public.klyaksa_chat(p_id uuid, p_secret text, p_after bigint default 0, p_limit integer default 80)
returns table (id bigint, name text, avatar text, kind text, body text, at timestamptz, mine boolean)
language plpgsql security definer stable set search_path = public, extensions as $$
#variable_conflict use_column
declare
  v_me public.players := klyaksa_me(p_id, p_secret);
  v_lim integer := least(greatest(coalesce(p_limit, 80), 1), 120);
  v_after bigint := greatest(coalesce(p_after, 0), 0);
begin
  return query
  select q.id, q.name, q.avatar, q.kind, q.body, q.at, q.mine from (
    select m.id, coalesce(m.name, a.name) as name, coalesce(m.avatar, a.avatar) as avatar, m.kind, m.body, m.created_at as at, m.player_id = v_me.id as mine
    from public.messages m join public.players a on a.id = m.player_id
    where m.class_code = v_me.class_code and not m.hidden and a.visible
      and m.created_at > now() - interval '30 days' and m.id > v_after
      and not exists (select 1 from public.reports r where r.reporter = v_me.id and r.kind = 'msg' and r.target = m.id)
      and (m.kind <> 'post' or exists (
        select 1 from public.posts d
        where d.id = (case when m.kind = 'post' then (m.body::json ->> 'post')::bigint end) and not d.hidden
          and not exists (select 1 from public.reports r where r.reporter = v_me.id and r.kind = 'post' and r.target = d.id)))
    order by case when v_after > 0 then m.id else -m.id end
    limit v_lim
  ) q
  order by q.id;
end $$;

-- Deletes one of her own messages: emptied and hidden, so it still counts toward
-- her limits and the reports on it stay. A drawing's notice keeps its body, which
-- the chat reads as JSON.
create or replace function public.klyaksa_chat_delete(p_id uuid, p_secret text, p_msg bigint) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  me public.players := klyaksa_me(p_id, p_secret);
begin
  update public.messages set hidden = true, body = case when kind = 'post' then body else '' end
    where id = p_msg and player_id = me.id;
  return json_build_object('ok', found);
end $$;

-- Reports a classmate's message ('msg') or drawing ('post'). It disappears for
-- her at once, and for everyone once two different classmates reported it.
-- At most 50 reports a day.
create or replace function public.klyaksa_report(p_id uuid, p_secret text, p_kind text, p_target bigint) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  me public.players := klyaksa_me(p_id, p_secret);
  author uuid;
  n integer;
begin
  if p_kind = 'msg' then
    select m.player_id into author from public.messages m where m.id = p_target and m.class_code = me.class_code;
  elsif p_kind = 'post' then
    select d.player_id into author from public.posts d where d.id = p_target and d.class_code = me.class_code;
  else
    raise exception 'bad kind' using errcode = '22023';
  end if;
  if author is null or author = me.id then
    raise exception 'nothing to report' using errcode = '22023';
  end if;
  select count(*) into n from public.reports where reporter = me.id and created_at > now() - interval '24 hours';
  if n >= 50 then
    raise exception 'too many reports' using errcode = '54000';
  end if;
  insert into public.reports (reporter, kind, target) values (me.id, p_kind, p_target) on conflict do nothing;
  select count(distinct reporter) into n from public.reports where kind = p_kind and target = p_target;
  if n >= 2 then
    if p_kind = 'msg' then
      update public.messages set hidden = true where id = p_target;
    else
      update public.posts set hidden = true where id = p_target;
      update public.messages m set hidden = true
        where m.player_id = author and m.kind = 'post'
          and (case when m.kind = 'post' then (m.body::json ->> 'post')::bigint end) = p_target;
    end if;
  end if;
  return json_build_object('ok', true);
end $$;

-- The newest message and drawing of her classmates, for the "new" badge on the home screen:
-- the same ones klyaksa_chat and klyaksa_posts show her, or the badge would never go away.
create or replace function public.klyaksa_news(p_id uuid, p_secret text) returns json
language plpgsql security definer stable set search_path = public, extensions as $$
declare
  me public.players := klyaksa_me(p_id, p_secret);
begin
  return json_build_object(
    'msg', coalesce((select max(m.id) from public.messages m join public.players a on a.id = m.player_id
      where m.class_code = me.class_code and m.player_id <> me.id and not m.hidden and a.visible
        and m.created_at > now() - interval '30 days'
        and not exists (select 1 from public.reports r where r.reporter = me.id and r.kind = 'msg' and r.target = m.id)
        and (m.kind <> 'post' or exists (
          select 1 from public.posts d
          where d.id = (case when m.kind = 'post' then (m.body::json ->> 'post')::bigint end) and not d.hidden
            and not exists (select 1 from public.reports r where r.reporter = me.id and r.kind = 'post' and r.target = d.id)))), 0),
    'post', coalesce((select max(d.id) from public.posts d join public.players a on a.id = d.player_id
      where d.class_code = me.class_code and d.player_id <> me.id and not d.hidden and a.visible
        and d.created_at > now() - interval '90 days'
        and not exists (select 1 from public.reports r where r.reporter = me.id and r.kind = 'post' and r.target = d.id)), 0));
end $$;

-- Supabase grants new functions to anon by default, so the helpers are closed explicitly.
revoke all on function public.klyaksa_week_start() from public, anon, authenticated;
revoke all on function public.klyaksa_class(text) from public, anon, authenticated;
revoke all on function public.klyaksa_moved(text) from public, anon, authenticated;
revoke all on function public.klyaksa_me(uuid, text) from public, anon, authenticated;
revoke all on function public.klyaksa_clean(text, integer) from public, anon, authenticated;
revoke all on function public.klyaksa_mask_words(text) from public, anon, authenticated;
revoke all on function public.klyaksa_mask(text) from public, anon, authenticated;
revoke all on function public.klyaksa_save(uuid, text, text, text, text, text, integer, boolean) from public;
revoke all on function public.klyaksa_board(text, uuid, text, integer) from public;
revoke all on function public.klyaksa_forget(uuid, text) from public;
grant execute on function public.klyaksa_save(uuid, text, text, text, text, text, integer, boolean) to anon, authenticated;
grant execute on function public.klyaksa_board(text, uuid, text, integer) to anon, authenticated;
grant execute on function public.klyaksa_forget(uuid, text) to anon, authenticated;

-- The class drawings and chat.
revoke all on function public.klyaksa_class_check(text) from public;
revoke all on function public.klyaksa_post_add(uuid, text, text, text, text, integer, integer) from public;
revoke all on function public.klyaksa_posts(uuid, text, text, integer) from public;
revoke all on function public.klyaksa_post_image(uuid, text, bigint) from public;
revoke all on function public.klyaksa_like(uuid, text, bigint, boolean) from public;
revoke all on function public.klyaksa_post_delete(uuid, text, bigint) from public;
revoke all on function public.klyaksa_chat_send(uuid, text, text, text) from public;
revoke all on function public.klyaksa_chat(uuid, text, bigint, integer) from public;
revoke all on function public.klyaksa_chat_delete(uuid, text, bigint) from public;
revoke all on function public.klyaksa_report(uuid, text, text, bigint) from public;
revoke all on function public.klyaksa_news(uuid, text) from public;
grant execute on function public.klyaksa_class_check(text) to anon, authenticated;
grant execute on function public.klyaksa_post_add(uuid, text, text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.klyaksa_posts(uuid, text, text, integer) to anon, authenticated;
grant execute on function public.klyaksa_post_image(uuid, text, bigint) to anon, authenticated;
grant execute on function public.klyaksa_like(uuid, text, bigint, boolean) to anon, authenticated;
grant execute on function public.klyaksa_post_delete(uuid, text, bigint) to anon, authenticated;
grant execute on function public.klyaksa_chat_send(uuid, text, text, text) to anon, authenticated;
grant execute on function public.klyaksa_chat(uuid, text, bigint, integer) to anon, authenticated;
grant execute on function public.klyaksa_chat_delete(uuid, text, bigint) to anon, authenticated;
grant execute on function public.klyaksa_report(uuid, text, text, bigint) to anon, authenticated;
grant execute on function public.klyaksa_news(uuid, text) to anon, authenticated;

-- Tell the API about new and changed functions.
notify pgrst, 'reload schema';
