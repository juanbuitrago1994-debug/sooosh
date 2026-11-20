import { sql } from "drizzle-orm"
import type { Db } from "@/lib/db"

/** Fuente (clave del catálogo) a la que pertenece una oferta según su `source_key`; las empresas con tablero se agrupan en «companies». */
export const GROUP_SQL = sql`case
  when source_key = 'getonboard' or source_key like 'portal:%' or source_key like 'remote:%' then source_key
  when source_key ~ '^(greenhouse|lever|ashby|workable|recruitee|smartrecruiters|personio):' then 'companies'
end`

/**
 * Foto de hoy (UTC) por fuente: ofertas activas y su composición (tecnología, salario, remotas, completas), edad media y las lecturas del día.
 * Es idempotente: cada corrida sobrescribe la fila del día, así que la última lectura del día queda como la foto. Devuelve cuántas fuentes guardó.
 */
export async function snapshotSourceStats(db: Db): Promise<number> {
  const res = await db.execute(sql`
    insert into public.source_daily_stats (day, source_key, active_offers, tech_offers, salary_offers, remote_offers, structured_offers, avg_age_days, runs, runs_ok, fetched, added, closed, updated_at)
    select (now() at time zone 'utc')::date, g.key, g.n, g.tech, g.salary, g.remote, g.structured, g.age,
           coalesce(r.runs, 0), coalesce(r.ok, 0), coalesce(r.fetched, 0), coalesce(r.added, 0), coalesce(r.closed, 0), now()
    from (
      select ${GROUP_SQL} as key,
             count(*)::int as n,
             (count(*) filter (where is_tech))::int as tech,
             (count(*) filter (where salary is not null))::int as salary,
             (count(*) filter (where work_mode = 'remoto'))::int as remote,
             (count(*) filter (where coalesce(jsonb_array_length(offer->'requirements'), 0) + coalesce(jsonb_array_length(offer->'responsibilities'), 0) + coalesce(jsonb_array_length(offer->'niceToHave'), 0) >= 2))::int as structured,
             round(avg(extract(epoch from now() - coalesce(posted_at, created_at)) / 86400)::numeric, 1) as age
      from public.jobs
      where status = 'activa' and source_key is not null
      group by 1
    ) g
    left join (
      select target, count(*)::int as runs, (count(*) filter (where ok))::int as ok, coalesce(sum(fetched), 0)::int as fetched, coalesce(sum(created), 0)::int as added, coalesce(sum(closed), 0)::int as closed
      from public.sync_runs
      where (finished_at at time zone 'utc')::date = (now() at time zone 'utc')::date
      group by target
    ) r on r.target = g.key
    where g.key is not null
    on conflict (day, source_key) do update set
      active_offers = excluded.active_offers, tech_offers = excluded.tech_offers, salary_offers = excluded.salary_offers, remote_offers = excluded.remote_offers,
      structured_offers = excluded.structured_offers, avg_age_days = excluded.avg_age_days, runs = excluded.runs, runs_ok = excluded.runs_ok,
      fetched = excluded.fetched, added = excluded.added, closed = excluded.closed, updated_at = now()
    returning source_key`)
  return Array.isArray(res) ? res.length : ((res as { rows?: unknown[] }).rows?.length ?? 0)
}

/** Tendencia de ofertas activas por fuente en los últimos `days` días (la más antigua primero). */
export async function activeTrend(db: Db, days = 30): Promise<Map<string, { day: string; n: number }[]>> {
  const res = await db.execute(sql`select source_key, day::text as day, active_offers as n from public.source_daily_stats where day > (now() at time zone 'utc')::date - ${days}::int order by day asc`)
  const rows = (Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])) as { source_key: string; day: string; n: number }[]
  const out = new Map<string, { day: string; n: number }[]>()
  for (const r of rows) out.set(r.source_key, [...(out.get(r.source_key) ?? []), { day: r.day, n: Number(r.n) }])
  return out
}
