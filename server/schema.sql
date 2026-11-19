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
-- Moderation: the parents' admin page, https://blobika.com/admin/ (admin/ in this project), does it all
-- through klyaksa_admin: the players of every class (block, rename, move to another class, delete), the
-- whole class chat and the drawings (hide, show, delete), the reports, switches per class and for all
-- classes (chat, drawings, closed to newcomers), the bad words, the class moves, statistics and a log of
-- every change it made.
--   It needs an admin key: a long random string that only the parent holds. Only its sha256 is stored, so
--   make the key and its hash on your own computer and send only the hash:
--     key=$(openssl rand -hex 32); echo "$key"          (keep it somewhere safe)
--     printf %s "$key" | shasum -a 256                  (the hash)
--     tools/server.sh "insert into admin_keys (hash, note) values ('<the hash>', 'dad')"
--   then open https://blobika.com/admin/ and paste the key into its field (tick "remember" only on your own
--   device; otherwise it is forgotten with the tab). /admin/#key=<the key> works too, but the address with the
--   key stays in the browser's history and its sync: do not send such a link through a chat, and delete it
--   from the history afterwards. Take a key back: delete from admin_keys where note = 'dad';
--   A wrong key waits 0.3 s and gets 42501.
--   Blocking a player (visible = false) hides her rating row, her drawings, her messages and her hearts at
--   once. Her own saves never undo it, nor does leaving and joining again from her parents' screen
--   (klyaksa_forget keeps the row of a player the admin page blocked, renamed or moved). A device whose
--   storage is wiped gets a new id and comes back as a newcomer, so also close the class to newcomers.
--   Deleting her removes everything of hers, but a device that still has her secret comes back as a new
--   player on its next save: block rather than delete. A rename or a move by the admin page sticks: her
--   app adopts it. Deleting a class closes it to newcomers, or the girls' devices would make it again.
--   Nobody is told about a report: the Reports section of the page shows them (two reporters hide a thing).
--   Anything else, by hand with tools/server.sh "<sql>", e.g. this week's reports:
--     select r.kind, r.target, count(*), max(r.created_at) from reports r
--       where r.created_at > now() - interval '7 days' group by 1, 2 order by 4 desc;
--   Bad words are lower case and matched anywhere inside words, any case; '=word' matches only the whole word.
--   A class move ('typo' -> 'class-xxxxxx') turns a typed or saved 'typo' into the real class on her next save.
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

-- The parents' admin page (see the header). The keys it may use (sha256 hex of each key; no key is
-- made here), what it changed, and the switches per class: the row '*' is for every class. A switch
-- is on only if neither the class's row nor the '*' row turns it off; a class is closed to newcomers
-- if either row says so.
create table if not exists public.admin_keys (
  hash text primary key,
  note text,
  created_at timestamptz default now()
);
create table if not exists public.admin_log (
  id bigserial primary key,
  at timestamptz default now(),
  action text,
  args jsonb
);
-- The note of the key that made the change, and who or what it was about (a name, a title) as it was then.
alter table public.admin_log add column if not exists who text;
alter table public.admin_log add column if not exists about text;
create index if not exists admin_log_at on public.admin_log (at);
create table if not exists public.class_settings (
  class_code text primary key,
  chat boolean not null default true,
  drawings boolean not null default true,
  locked boolean not null default false,
  note text,
  updated_at timestamptz default now()
);
-- A name or class the admin page gave her. Her own saves keep it.
alter table public.players add column if not exists forced_name text;
alter table public.players add column if not exists forced_class text;

alter table public.admin_keys enable row level security;
alter table public.admin_log enable row level security;
alter table public.class_settings enable row level security;
revoke all on public.admin_keys, public.admin_log, public.class_settings from public, anon, authenticated;
revoke all on sequence public.admin_log_id_seq from public, anon, authenticated;

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

-- The switches of a class (see class_settings): chat and drawings on, and closed to newcomers.
create or replace function public.klyaksa_switches(p_class text, out chat boolean, out drawings boolean, out locked boolean)
language sql stable set search_path = public as $$
  select coalesce(bool_and(s.chat), true), coalesce(bool_and(s.drawings), true), coalesce(bool_or(s.locked), false)
  from public.class_settings s where s.class_code in (p_class, '*');
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
-- answer is the class actually stored, for the app to adopt. A name or class the
-- admin page gave her (forced_name, forced_class) wins over what the app sends.
-- A class closed to newcomers (class_settings) takes no new player and nobody
-- moving in (55000); a class given by the admin page goes through. A player who
-- left (klyaksa_forget) while the admin page had blocked, renamed or moved her
-- kept only that row, in no class: she comes back like a newcomer, but with it.
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
  h := encode(digest(p_secret, 'sha256'), 'hex');
  select * into cur from public.players where id = p_id for update;
  known := found;
  if known and cur.secret_hash <> h then
    raise exception 'not your player' using errcode = '42501';
  end if;
  if known then
    clean := coalesce(cur.forced_name, clean);
    if coalesce(cur.forced_class, '') <> '' then
      klass := cur.forced_class;
    elsif cur.class_code <> klass and (klyaksa_switches(klass)).locked then
      raise exception 'class is locked' using errcode = '55000';
    end if;
  elsif (klyaksa_switches(klass)).locked then
    raise exception 'class is locked' using errcode = '55000';
  end if;
  -- After the name the admin page gave her: a bad word added later must not stop her saves.
  if clean !~ '[[:alpha:]]' then
    raise exception 'empty name' using errcode = '22023';
  end if;
  if not known or cur.class_code <> klass then
    select count(*) into fresh from public.players
      where class_code = klass and coalesce(joined_at, created_at) > now() - interval '1 day';
    if fresh >= 60 then
      raise exception 'class is full for today' using errcode = '54000';
    end if;
  end if;
  if known and cur.class_code <> '' then
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
  elsif known then
    -- She left and comes back: her stars count as a newcomer's, the block and forced_* stay.
    total := least(total, 3000);
    update public.players
      set name = clean, avatar = face, lang = tongue, stars = total, updated_at = now(), created_at = now(),
          joined_at = now(), class_code = klass
      where id = p_id;
    insert into public.player_days (player_id, day, stars) values (p_id, klyaksa_week_start() - 1, total)
      on conflict (player_id, day) do nothing;
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
-- What the admin page set (a block, a name, a class) must outlive that, or leaving
-- and joining again from her own app would undo it: then everything of hers goes,
-- but her row stays with only that, in no class, so a later save finds it.
create or replace function public.klyaksa_forget(p_id uuid, p_secret text)
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  cur public.players;
begin
  select * into cur from public.players
    where id = p_id and secret_hash = encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex') for update;
  if not found then
    return json_build_object('ok', false);
  end if;
  if cur.visible and cur.forced_name is null and cur.forced_class is null then
    delete from public.players where id = p_id;
  else
    delete from public.posts where player_id = p_id;
    delete from public.messages where player_id = p_id;
    delete from public.post_likes where player_id = p_id;
    delete from public.reports where reporter = p_id;
    delete from public.player_days where player_id = p_id;
    update public.players
      set name = coalesce(forced_name, '—'), avatar = '🐱', stars = 0, class_code = '', joined_at = null, updated_at = now()
      where id = p_id;
  end if;
  return json_build_object('ok', true);
end $$;

-- Is there anybody in this class? For the app to warn about a mistyped code.
-- The code goes through class_moves; a code without the 'class-' prefix that
-- nobody uses becomes 'class-' || code when that class has players.
-- "players" counts the visible players seen in the last 90 days; "class" is ''
-- for a code that is not a class code at all; "locked" says the class takes no newcomers.
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
  return json_build_object('class', c, 'players', n, 'locked', c <> '' and (klyaksa_switches(c)).locked);
end $$;

-- Shows one of her drawings to her class, and puts a notice of it in the class chat.
-- p_thumb and p_image are base64 JPEGs without a data: prefix. At most 10 drawings
-- per player and 60 per class in 24 hours, deleted ones included. The free database
-- holds 500 MB, so all classes together get at most 30 MB of drawings a day and
-- 300 MB in all. It first throws away what nobody is shown any more (see the header).
-- With the drawings of her class switched off (class_settings) it gives 55000; with
-- its chat switched off the drawing is shown without the notice.
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
  if not (klyaksa_switches(me.class_code)).drawings then
    raise exception 'drawings are off' using errcode = '55000';
  end if;
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
  -- With the chat of her class switched off its title does not go there either.
  if (klyaksa_switches(me.class_code)).chat then
    insert into public.messages (player_id, class_code, kind, body, name, avatar)
      values (me.id, me.class_code, 'post', json_build_object('post', new_id, 'what', clean)::text, me.name, me.avatar);
  end if;
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
-- With the chat of her class switched off (class_settings) it gives 55000; reading goes on.
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
  if not (klyaksa_switches(me.class_code)).chat then
    raise exception 'chat is off' using errcode = '55000';
  end if;
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
-- "chat" and "drawings" say whether she may write and show drawings now (class_settings).
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
        and not exists (select 1 from public.reports r where r.reporter = me.id and r.kind = 'post' and r.target = d.id)), 0),
    'chat', (klyaksa_switches(me.class_code)).chat,
    'drawings', (klyaksa_switches(me.class_code)).drawings);
end $$;

-- ---------- The parents' admin page ----------
-- Arguments of klyaksa_admin, checked: anything else is 22023.
create or replace function public.klyaksa_admin_id(a jsonb, k text) returns bigint
language plpgsql immutable as $$
begin
  if jsonb_typeof(a -> k) in ('number', 'string') and (a ->> k) ~ '^[0-9]{1,18}$' then
    return (a ->> k)::bigint;
  end if;
  raise exception 'bad %', k using errcode = '22023';
end $$;

create or replace function public.klyaksa_admin_uuid(a jsonb, k text) returns uuid
language plpgsql immutable as $$
begin
  if jsonb_typeof(a -> k) = 'string' and (a ->> k) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return (a ->> k)::uuid;
  end if;
  raise exception 'bad %', k using errcode = '22023';
end $$;

-- null when the argument is not given and not needed.
create or replace function public.klyaksa_admin_bool(a jsonb, k text, need boolean) returns boolean
language plpgsql immutable as $$
begin
  if not (a ? k) and not need then
    return null;
  end if;
  if jsonb_typeof(a -> k) = 'boolean' then
    return (a -> k)::boolean;
  end if;
  raise exception 'bad %', k using errcode = '22023';
end $$;

-- A class code (or '*' when p_star), as klyaksa_class takes it.
create or replace function public.klyaksa_admin_class(a jsonb, k text, p_star boolean) returns text
language plpgsql immutable set search_path = public as $$
declare
  c text;
begin
  if jsonb_typeof(a -> k) = 'string' and char_length(a ->> k) <= 100 then
    if p_star and btrim(a ->> k) = '*' then
      return '*';
    end if;
    c := klyaksa_class(a ->> k);
    if c <> '' then
      return c;
    end if;
  end if;
  raise exception 'bad %', k using errcode = '22023';
end $$;

-- A count: p_def when not given, else between 1 and p_max.
create or replace function public.klyaksa_admin_limit(a jsonb, k text, p_def integer, p_max integer) returns integer
language plpgsql immutable as $$
begin
  if not (a ? k) or jsonb_typeof(a -> k) = 'null' then
    return p_def;
  end if;
  if jsonb_typeof(a -> k) = 'number' and (a ->> k) ~ '^[0-9]{1,9}$' then
    return least(greatest((a ->> k)::integer, 1), p_max);
  end if;
  raise exception 'bad %', k using errcode = '22023';
end $$;

-- A bad word as stored: lower case, tidied, 2 to 40 characters with a letter or digit, maybe with '=' first.
create or replace function public.klyaksa_admin_word(a jsonb) returns text
language plpgsql immutable set search_path = public as $$
declare
  w text;
  core text;
begin
  if jsonb_typeof(a -> 'word') <> 'string' or char_length(a ->> 'word') > 100 then
    raise exception 'bad word' using errcode = '22023';
  end if;
  w := lower(klyaksa_clean(a ->> 'word', 100));
  core := case when left(w, 1) = '=' then btrim(substr(w, 2)) else w end;
  if char_length(core) not between 2 and 40 or left(core, 1) = '=' or core !~ '[[:alnum:]]' then
    raise exception 'bad word' using errcode = '22023';
  end if;
  return case when left(w, 1) = '=' then '=' || core else core end;
end $$;

-- Reports whose message or drawing is gone.
create or replace function public.klyaksa_admin_tidy() returns void
language sql set search_path = public as $$
  delete from public.reports r
    where (r.kind = 'msg' and not exists (select 1 from public.messages m where m.id = r.target))
       or (r.kind = 'post' and not exists (select 1 from public.posts d where d.id = r.target));
$$;

-- What a message or drawing was, for the log: its author's name and the start of the text or the title.
create or replace function public.klyaksa_admin_about(p_kind text, p_id bigint) returns text
language sql stable set search_path = public as $$
  select case p_kind
    when 'msg' then (select coalesce(m.name, p.name) || case when m.kind = 'text' and m.body <> '' then ': ' || left(m.body, 60) else '' end
                     from public.messages m join public.players p on p.id = m.player_id where m.id = p_id)
    when 'post' then (select coalesce(d.name, p.name) || ': «' || left(d.title, 60) || '»'
                      from public.posts d join public.players p on p.id = d.player_id where d.id = p_id)
  end;
$$;

-- Everything the admin page does, for the holder of an admin key (see the header).
-- A wrong or missing key waits 0.3 s and gets 42501; an unknown action or a bad
-- argument gets 22023. Every action that changes something writes a row to admin_log.
-- Players, messages and drawings deleted by the author are marked "deleted": the
-- author emptied them (see klyaksa_chat_delete and klyaksa_post_delete).
create or replace function public.klyaksa_admin(p_key text, p_action text, p_args jsonb default '{}'::jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  a jsonb := coalesce(p_args, '{}'::jsonb);
  who text;
  today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_id uuid;
  v_n bigint;
  v_c text;
  v_c2 text;
  v_s text;
  v_b boolean;
  v_chat boolean;
  v_draw boolean;
  v_lock boolean;
  v_lim integer;
  v_before bigint;
  v_cur public.players;
  v_author uuid;
  v_log bigint;
  n integer;
  res json;
begin
  select k.note into who from public.admin_keys k
    where p_key is not null and char_length(p_key) between 20 and 200
      and k.hash = encode(digest(p_key, 'sha256'), 'hex');
  if not found then
    perform pg_sleep(0.3);
    raise exception 'not an admin' using errcode = '42501';
  end if;
  if jsonb_typeof(a) <> 'object' or octet_length(a::text) > 4000 then
    raise exception 'bad args' using errcode = '22023';
  end if;

  if p_action in ('player_set', 'player_delete', 'msg_set', 'msg_delete', 'post_set', 'post_delete', 'reports_clear',
                  'class_set', 'class_delete', 'word_add', 'word_delete', 'move_add', 'move_delete') then
    -- Written first: an action that fails takes its row back with it.
    delete from public.admin_log where at < now() - interval '365 days';
    insert into public.admin_log (action, args, who) values (p_action, a, coalesce(who, '')) returning id into v_log;
  end if;

  -- ---------- Looking ----------
  if p_action = 'stats' then
    return json_build_object(
      'players', (select count(*) from public.players),
      'visible', (select count(*) from public.players where visible),
      'new_7d', (select count(*) from public.players where created_at > now() - interval '7 days'),
      -- A day she opened the app; the row for the stars she brought with her (before she came) is no visit.
      'active_7d', (select count(distinct pd.player_id) from public.player_days pd join public.players p on p.id = pd.player_id
                    where pd.day > today - 7 and pd.day >= (p.created_at at time zone 'Asia/Jerusalem')::date),
      'classes', (select count(distinct class_code) from public.players where class_code <> ''),
      -- What the girls wrote (results too); the notice of a drawing is counted under the drawings.
      'messages_7d', (select count(*) from public.messages where created_at > now() - interval '7 days' and kind <> 'post'),
      'posts_7d', (select count(*) from public.posts where created_at > now() - interval '7 days'),
      'reports_open', (select count(*) from (select distinct r.kind, r.target from public.reports r
        where (r.kind = 'msg' and exists (select 1 from public.messages m where m.id = r.target))
           or (r.kind = 'post' and exists (select 1 from public.posts d where d.id = r.target))) q),
      'db_bytes', pg_database_size(current_database()),
      'posts_bytes', (select coalesce(sum(octet_length(thumb) + octet_length(image)), 0) from public.posts),
      'days', (select json_agg(json_build_object(
          'day', d.day,
          'active', (select count(*) from public.player_days pd join public.players p on p.id = pd.player_id
                     where pd.day = d.day and pd.day >= (p.created_at at time zone 'Asia/Jerusalem')::date),
          'new_players', (select count(*) from public.players p where p.created_at >= d.t0 and p.created_at < d.t1),
          'messages', (select count(*) from public.messages m where m.created_at >= d.t0 and m.created_at < d.t1 and m.kind <> 'post'),
          'posts', (select count(*) from public.posts x where x.created_at >= d.t0 and x.created_at < d.t1))
          order by d.day)
        from (select g.day, g.day::timestamp at time zone 'Asia/Jerusalem' as t0,
                (g.day + 1)::timestamp at time zone 'Asia/Jerusalem' as t1
              from (select today - i as day from generate_series(0, 13) i) g) d));

  elsif p_action = 'classes' then
    select json_agg(q.o order by q.ord, (q.o ->> 'players')::integer desc nulls last, q.o ->> 'code') into res from (
      select 0 as ord, jsonb_build_object('code', '*', 'chat', coalesce(s.chat, true), 'drawings', coalesce(s.drawings, true),
               'locked', coalesce(s.locked, false), 'note', s.note, 'updated_at', s.updated_at) as o
        from (select 1) one left join public.class_settings s on s.class_code = '*'
      union all
      select 1, jsonb_build_object(
          'code', c.code,
          'players', (select count(*) from public.players p where p.class_code = c.code),
          'blocked', (select count(*) from public.players p where p.class_code = c.code and not p.visible),
          'active_7d', (select count(distinct pd.player_id) from public.player_days pd join public.players p on p.id = pd.player_id
                        where p.class_code = c.code and pd.day > today - 7 and pd.day >= (p.created_at at time zone 'Asia/Jerusalem')::date),
          'last_at', (select max(p.updated_at) from public.players p where p.class_code = c.code),
          'messages_7d', (select count(*) from public.messages m where m.class_code = c.code and m.created_at > now() - interval '7 days' and m.kind <> 'post'),
          'posts_7d', (select count(*) from public.posts d where d.class_code = c.code and d.created_at > now() - interval '7 days'),
          'reports_open', (select count(*) from (select distinct r.kind, r.target from public.reports r
            where (r.kind = 'msg' and exists (select 1 from public.messages m where m.id = r.target and m.class_code = c.code))
               or (r.kind = 'post' and exists (select 1 from public.posts d where d.id = r.target and d.class_code = c.code))) q),
          'chat', coalesce(s.chat, true), 'drawings', coalesce(s.drawings, true), 'locked', coalesce(s.locked, false),
          'note', s.note,
          -- What the class gets with the '*' row too.
          'effective', jsonb_build_object('chat', sw.chat, 'drawings', sw.drawings, 'locked', sw.locked),
          'moved_from', coalesce((select jsonb_agg(m.from_code order by m.from_code) from public.class_moves m where m.to_code = c.code), '[]'::jsonb))
        from (select class_code as code from public.players where class_code <> ''
              union select class_code from public.class_settings where class_code <> '*') c
        left join public.class_settings s on s.class_code = c.code
        cross join lateral klyaksa_switches(c.code) sw
    ) q;
    return res;

  elsif p_action = 'players' then
    v_c := case when jsonb_typeof(a -> 'class') is null or jsonb_typeof(a -> 'class') = 'null' then null
                else klyaksa_admin_class(a, 'class', false) end;
    if jsonb_typeof(a -> 'q') = 'string' and char_length(a ->> 'q') <= 50 then
      v_s := nullif(lower(btrim(a ->> 'q')), '');
    elsif jsonb_typeof(a -> 'q') is not null and jsonb_typeof(a -> 'q') <> 'null' then
      raise exception 'bad q' using errcode = '22023';
    end if;
    select coalesce(json_agg(x order by x.updated_at desc, x.id), '[]'::json) into res from (
      select p.id, p.name, p.forced_name, p.avatar, p.lang, p.class_code as class, p.forced_class, p.stars,
        greatest(0, p.stars - coalesce((
          select pd.stars from public.player_days pd
          where pd.player_id = p.id and pd.day < klyaksa_week_start()
          order by pd.day desc limit 1), 0))::integer as week,
        p.visible, p.created_at, p.updated_at, p.joined_at,
        (select count(*) from public.posts d where d.player_id = p.id)::integer as posts,
        (select count(*) from public.messages m where m.player_id = p.id and m.kind <> 'post')::integer as messages,
        ((select count(*) from public.reports r join public.messages m on r.kind = 'msg' and m.id = r.target where m.player_id = p.id)
         + (select count(*) from public.reports r join public.posts d on r.kind = 'post' and d.id = r.target where d.player_id = p.id))::integer
          as reports_against
      from public.players p
      where (v_c is null or p.class_code = v_c)
        and (v_s is null or strpos(lower(p.name), v_s) > 0 or strpos(lower(coalesce(p.forced_name, '')), v_s) > 0)
      order by p.updated_at desc, p.id
      limit 500) x;
    return res;

  elsif p_action = 'chat' then
    v_c := klyaksa_admin_class(a, 'class', false);
    v_before := case when jsonb_typeof(a -> 'before') is null or jsonb_typeof(a -> 'before') = 'null' then null
                     else klyaksa_admin_id(a, 'before') end;
    v_lim := klyaksa_admin_limit(a, 'limit', 150, 300);
    select coalesce(json_agg(x order by x.id desc), '[]'::json) into res from (
      select m.id, m.player_id, coalesce(m.name, p.name) as name, coalesce(m.avatar, p.avatar) as avatar, m.kind, m.body, m.hidden,
        case when m.kind = 'post'
          then not exists (select 1 from public.posts d
                           where d.id = (case when m.kind = 'post' then (m.body::json ->> 'post')::bigint end) and octet_length(d.image) > 3)
          else m.hidden and m.body = '' end as deleted,
        (select count(*) from public.reports r where r.kind = 'msg' and r.target = m.id)::integer as reports,
        m.created_at as at, p.visible as author_visible
      from public.messages m join public.players p on p.id = m.player_id
      where m.class_code = v_c and (v_before is null or m.id < v_before)
      order by m.id desc
      limit v_lim) x;
    return res;

  elsif p_action = 'posts' then
    v_c := klyaksa_admin_class(a, 'class', false);
    v_lim := klyaksa_admin_limit(a, 'limit', 100, 200);
    -- The drawings are chosen first and only those thumbnails are encoded.
    select coalesce(json_agg(json_build_object('id', q.id, 'player_id', q.player_id, 'name', q.name, 'avatar', q.avatar,
        'title', q.title, 'thumb', case when q.deleted then null else translate(encode(t.thumb, 'base64'), E'\n', '') end,
        'w', q.w, 'h', q.h, 'hearts', q.hearts, 'hidden', q.hidden, 'deleted', q.deleted, 'reports', q.reports,
        'bytes', q.bytes, 'at', q.at, 'author_visible', q.author_visible) order by q.id desc), '[]'::json) into res
    from (
      select d.id, d.player_id, coalesce(d.name, p.name) as name, coalesce(d.avatar, p.avatar) as avatar, d.title, d.w, d.h,
        (select count(*) from public.post_likes l where l.post_id = d.id)::integer as hearts,
        d.hidden, octet_length(d.image) <= 3 as deleted,
        (select count(*) from public.reports r where r.kind = 'post' and r.target = d.id)::integer as reports,
        d.bytes, d.created_at as at, p.visible as author_visible
      from public.posts d join public.players p on p.id = d.player_id
      where d.class_code = v_c
      order by d.id desc
      limit v_lim) q join public.posts t on t.id = q.id;
    return res;

  elsif p_action = 'post_image' then
    v_n := klyaksa_admin_id(a, 'id');
    select json_build_object('image', case when octet_length(d.image) > 3 then translate(encode(d.image, 'base64'), E'\n', '') end,
                             'w', d.w, 'h', d.h, 'deleted', octet_length(d.image) <= 3)
      into res from public.posts d where d.id = v_n;
    if not found then
      raise exception 'no such drawing' using errcode = '22023';
    end if;
    return res;

  elsif p_action = 'reports' then
    with g as (
      select r.kind, r.target, count(*)::integer as count, max(r.created_at) as last_at,
        json_agg(rp.name order by r.created_at) as reporters
      from public.reports r join public.players rp on rp.id = r.reporter
      group by r.kind, r.target)
    select coalesce(json_agg(x order by x.last_at desc, x.target desc), '[]'::json) into res from (
      select * from (
        select g.kind, g.target, m.class_code as class, m.player_id as author_id, coalesce(m.name, ap.name) as author_name,
          m.body as preview, m.kind as msg_kind, null::text as thumb, g.count, g.reporters, m.hidden,
          (m.kind <> 'post' and m.hidden and m.body = '') as deleted, g.last_at, ap.visible as author_visible
        from g join public.messages m on g.kind = 'msg' and m.id = g.target join public.players ap on ap.id = m.player_id
        union all
        select g.kind, g.target, d.class_code, d.player_id, coalesce(d.name, ap.name),
          d.title, null, case when octet_length(d.thumb) > 3 then translate(encode(d.thumb, 'base64'), E'\n', '') end,
          g.count, g.reporters, d.hidden, octet_length(d.image) <= 3, g.last_at, ap.visible
        from g join public.posts d on g.kind = 'post' and d.id = g.target join public.players ap on ap.id = d.player_id
      ) u
      order by u.last_at desc
      limit 300) x;
    return res;

  elsif p_action = 'words' then
    return (select coalesce(json_agg(word order by word), '[]'::json) from public.bad_words);

  elsif p_action = 'moves' then
    return (select coalesce(json_agg(json_build_object('from', m.from_code, 'to', m.to_code,
        'players_now', (select count(*) from public.players p where p.class_code = m.to_code),
        'players_from', (select count(*) from public.players p where p.class_code = m.from_code))
      order by m.from_code), '[]'::json) from public.class_moves m);

  elsif p_action = 'log' then
    v_lim := klyaksa_admin_limit(a, 'limit', 200, 500);
    return (select coalesce(json_agg(x order by x.id desc), '[]'::json) from (
      select l.id, l.at, l.action, l.args, l.who, l.about from public.admin_log l order by l.id desc limit v_lim) x);

  -- ---------- Changing (each one is in admin_log) ----------
  elsif p_action = 'player_set' then
    v_id := klyaksa_admin_uuid(a, 'id');
    if not (a ? 'visible' or a ? 'name' or a ? 'class') then
      raise exception 'nothing to change' using errcode = '22023';
    end if;
    select * into v_cur from public.players where id = v_id for update;
    if not found then
      raise exception 'no such player' using errcode = '22023';
    end if;
    update public.admin_log set about = v_cur.name || ' (' || v_cur.class_code || ')' where id = v_log;
    if a ? 'visible' then
      update public.players set visible = klyaksa_admin_bool(a, 'visible', true) where id = v_id;
    end if;
    if a ? 'name' then
      if jsonb_typeof(a -> 'name') = 'null' or (jsonb_typeof(a -> 'name') = 'string' and btrim(a ->> 'name') = '') then
        update public.players set forced_name = null where id = v_id;
      elsif jsonb_typeof(a -> 'name') = 'string' and char_length(a ->> 'name') <= 200 then
        -- Tidied and masked like klyaksa_save: every classmate sees it.
        v_s := klyaksa_mask(klyaksa_clean(a ->> 'name', 24));
        if v_s !~ '[[:alpha:]]' then
          raise exception 'empty name' using errcode = '22023';
        end if;
        update public.players set forced_name = v_s, name = v_s where id = v_id;
      else
        raise exception 'bad name' using errcode = '22023';
      end if;
    end if;
    if a ? 'class' then
      if jsonb_typeof(a -> 'class') = 'null' or (jsonb_typeof(a -> 'class') = 'string' and btrim(a ->> 'class') = '') then
        update public.players set forced_class = null where id = v_id;
      else
        v_c := klyaksa_admin_class(a, 'class', false);
        if v_cur.class_code <> v_c then
          -- Her drawings and messages go with her, so a class code fixed by hand loses nothing.
          update public.posts set class_code = v_c where player_id = v_id;
          update public.messages set class_code = v_c where player_id = v_id;
        end if;
        update public.players
          set forced_class = v_c, class_code = v_c, joined_at = case when class_code <> v_c then now() else joined_at end
          where id = v_id;
      end if;
    end if;
    return (select json_build_object('ok', true, 'id', p.id, 'name', p.name, 'forced_name', p.forced_name,
      'class', p.class_code, 'forced_class', p.forced_class, 'visible', p.visible) from public.players p where p.id = v_id);

  elsif p_action = 'player_delete' then
    v_id := klyaksa_admin_uuid(a, 'id');
    delete from public.players where id = v_id returning name || ' (' || class_code || ')' into v_s;
    v_b := found;
    update public.admin_log set about = v_s where id = v_log;
    perform klyaksa_admin_tidy();
    return json_build_object('ok', v_b);

  elsif p_action = 'msg_set' then
    v_n := klyaksa_admin_id(a, 'id');
    v_b := klyaksa_admin_bool(a, 'hidden', true);
    update public.admin_log set about = klyaksa_admin_about('msg', v_n) where id = v_log;
    -- A message its author deleted stays hidden: it is empty.
    update public.messages set hidden = v_b or (kind <> 'post' and hidden and body = '')
      where id = v_n returning hidden into v_b;
    if not found then
      raise exception 'no such message' using errcode = '22023';
    end if;
    return json_build_object('ok', true, 'hidden', v_b);

  elsif p_action = 'msg_delete' then
    v_n := klyaksa_admin_id(a, 'id');
    update public.admin_log set about = klyaksa_admin_about('msg', v_n) where id = v_log;
    delete from public.messages where id = v_n;
    v_b := found;
    delete from public.reports where kind = 'msg' and target = v_n;
    return json_build_object('ok', v_b);

  elsif p_action = 'post_set' then
    v_n := klyaksa_admin_id(a, 'id');
    v_b := klyaksa_admin_bool(a, 'hidden', true);
    update public.admin_log set about = klyaksa_admin_about('post', v_n) where id = v_log;
    -- A drawing its author deleted stays hidden: it is empty.
    update public.posts set hidden = v_b or octet_length(image) <= 3
      where id = v_n returning hidden, player_id into v_b, v_author;
    if not found then
      raise exception 'no such drawing' using errcode = '22023';
    end if;
    update public.messages m set hidden = v_b
      where m.player_id = v_author and m.kind = 'post'
        and (case when m.kind = 'post' then (m.body::json ->> 'post')::bigint end) = v_n;
    return json_build_object('ok', true, 'hidden', v_b);

  elsif p_action = 'post_delete' then
    v_n := klyaksa_admin_id(a, 'id');
    update public.admin_log set about = klyaksa_admin_about('post', v_n) where id = v_log;
    delete from public.posts where id = v_n returning player_id into v_author;
    v_b := found;
    if v_b then
      delete from public.messages m
        where m.player_id = v_author and m.kind = 'post'
          and (case when m.kind = 'post' then (m.body::json ->> 'post')::bigint end) = v_n;
    end if;
    delete from public.reports where kind = 'post' and target = v_n;
    perform klyaksa_admin_tidy();
    return json_build_object('ok', v_b);

  elsif p_action = 'reports_clear' then
    v_s := a ->> 'kind';
    if jsonb_typeof(a -> 'kind') <> 'string' or v_s not in ('msg', 'post') then
      raise exception 'bad kind' using errcode = '22023';
    end if;
    v_n := klyaksa_admin_id(a, 'target');
    -- hidden: true closes the reports and keeps it hidden (or hides it), in one step.
    v_lock := coalesce(klyaksa_admin_bool(a, 'hidden', false), false);
    update public.admin_log set about = klyaksa_admin_about(v_s, v_n) where id = v_log;
    delete from public.reports where kind = v_s and target = v_n;
    get diagnostics n = row_count;
    -- Otherwise the reports were wrong: it is shown again, unless its author deleted it.
    if v_s = 'msg' then
      update public.messages set hidden = v_lock or (kind <> 'post' and hidden and body = '') where id = v_n returning hidden into v_b;
    else
      update public.posts set hidden = v_lock or octet_length(image) <= 3 where id = v_n returning hidden, player_id into v_b, v_author;
      if found then
        update public.messages m set hidden = v_b
          where m.player_id = v_author and m.kind = 'post'
            and (case when m.kind = 'post' then (m.body::json ->> 'post')::bigint end) = v_n;
      end if;
    end if;
    return json_build_object('ok', true, 'cleared', n, 'hidden', v_b);

  elsif p_action = 'class_set' then
    v_c := klyaksa_admin_class(a, 'class', true);
    v_chat := klyaksa_admin_bool(a, 'chat', false);
    v_draw := klyaksa_admin_bool(a, 'drawings', false);
    v_lock := klyaksa_admin_bool(a, 'locked', false);
    if jsonb_typeof(a -> 'note') = 'string' and char_length(a ->> 'note') <= 1000 then
      v_s := nullif(klyaksa_clean(a ->> 'note', 200), '');
    elsif jsonb_typeof(a -> 'note') is not null and jsonb_typeof(a -> 'note') <> 'null' then
      raise exception 'bad note' using errcode = '22023';
    end if;
    insert into public.class_settings (class_code) values (v_c) on conflict (class_code) do nothing;
    update public.class_settings
      set chat = coalesce(v_chat, chat), drawings = coalesce(v_draw, drawings), locked = coalesce(v_lock, locked),
          note = case when a ? 'note' then v_s else note end, updated_at = now()
      where class_code = v_c;
    return (select json_build_object('ok', true, 'code', s.class_code, 'chat', s.chat, 'drawings', s.drawings,
      'locked', s.locked, 'note', s.note) from public.class_settings s where s.class_code = v_c);

  elsif p_action = 'class_delete' then
    v_c := klyaksa_admin_class(a, 'class', false);
    delete from public.players where class_code = v_c;
    get diagnostics n = row_count;
    -- And what players who moved away left there.
    delete from public.messages where class_code = v_c;
    delete from public.posts where class_code = v_c;
    -- Closed to newcomers, not forgotten: the girls' devices still have the code and would make it again.
    insert into public.class_settings (class_code, locked) values (v_c, true)
      on conflict (class_code) do update set locked = true, updated_at = now();
    perform klyaksa_admin_tidy();
    return json_build_object('ok', true, 'players', n);

  elsif p_action = 'word_add' then
    v_s := klyaksa_admin_word(a);
    insert into public.bad_words (word) values (v_s) on conflict do nothing;
    return json_build_object('ok', true, 'word', v_s, 'added', found);

  elsif p_action = 'word_delete' then
    if jsonb_typeof(a -> 'word') <> 'string' or char_length(a ->> 'word') > 100 then
      raise exception 'bad word' using errcode = '22023';
    end if;
    delete from public.bad_words where word = lower(klyaksa_clean(a ->> 'word', 100));
    return json_build_object('ok', found);

  elsif p_action = 'move_add' then
    v_c := klyaksa_admin_class(a, 'from', false);
    v_c2 := klyaksa_admin_class(a, 'to', false);
    if v_c = v_c2 or exists (select 1 from public.class_moves m where m.from_code = v_c2) then
      raise exception 'bad move' using errcode = '22023';
    end if;
    insert into public.class_moves (from_code, to_code) values (v_c, v_c2)
      on conflict (from_code) do update set to_code = excluded.to_code;
    -- Those already there move now, with their drawings and messages.
    update public.players set class_code = v_c2, joined_at = now() where class_code = v_c;
    get diagnostics n = row_count;
    update public.players set forced_class = v_c2 where forced_class = v_c;
    update public.posts set class_code = v_c2 where class_code = v_c;
    update public.messages set class_code = v_c2 where class_code = v_c;
    return json_build_object('ok', true, 'from', v_c, 'to', v_c2, 'moved', n);

  elsif p_action = 'move_delete' then
    v_c := klyaksa_admin_class(a, 'from', false);
    delete from public.class_moves where from_code = v_c;
    return json_build_object('ok', found);
  end if;

  raise exception 'unknown action' using errcode = '22023';
end $$;

-- Supabase grants new functions to anon by default, so the helpers are closed explicitly.
revoke all on function public.klyaksa_week_start() from public, anon, authenticated;
revoke all on function public.klyaksa_class(text) from public, anon, authenticated;
revoke all on function public.klyaksa_moved(text) from public, anon, authenticated;
revoke all on function public.klyaksa_me(uuid, text) from public, anon, authenticated;
revoke all on function public.klyaksa_clean(text, integer) from public, anon, authenticated;
revoke all on function public.klyaksa_mask_words(text) from public, anon, authenticated;
revoke all on function public.klyaksa_mask(text) from public, anon, authenticated;
revoke all on function public.klyaksa_switches(text) from public, anon, authenticated;
revoke all on function public.klyaksa_admin_id(jsonb, text) from public, anon, authenticated;
revoke all on function public.klyaksa_admin_uuid(jsonb, text) from public, anon, authenticated;
revoke all on function public.klyaksa_admin_bool(jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.klyaksa_admin_class(jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.klyaksa_admin_limit(jsonb, text, integer, integer) from public, anon, authenticated;
revoke all on function public.klyaksa_admin_word(jsonb) from public, anon, authenticated;
revoke all on function public.klyaksa_admin_tidy() from public, anon, authenticated;
revoke all on function public.klyaksa_admin_about(text, bigint) from public, anon, authenticated;
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

-- The parents' admin page: only with an admin key (see the header).
revoke all on function public.klyaksa_admin(text, text, jsonb) from public;
grant execute on function public.klyaksa_admin(text, text, jsonb) to anon, authenticated;

-- Tell the API about new and changed functions.
notify pgrst, 'reload schema';
