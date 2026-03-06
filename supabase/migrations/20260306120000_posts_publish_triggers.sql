create or replace function public._posts_set_publish_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If post is published, it must not keep scheduled_at
  if new.is_published = true then
    new.scheduled_at := null;

    -- Set published_at when publishing if missing
    if new.published_at is null then
      if tg_op = 'INSERT' then
        new.published_at := now();
      elsif tg_op = 'UPDATE' then
        -- only set if transitioning from not published -> published
        if (old.is_published is distinct from true) then
          new.published_at := now();
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_posts_set_publish_fields on public.posts;

create trigger trg_posts_set_publish_fields
before insert or update of is_published, scheduled_at, published_at
on public.posts
for each row
execute function public._posts_set_publish_fields();

-- allow function to exist safely
revoke all on function public._posts_set_publish_fields() from public;
grant execute on function public._posts_set_publish_fields() to postgres;
