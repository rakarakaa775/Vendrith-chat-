-- Keep GET DIAGNOSTICS ROW_COUNT in its native integer type.
create or replace function public.chat_confirm_attachment(p_attachment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row_count integer := 0;
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

  get diagnostics v_row_count = row_count;
  return v_row_count > 0;
end;
$$;

revoke all on function public.chat_confirm_attachment(uuid) from public, anon;
grant execute on function public.chat_confirm_attachment(uuid) to authenticated;
