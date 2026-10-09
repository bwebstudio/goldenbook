-- Undo the "digits-only search = QA session" flag.
--
-- 20260805120000_analytics_integrity_fixes and the flag-internal-traffic
-- script marked every session that ran a digits-only search ("111", "1111")
-- as is_internal, assuming staff tests. As of 9 Oct 2026 that is 1,232
-- sessions and 20,303 events, about 28% of all analytics: 1,200 distinct
-- users with the same retention, install hours and locale mix as everyone
-- else. They are real users. Staff are now excluded at read time by email
-- (admin_users, see internal-traffic.ts), so clearing the flag cannot let
-- staff traffic back into the metrics.
--
-- Only rows whose session ran a digits-only search are touched; sessions
-- flagged from the x-gb-internal header (dev / TestFlight builds) are not
-- among them and keep their flag. Reversible: re-running the old script with
-- its override flag sets them again.

with digit_sessions as (
  select distinct q.session_id
    from search_queries q
   where q.session_id is not null
     and q.query ~ '^[0-9[:space:]]+$'
)
update analytics_events e
   set is_internal = false
  from digit_sessions d
 where e.session_id = d.session_id
   and e.is_internal;

with digit_sessions as (
  select distinct q.session_id
    from search_queries q
   where q.session_id is not null
     and q.query ~ '^[0-9[:space:]]+$'
)
update user_sessions s
   set is_internal = false
  from digit_sessions d
 where s.session_id = d.session_id
   and s.is_internal;

with digit_sessions as (
  select distinct q.session_id
    from search_queries q
   where q.session_id is not null
     and q.query ~ '^[0-9[:space:]]+$'
)
update search_queries q
   set is_internal = false
  from digit_sessions d
 where q.session_id = d.session_id
   and q.is_internal;
