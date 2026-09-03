/**
 * Demo data. Builds the exact scenario the specification uses as its running
 * example, so every screen has something real in it:
 *
 *   Career → Build a company → $250K / launch → Get a design engineering role
 *     ├─ Portfolio (done)          ├─ Job search (40%)
 *   Sarah Chen (51 days, cadence 30) · Alex Kim (met today, OpenAI)
 *   Finance → $1M by 35 · Health → Marathon prep · Learning → The Mom Test
 *
 *   npm run db:seed
 */
import { createHash, randomUUID } from 'node:crypto';
import postgres from 'postgres';

const EMAIL = process.env.LOCKIN_DEV_USER ?? 'sam@example.com';

function devUserId(email: string): string {
  const h = createHash('sha256').update(`lockin-dev:${email}`).digest('hex');
  return [
    h.slice(0, 8), h.slice(8, 12), `4${h.slice(13, 16)}`,
    ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join('-');
}

const day = 86_400_000;
const at = (offsetDays: number, hour = 9) => {
  const d = new Date(Date.now() + offsetDays * day);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  const uid = devUserId(EMAIL);

  try {
    await sql`select provision_user(${uid}::uuid, ${EMAIL}, 'Sam')`;
    await sql`update app_user set identity_statement =
      'Build ambitious things, stay free, stay connected.', onboarded_at = now()
      where id = ${uid}::uuid`;

    // A clean re-seed every time, so the script is safe to re-run.
    await sql`delete from object where user_id = ${uid}::uuid`;
    await sql`delete from metric where user_id = ${uid}::uuid`;
    await sql`delete from activity where user_id = ${uid}::uuid`;
    await sql`delete from "transaction" where user_id = ${uid}::uuid`;
    await sql`delete from account where user_id = ${uid}::uuid`;
    await sql`delete from model_fact where user_id = ${uid}::uuid`;
    await sql`delete from calendar_event where user_id = ${uid}::uuid`;

    const ids: Record<string, string> = {};

    async function obj(key: string, v: Record<string, unknown>) {
      const id = randomUUID();
      ids[key] = id;
      await sql`insert into object ${sql({
        id, user_id: uid, position: Object.keys(ids).length,
        ...v,
      } as never)}`;
      return id;
    }

    async function edge(from: string, to: string, rel: string) {
      await sql`insert into edge (id, user_id, from_id, to_id, rel)
        values (${randomUUID()}::uuid, ${uid}::uuid, ${ids[from]!}::uuid, ${ids[to]!}::uuid, ${rel})
        on conflict do nothing`;
    }

    // ── Goals ────────────────────────────────────────────────────────────────
    await obj('g_company', {
      type: 'goal', title: 'Build a company', area: 'career', horizon: '5y',
      status: 'active', progress: 40, start_at: at(-400), due_at: at(1400),
      body: 'Something I own, that pays for itself, that I would work on anyway.',
    });
    await obj('g_income', {
      type: 'goal', title: '$250K income or a launched product', area: 'career',
      horizon: '1y', status: 'active', progress: 55, start_at: at(-120), due_at: at(240),
      target_value: 250000, current_value: 137500, unit: 'USD',
    });
    await obj('g_role', {
      type: 'goal', title: 'Get a design engineering role', area: 'career',
      horizon: '3m', status: 'active', progress: 72, start_at: at(-60), due_at: at(89),
      metric_name: 'offer accepted',
    });
    await obj('g_apply', {
      type: 'goal', title: 'Apply to 10 companies', area: 'career', horizon: '1m',
      status: 'active', progress: 40, start_at: at(-14), due_at: at(28),
      target_value: 10, current_value: 4, unit: 'applications',
    });
    await obj('g_mrr', {
      type: 'goal', title: 'Reach $10K MRR', area: 'career', horizon: '3m',
      status: 'active', progress: 30, start_at: at(-30), due_at: at(120),
      target_value: 10000, current_value: 3000, unit: 'USD',
    });
    await obj('g_million', {
      type: 'goal', title: '$1M invested by 35', area: 'finance', horizon: '5y',
      status: 'active', progress: 63, start_at: at(-900), due_at: at(1800),
      target_value: 1000000, current_value: 630000, unit: 'USD',
    });
    await obj('g_invest', {
      type: 'goal', title: 'Invest $75K this year', area: 'finance', horizon: '1y',
      status: 'active', progress: 41, start_at: at(-240), due_at: at(120),
      target_value: 75000, current_value: 30750, unit: 'USD',
    });
    await obj('g_marathon', {
      type: 'goal', title: 'Run a marathon', area: 'health', horizon: '1y',
      status: 'active', progress: 48, start_at: at(-90), due_at: at(190),
    });
    await obj('g_people', {
      type: 'goal', title: 'Stay close to the people who matter', area: 'relationships',
      horizon: '1y', status: 'active', progress: 55, start_at: at(-200), due_at: at(160),
    });
    await obj('g_learn', {
      type: 'goal', title: 'Read 24 books', area: 'learning', horizon: '1y',
      status: 'active', progress: 70, start_at: at(-240), due_at: at(120),
      target_value: 24, current_value: 17, unit: 'books',
    });

    await edge('g_income', 'g_company', 'supports');
    await edge('g_role', 'g_income', 'supports');
    await edge('g_apply', 'g_role', 'supports');
    await edge('g_mrr', 'g_company', 'supports');
    await edge('g_invest', 'g_million', 'supports');

    // ── Projects and milestones ──────────────────────────────────────────────
    await obj('p_portfolio', {
      type: 'project', title: 'Portfolio', area: 'career', status: 'done',
      progress: 100, start_at: at(-45), due_at: at(-1), completed_at: at(-1),
    });
    await obj('p_jobsearch', {
      type: 'project', title: 'Job search', area: 'career', status: 'active',
      progress: 40, start_at: at(-20), due_at: at(89),
      body: 'Ten applications, three interviews, one offer by 1 December.',
    });
    await obj('p_launch', {
      type: 'project', title: 'Product launch', area: 'career', status: 'active',
      progress: 80, start_at: at(-40), due_at: at(27),
    });
    await obj('p_marathon', {
      type: 'project', title: 'Marathon prep', area: 'health', status: 'active',
      progress: 22, start_at: at(-10), due_at: at(190),
    });
    await obj('p_interviews', {
      type: 'project', title: 'Customer interviews', area: 'career', status: 'active',
      progress: 60, start_at: at(-30), due_at: at(20),
    });
    await obj('p_nyc', {
      type: 'project', title: 'Move to NYC', area: 'home', status: 'idea',
      progress: 0, start_at: at(90), due_at: at(200),
    });

    await edge('p_portfolio', 'g_role', 'supports');
    await edge('p_jobsearch', 'g_role', 'supports');
    await edge('p_launch', 'g_mrr', 'supports');
    await edge('p_marathon', 'g_marathon', 'supports');
    await edge('p_interviews', 'g_mrr', 'supports');

    await obj('m_deployed', {
      type: 'milestone', title: 'Portfolio live', area: 'career', status: 'reached',
      progress: 100, due_at: at(-1), completed_at: at(-1),
    });
    await obj('m_ten', {
      type: 'milestone', title: '10 applications sent', area: 'career', status: 'open',
      progress: 40, due_at: at(28),
    });
    await obj('m_three', {
      type: 'milestone', title: '3 interviews', area: 'career', status: 'open',
      progress: 0, due_at: at(59),
    });
    await obj('m_offer', {
      type: 'milestone', title: 'Offer', area: 'career', status: 'open',
      progress: 0, due_at: at(89),
    });
    await obj('m_onboarding', {
      type: 'milestone', title: 'Onboarding flow', area: 'career', status: 'open',
      progress: 60, due_at: at(9),
    });
    await obj('m_tenmile', {
      type: 'milestone', title: '10-mile run', area: 'health', status: 'open',
      progress: 20, due_at: at(47),
    });

    await edge('m_deployed', 'p_portfolio', 'part_of');
    await edge('m_ten', 'p_jobsearch', 'part_of');
    await edge('m_three', 'p_jobsearch', 'part_of');
    await edge('m_offer', 'p_jobsearch', 'part_of');
    await edge('m_onboarding', 'p_launch', 'part_of');
    await edge('m_tenmile', 'p_marathon', 'part_of');

    // ── People ───────────────────────────────────────────────────────────────
    await obj('per_sarah', {
      type: 'person', title: 'Sarah Chen', area: 'relationships', status: 'active',
      props: sql.json({
        company: 'Anthropic', role: 'Design lead', cadence_days: 30,
        last_interaction: at(-51).toISOString(), birthday: at(1).toISOString(),
        how_we_met: 'AI meetup, March 2025',
      }) as never,
    });
    await obj('per_alex', {
      type: 'person', title: 'Alex Kim', area: 'career', status: 'active',
      props: sql.json({
        company: 'OpenAI', interests: ['robotics'], cadence_days: null,
        last_interaction: at(0).toISOString(), how_we_met: 'Lunch, today',
      }) as never,
    });
    await obj('per_ben', {
      type: 'person', title: 'Ben Ortiz', area: 'career', status: 'active',
      props: sql.json({ company: 'Figma', cadence_days: 45, last_interaction: at(-40).toISOString() }) as never,
    });
    await obj('per_jake', {
      type: 'person', title: 'Jake Liu', area: 'relationships', status: 'active',
      props: sql.json({ company: 'Anthropic', cadence_days: 21, last_interaction: at(-3).toISOString() }) as never,
    });

    await obj('int_lunch', {
      type: 'interaction', title: 'Lunch — robotics, intro to design lead',
      area: 'career', created_at: at(0, 12),
      props: sql.json({ channel: 'in person', at: at(0, 12).toISOString() }) as never,
    });
    await edge('int_lunch', 'per_alex', 'with');

    // ── Tasks ────────────────────────────────────────────────────────────────
    await obj('t_homepage', {
      type: 'task', title: 'Finish portfolio homepage', area: 'career', status: 'today',
      priority: 2, due_at: at(0, 13), estimate_minutes: 90, energy: 'focus',
      props: sql.json({ project_id: ids.p_launch }) as never,
    });
    await obj('t_proposal', {
      type: 'task', title: 'Send proposal to Alex', area: 'career', status: 'today',
      priority: 2, due_at: at(1), estimate_minutes: 30, energy: 'admin',
      body: 'Include the Q3 numbers and the two case studies.',
      inferred_fields: ['estimate_minutes', 'energy'] as never,
    });
    await obj('t_sarah', {
      type: 'task', title: 'Call Sarah', area: 'relationships', status: 'today',
      priority: 3, estimate_minutes: 20, energy: 'social',
    });
    await obj('t_workout', {
      type: 'habit', title: 'Workout', area: 'health', status: 'active',
      target_value: 3, current_value: 2, unit: 'sessions', rrule: 'FREQ=WEEKLY;COUNT=3',
    });
    await obj('t_resume', {
      type: 'task', title: 'Update resume', area: 'career', status: 'next',
      priority: 3, estimate_minutes: 45, energy: 'admin',
    });
    await obj('t_shortlist', {
      type: 'task', title: 'Shortlist 10 companies', area: 'career', status: 'next',
      priority: 3, estimate_minutes: 60, energy: 'focus',
    });
    await obj('t_cover', {
      type: 'task', title: 'Write cover letter template', area: 'career', status: 'next',
      estimate_minutes: 60, energy: 'creative',
    });
    await obj('t_apply', {
      type: 'task', title: 'Apply ×10', area: 'career', status: 'backlog',
      target_value: 10, current_value: 4, unit: 'applications',
    });
    await obj('t_nyc', { type: 'task', title: 'Research NYC neighbourhoods', area: 'home', status: 'backlog' });
    await obj('t_spanish', { type: 'task', title: 'Learn Spanish — pick a course', area: 'learning', status: 'backlog' });
    await obj('t_deploy', {
      type: 'task', title: 'Deploy the landing page', area: 'career', status: 'done',
      completed_at: at(-1, 16), estimate_minutes: 45,
    });
    await obj('t_run', {
      type: 'task', title: 'Long run — 8 miles', area: 'health', status: 'doing',
      estimate_minutes: 80, energy: 'physical', due_at: at(2),
    });

    await edge('t_homepage', 'm_onboarding', 'part_of');
    await edge('t_resume', 'm_ten', 'part_of');
    await edge('t_shortlist', 'm_ten', 'part_of');
    await edge('t_cover', 'm_ten', 'part_of');
    await edge('t_apply', 'm_ten', 'part_of');
    await edge('t_deploy', 'm_deployed', 'part_of');
    await edge('t_run', 'm_tenmile', 'part_of');
    await edge('t_proposal', 'per_alex', 'with');
    await edge('t_sarah', 'per_sarah', 'with');
    // The homepage blocks three things in the job search.
    await edge('t_homepage', 't_resume', 'blocks');
    await edge('t_homepage', 't_shortlist', 'blocks');
    await edge('t_homepage', 't_cover', 'blocks');

    await obj('w_sarah', {
      type: 'waiting_on', title: 'Feedback on the portfolio', area: 'career', status: 'waiting',
      created_at: at(-6), props: sql.json({ since: at(-6).toISOString() }) as never,
    });
    await obj('w_ben', {
      type: 'waiting_on', title: 'Intro to the Figma design lead', area: 'career', status: 'waiting',
      created_at: at(-12), props: sql.json({ since: at(-12).toISOString() }) as never,
    });
    await obj('w_alex', {
      type: 'waiting_on', title: 'Intro to the OpenAI design lead', area: 'career', status: 'waiting',
      created_at: at(0),
    });
    await edge('w_sarah', 'per_sarah', 'with');
    await edge('w_ben', 'per_ben', 'with');
    await edge('w_alex', 'per_alex', 'with');

    // ── Brain ────────────────────────────────────────────────────────────────
    for (const [i, entry] of [
      ['Good day overall. Finished the homepage and it feels good to have it shipped. Worried I am spreading myself thin between the startup and the job search — I keep saying I will focus and then do not.', 'good', ['startup', 'job search', 'spreading thin']],
      ['Slow start. Spent most of the morning on email. Spreading thin again — six projects open and none of them moved.', 'flat', ['spreading thin', 'focus']],
      ['Ran four miles before work, which set the whole day up. Design work in the afternoon went well — that 1pm to 4pm window is real.', 'great', ['health', 'design', 'focus']],
      ['Talked to Jake about the launch. He thinks the onboarding is the weak point. He is right. Feeling stretched between too many things again.', 'fine', ['launch', 'spreading thin']],
    ].entries()) {
      const [body, mood, themes] = entry as [string, string, string[]];
      await obj(`j_${i}`, {
        type: 'journal', title: (body as string).slice(0, 60), body,
        created_at: at(-(i * 3) - 1, 21),
        props: sql.json({ mood, themes }) as never,
      });
    }

    await obj('idea_agent', {
      type: 'idea', title: 'An agent that reads your calendar and defends your focus blocks',
      area: 'career', status: 'exploring', progress: 25,
    });
    await obj('dec_nyc', {
      type: 'decision', title: 'Not moving to NYC this year', area: 'home', status: 'made',
      body: 'The runway matters more than the scene right now.',
      props: sql.json({
        reasoning: 'Rent would take 18 months off the $1M timeline.',
        alternatives: ['Move in spring', 'Sublet for three months first'],
        revisit_at: at(180).toISOString(),
      }) as never,
    });
    await obj('note_graph', {
      type: 'note', title: 'Personal knowledge graphs', area: 'learning',
      body: 'The interesting part is not storage, it is the edges. An unconnected note is nearly worthless.',
    });
    await obj('save_pkg', {
      type: 'save', title: 'Building a personal knowledge graph', status: 'unread', area: 'learning',
      props: sql.json({ url: 'https://example.com/pkg' }) as never,
    });

    // ── Library ──────────────────────────────────────────────────────────────
    await obj('b_momtest', {
      type: 'book', title: 'The Mom Test', area: 'learning', status: 'reading', progress: 45,
      props: sql.json({ author: 'Rob Fitzpatrick' }) as never,
    });
    await obj('b_shape', {
      type: 'book', title: 'Shape Up', area: 'career', status: 'finished', progress: 100,
      completed_at: at(-30), props: sql.json({ author: 'Ryan Singer', rating: 4 }) as never,
    });
    await edge('b_momtest', 'per_alex', 'recommended_by');
    await obj('i_design', {
      type: 'interest', title: 'Design engineering', area: 'career', status: 'active',
    });
    await obj('i_running', { type: 'interest', title: 'Distance running', area: 'health', status: 'active' });

    // ── Life ─────────────────────────────────────────────────────────────────
    await obj('x_meetup', {
      type: 'experience', title: 'AI meetup', area: 'relationships',
      start_at: at(-1, 18), props: sql.json({ location: 'San Francisco' }) as never,
    });
    await edge('x_meetup', 'per_sarah', 'with');
    await edge('x_meetup', 'per_jake', 'with');

    // ── Money ────────────────────────────────────────────────────────────────
    const accounts = [
      ['Everyday checking', 'depository', 'checking', 18420.55, null],
      ['High-yield savings', 'depository', 'savings', 42000.0, null],
      ['Brokerage', 'investment', 'brokerage', 512300.4, null],
      ['Retirement', 'investment', 'ira', 118000.0, null],
      ['Credit card', 'credit', 'credit card', -3240.18, 0.229],
      ['Student loan', 'loan', 'student', -14200.0, 0.054],
    ] as const;
    const accountIds: string[] = [];
    for (const [name, kind, subtype, balance, apr] of accounts) {
      const id = randomUUID();
      accountIds.push(id);
      await sql`insert into account (id, user_id, name, kind, subtype, balance_current, apr,
                                    is_manual, minimum_payment)
        values (${id}::uuid, ${uid}::uuid, ${name}, ${kind}, ${subtype}, ${balance},
                ${apr}, true, ${kind === 'credit' ? 120 : kind === 'loan' ? 210 : null})`;
    }

    const merchants: [string, string, number][] = [
      ['Whole Foods', 'groceries', -142.3], ['Blue Bottle', 'restaurants', -6.5],
      ['Rent', 'housing', -2850], ['Uber', 'transport', -24.15],
      ['Netflix', 'subscriptions', -15.49], ['Figma', 'subscriptions', -15],
      ['Dinner — Nopa', 'restaurants', -60], ['Amazon', 'shopping', -89.99],
      ['PG&E', 'utilities', -96.4], ['Trader Joe’s', 'groceries', -88.12],
      ['Gym', 'health', -85], ['Salary', 'other', 9200],
    ];
    for (let m = 0; m < 4; m++) {
      for (const [merchant, category, amount] of merchants) {
        const d = new Date(Date.now() - m * 30 * day - Math.floor(Math.random() * 20) * day);
        await sql`insert into "transaction" (id, user_id, account_id, posted_at, amount, merchant,
                                             description, category, category_source)
          values (${randomUUID()}::uuid, ${uid}::uuid, ${accountIds[0]!}::uuid,
                  ${d.toISOString().slice(0, 10)},
                  ${amount * (0.9 + Math.random() * 0.2)}, ${merchant}, ${merchant},
                  ${category}, 'plaid')`;
      }
    }

    await obj('fg_million', {
      type: 'financial_goal', title: '$1M invested by 35', area: 'finance', status: 'active',
      target_value: 1000000, current_value: 630300, unit: 'USD', due_at: at(1800),
      props: sql.json({ annual_return: 0.07, monthly: 3200 }) as never,
    });
    await obj('fg_emergency', {
      type: 'financial_goal', title: 'Six-month emergency fund', area: 'finance', status: 'active',
      target_value: 36000, current_value: 42000, unit: 'USD', due_at: at(180),
      props: sql.json({ annual_return: 0.04, monthly: 500 }) as never,
    });
    await edge('fg_million', 'g_million', 'supports');

    // ── Calendar ─────────────────────────────────────────────────────────────
    for (const [title, hour, mins] of [['Team sync', 9, 30], ['1:1 with Dana', 10, 45], ['Design review', 15, 60]] as const) {
      await sql`insert into calendar_event (id, user_id, title, starts_at, ends_at, busy)
        values (${randomUUID()}::uuid, ${uid}::uuid, ${title}, ${at(0, hour)},
                ${new Date(at(0, hour).getTime() + mins * 60000)}, true)`;
    }

    // ── Personal model ───────────────────────────────────────────────────────
    for (const [category, statement, confidence, count] of [
      ['patterns', 'You tend to stall on goals that require more than five hours a week.', 0.78, 4],
      ['patterns', 'You do your best focused work between 1pm and 4pm.', 0.64, 11],
      ['patterns', '“Spreading thin” shows up in weeks where you have more than six active projects.', 0.71, 4],
      ['preferences', 'You prefer shipping something rough to planning something complete.', 0.66, 6],
      ['values', 'Autonomy consistently outranks compensation in your decisions.', 0.82, 5],
      ['context', 'You are between a startup and a job search, and treating both as primary.', 0.7, 3],
    ] as const) {
      await sql`insert into model_fact (id, user_id, category, statement, confidence, source_count, evidence)
        values (${randomUUID()}::uuid, ${uid}::uuid, ${category}, ${statement}, ${confidence},
                ${count}, ${sql.json([{ kind: 'journal', note: 'seeded', at: new Date().toISOString() }])})`;
    }

    // ── History so the sparklines and deltas have something to draw ──────────
    // Run the rollup first, then backfill ninety days that *arrive* at the real
    // computed value. Backfilling to an invented number would make today's
    // delta nonsense — the first thing anyone looks at on Home.
    await sql`select rollup_progress(${uid}::uuid)`;

    const current = (await sql<{ area: string; value: string }[]>`
      select distinct on (area) area, value
        from metric
       where user_id = ${uid}::uuid and key = 'area_progress' and area is not null
       order by area, at desc
    `);

    for (const row of current) {
      const today = Number(row.value);
      const start = Math.max(5, today - 22 - Math.random() * 10);
      for (let d = 90; d >= 1; d--) {
        const t = (90 - d) / 90;
        // Ease toward today's value with a little jitter, so the sparkline
        // reads as real movement rather than a straight line.
        const value = Math.min(100, start + (today - start) * t + (Math.random() - 0.5) * 1.5);
        await sql`insert into metric (id, user_id, key, area, value, unit, at)
          values (${randomUUID()}::uuid, ${uid}::uuid, 'area_progress', ${row.area},
                  ${value.toFixed(2)}, '%', ${new Date(Date.now() - d * day)})`;
      }
    }

    for (let d = 90; d >= 0; d--) {
      await sql`insert into metric (id, user_id, key, value, unit, at)
        values (${randomUUID()}::uuid, ${uid}::uuid, 'net_worth',
                ${(600000 + (90 - d) * 800 + Math.random() * 4000).toFixed(2)}, 'USD',
                ${new Date(Date.now() - d * day)})`;
    }

    // Completed activity across areas, so Drift has real effort to compare.
    for (let d = 28; d >= 0; d--) {
      const weights: [string, number][] = [['career', 4], ['finance', 3], ['relationships', 2], ['learning', 2], ['health', 1]];
      for (const [area, n] of weights) {
        if (Math.random() > n / 6) continue;
        await sql`insert into activity (id, user_id, verb, actor, minutes, area, at)
          values (${randomUUID()}::uuid, ${uid}::uuid, 'completed', 'user',
                  ${30 + Math.floor(Math.random() * 60)}, ${area},
                  ${new Date(Date.now() - d * day - Math.random() * day)})`;
      }
    }

    await sql`select rollup_progress(${uid}::uuid)`;

    const [{ count }] = await sql<{ count: string }[]>`
      select count(*)::text from object where user_id = ${uid}::uuid`;
    console.log(`Seeded ${count} objects for ${EMAIL} (user ${uid}).`);
    console.log('Open http://localhost:3000');
  } catch (e) {
    console.error('Seed failed:', e);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void main();
