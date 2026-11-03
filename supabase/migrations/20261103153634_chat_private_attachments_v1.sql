-- Private Chat attachments: metadata-led uploads, member-scoped reads, bounded quotas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendrith-chat-attachments',
  'vendrith-chat-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create table if not exists public.chat_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 255),
  mime_type text not null check (mime_type in (
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  created_at timestamptz not null default now(),
  uploaded_at timestamptz
);

create index if not exists chat_attachments_conversation_created_idx
  on public.chat_attachments (conversation_id, created_at desc);
create index if not exists chat_attachments_uploader_created_idx
  on public.chat_attachments (uploader_id, created_at desc);

alter table public.chat_attachments enable row level security;
revoke all on public.chat_attachments from anon, authenticated;
grant select on public.chat_attachments to authenticated;

drop policy if exists chat_attachments_member_read on public.chat_attachments;
create policy chat_attachments_member_read
on public.chat_attachments
for select
to authenticated
using (
  status = 'ready'
  and exists (
    select 1
    from public.chat_members cm
    where cm.conversation_id = chat_attachments.conversation_id
      and cm.user_id = (select auth.uid())
  )
);

create or replace function public.chat_prepare_attachment(
  p_conversation_id uuid,
  p_original_name text,
  p_mime_type text,
  p_byte_size bigint
)
returns table (attachment_id uuid, object_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_attachment_id uuid := gen_random_uuid();
  v_name text := btrim(p_original_name);
  v_mime text := lower(btrim(p_mime_type));
  v_total bigint;
  v_daily bigint;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 255
     or v_name ~ '[[:cntrl:]]' or v_name ~ '[/\\]' then
    raise exception 'Invalid file name' using errcode = '22023';
  end if;

  if v_mime not in (
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) then
    raise exception 'File type is not allowed' using errcode = '22023';
  end if;

  if p_byte_size is null or p_byte_size < 1 or p_byte_size > 10485760 then
    raise exception 'File must be between 1 byte and 10 MB' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text, 0));

  if not exists (
    select 1 from public.chat_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = v_actor
  ) then
    raise exception 'Conversation membership required' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.chat_conversations c
    where c.id = p_conversation_id and c.closed_at is not null
  ) then
    raise exception 'Attachments are disabled for closed conversations' using errcode = '55000';
  end if;

  select coalesce(sum(a.byte_size), 0) into v_total
  from public.chat_attachments a
  where a.uploader_id = v_actor
    and (a.status = 'ready' or a.created_at > now() - interval '15 minutes');

  if v_total + p_byte_size > 104857600 then
    raise exception 'Attachment storage quota reached (100 MB)' using errcode = '54000';
  end if;

  select coalesce(sum(a.byte_size), 0) into v_daily
  from public.chat_attachments a
  where a.uploader_id = v_actor
    and a.created_at >= date_trunc('day', now())
    and (a.status = 'ready' or a.created_at > now() - interval '15 minutes');

  if v_daily + p_byte_size > 26214400 then
    raise exception 'Daily attachment upload quota reached (25 MB)' using errcode = '54000';
  end if;

  object_path := p_conversation_id::text || '/' || v_actor::text || '/' || v_attachment_id::text;
  attachment_id := v_attachment_id;

  insert into public.chat_attachments (
    id, conversation_id, uploader_id, object_path, original_name, mime_type, byte_size
  ) values (
    v_attachment_id, p_conversation_id, v_actor, object_path, v_name, v_mime, p_byte_size
  );

  return next;
end;
$$;

create or replace function public.chat_confirm_attachment(p_attachment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_confirmed boolean := false;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.chat_attachments a
  set status = 'ready', uploaded_at = now()
  where a.id = p_attachment_id
    and a.uploader_id = v_actor
    and a.status = 'pending'
    and a.created_at > now() - interval '15 minutes'
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = 'vendrith-chat-attachments'
        and o.name = a.object_path
    );

  get diagnostics v_confirmed = row_count;
  return v_confirmed;
end;
$$;

revoke all on function public.chat_prepare_attachment(uuid, text, text, bigint) from public, anon;
revoke all on function public.chat_confirm_attachment(uuid) from public, anon;
grant execute on function public.chat_prepare_attachment(uuid, text, text, bigint) to authenticated;
grant execute on function public.chat_confirm_attachment(uuid) to authenticated;

drop policy if exists vendrith_chat_attachment_upload on storage.objects;
create policy vendrith_chat_attachment_upload
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vendrith-chat-attachments'
  and exists (
    select 1 from public.chat_attachments a
    where a.object_path = name
      and a.uploader_id = (select auth.uid())
      and a.status = 'pending'
      and a.created_at > now() - interval '15 minutes'
  )
);

drop policy if exists vendrith_chat_attachment_read on storage.objects;
create policy vendrith_chat_attachment_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'vendrith-chat-attachments'
  and exists (
    select 1
    from public.chat_attachments a
    join public.chat_members cm
      on cm.conversation_id = a.conversation_id
    where a.object_path = name
      and a.status = 'ready'
      and cm.user_id = (select auth.uid())
  )
);
