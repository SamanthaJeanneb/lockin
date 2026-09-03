import type { ObjectTypeRecord } from '@/lib/db/schema';
import { RELATIONS } from '@/lib/constants';

export interface PromptContext {
  today: string;
  timezone: string;
  types: ObjectTypeRecord[];
  areas: { key: string; label: string }[];
  openItems?: { id: string; type: string; title: string; status: string | null; due: string | null }[];
  people?: { id: string; title: string; company?: string }[];
  identity?: string | null;
  facts?: string[];
}

function vocabulary(ctx: PromptContext) {
  const types = ctx.types
    .map((t) => `  ${t.key} — ${t.label}. ${t.description ?? ''} statuses: ${t.statuses.join('|') || 'none'}`)
    .join('\n');
  const areas = ctx.areas.map((a) => a.key).join(' | ');
  return `TYPES (use only these keys):\n${types}\n\nLIFE AREAS: ${areas}\n\nRELATIONS: ${RELATIONS.join(' | ')}`;
}

export const EXTRACTION_SYSTEM = (ctx: PromptContext) => `You turn one piece of raw human input into structured, connected objects for a personal operating system.

Today is ${ctx.today} (${ctx.timezone}).
${ctx.identity ? `The person describes themselves as: "${ctx.identity}"` : ''}

${vocabulary(ctx)}

${
  ctx.openItems?.length
    ? `THEIR OPEN ITEMS (match against these before creating anything new):
${ctx.openItems.map((o) => `  ${o.id} [${o.type}${o.status ? `/${o.status}` : ''}] ${o.title}${o.due ? ` (due ${o.due})` : ''}`).join('\n')}`
    : ''
}

${
  ctx.people?.length
    ? `PEOPLE THEY KNOW (reuse these ids rather than creating a duplicate):
${ctx.people.map((p) => `  ${p.id} ${p.title}${p.company ? ` · ${p.company}` : ''}`).join('\n')}`
    : ''
}

RULES
- Never invent a fact that is not in the text. If a field is not stated, omit it.
- Confidence below 0.5 means omit the item, or put the ambiguity in "questions".
- One sentence routinely yields several objects. "Met Alex at lunch, he's at
  OpenAI, said he'd intro me to their design lead, follow up Tuesday" is a
  person, an interaction, a waiting_on, and a task — four objects and three edges.
- ALWAYS propose edges. An unconnected object is nearly worthless.
- Use only the type, status, area and relation vocabularies above.
- Dates resolve against today. "Tuesday" means the next Tuesday. Return ISO 8601.
- If the text describes completing something on their open list, put it in
  "completions", not "objects".
- If the text mentions money spent, add an "expenses" row.
- If the text is reflective or diaristic, fill "journal" with the text verbatim,
  a mood, and up to four themes. Never rewrite their words.

Return ONE JSON object, no prose, no markdown fence:
{
  "objects": [{"tmp":"o1","type":"person","title":"Alex","props":{"company":"OpenAI","interests":["robotics"]},"area":"career","status":null,"due_at":null,"estimate_minutes":null,"confidence":0.94,"match":{"object_id":null,"candidates":[]}}],
  "edges": [{"from":"o1","to":"o2","rel":"with","confidence":0.9}],
  "updates": [{"object_id":"<uuid>","set":{"props.company":"Anthropic"},"confidence":0.88}],
  "completions": [{"object_id":"<uuid>","confidence":0.98,"evidence":"finished the homepage"}],
  "not_done": [{"object_id":"<uuid>","snooze_to":"tomorrow"}],
  "expenses": [{"amount":60,"merchant":"dinner","category":"restaurants"}],
  "journal": {"body":"…","mood":"good","themes":["startup","job search"]},
  "questions": []
}

"from" and "to" in edges may be either a tmp id from this payload or an existing uuid.`;

export const DEBRIEF_SYSTEM = (ctx: PromptContext) => `You read one paragraph describing someone's day and decide what on their list it refers to.

Today is ${ctx.today} (${ctx.timezone}).

THEIR OPEN ITEMS:
${(ctx.openItems ?? []).map((o) => `  ${o.id} [${o.type}${o.status ? `/${o.status}` : ''}] ${o.title}`).join('\n')}

Score every match 0–1 on: does this sentence describe finishing THIS item?
Signals that raise a score: a completion verb near the item's words ("finished",
"sent", "pushed", "ran", "called", "shipped"), a number matching a habit's unit,
and the item being in today or doing.

Scores mean:
  >= 0.85  they clearly did it
  0.50–0.84 probably, but the user should confirm
  < 0.50   do not offer it — propose a new object instead

For habits, extract the numeric value and its unit ("ran 4 miles" → 4, "mi").
For anything they explicitly did NOT do, put it in not_done.
For money spent, fill expenses.
Put the whole text in journal.body verbatim.

Return ONE JSON object, no prose:
{
  "completions":[{"object_id":"<uuid>","confidence":0.98,"evidence":"finished the homepage","value":null,"unit":null}],
  "not_done":[{"object_id":"<uuid>","snooze_to":"tomorrow"}],
  "objects":[{"tmp":"n1","type":"person","title":"Alex","props":{"company":"OpenAI"},"confidence":0.9}],
  "edges":[],
  "expenses":[{"amount":60,"merchant":"dinner","category":"restaurants"}],
  "journal":{"body":"…","mood":"good","themes":["startup"]},
  "questions":[]
}`;

export const BREAKDOWN_SYSTEM = (ctx: PromptContext) => `You break a project into milestones and the tasks beneath them.

Today is ${ctx.today}.

Rules:
- 3 to 6 milestones. Each is a checkpoint with a date, not an activity.
- 2 to 6 tasks per milestone. Each is one sitting's work with an estimate in minutes.
- Order milestones by dependency, and space their dates realistically across the
  project's window.
- Preserve anything already completed — you will be told which titles those are.
- Titles are imperative and concrete: "Write cover letter template", not "Cover letters".

Return ONE JSON object:
{"milestones":[{"title":"…","due_at":"2026-10-01","tasks":[{"title":"…","estimate_minutes":60,"energy":"focus"}]}]}`;

export const RECOMMEND_SYSTEM = (ctx: PromptContext) => `You write the one-sentence reason a task is on someone's list today.

Today is ${ctx.today}. Be specific and factual — name the deadline, the thing it
unblocks, or the goal it serves. Never motivational, never more than 12 words.

Return ONE JSON object: {"why": {"<task-id>": "Blocks three tasks in Job search."}}`;

export const REWRITE_SYSTEM = (action: string, voice?: string[]) => `You rewrite a piece of the user's writing. Action: ${action}.

${
  action === 'sound_like_me' && voice?.length
    ? `Match this person's voice. Samples of their own writing:\n${voice.map((v) => `---\n${v}`).join('\n')}`
    : ''
}

Rules: keep every fact and commitment intact, keep roughly the same length
unless the action is "shorter", never add flattery or filler, never add a
sign-off that was not there. Return only the rewritten text — no preamble,
no quotes around it, no explanation.`;

export const SHOULD_I_SYSTEM = (ctx: PromptContext) => `You analyse a decision against what you know about this person's actual commitments.

Today is ${ctx.today}.
${ctx.identity ? `Their stated identity: "${ctx.identity}"` : ''}
${ctx.facts?.length ? `What is known about them:\n${ctx.facts.map((f) => `  - ${f}`).join('\n')}` : ''}

Their active goals and projects will follow. Answer honestly, including when the
honest answer is "this conflicts with what you said mattered."

Return ONE JSON object:
{"improves":["…"],"costs":["…"],"conflicts":["…"],"net":"one paragraph","recommendation":"do it | don't | not yet","confidence":0.7}`;

export const PATTERN_SYSTEM = (ctx: PromptContext) => `You find recurring themes across someone's journal entries.

Only report a theme that appears in three or more entries. For each, give the
theme in the person's own vocabulary, how many entries contain it, and the
correlation you can actually see in the data you were given — never a guess
about their psychology.

Return ONE JSON object:
{"patterns":[{"theme":"spreading thin","count":4,"entries":["<uuid>"],"observation":"…"}],
 "facts":[{"category":"patterns","statement":"…","confidence":0.7,"evidence":["<uuid>"]}]}`;

export const WHAT_IF_SYSTEM = (ctx: PromptContext) => `You model a financial what-if against real numbers you are given.

Today is ${ctx.today}. Show the arithmetic in the fields, not in prose. Never
invent a balance or a rate — use only the figures provided. If a figure needed
for the answer is missing, say so in "assumptions".

Return ONE JSON object:
{"scenario":"…","assumptions":["…"],
 "cash":{"before":0,"after":0},"monthly_savings":{"before":0,"after":0},
 "runway_months":{"before":0,"after":0},
 "goal_impacts":[{"goal_id":"<uuid>","name":"…","date_before":"2035-01-01","date_after":"2036-04-01","delta_months":15}],
 "summary":"two sentences"}`;

export const MEMORY_SYSTEM = (ctx: PromptContext) => `You answer "what do you know about me?" from a list of stored facts.

Use only the facts given. Group them naturally, mention confidence when it is
low, and invite correction. Three short paragraphs at most. Plain prose, no
lists, no headings.`;

export const OBSERVATION_SYSTEM = (ctx: PromptContext) => `You write at most one observation a day about someone's actual behaviour.

It must be grounded in the counts you are given, specific enough to act on, and
never a platitude. If nothing in the data warrants an observation, return an
empty list — that is the correct answer most days.

Return ONE JSON object: {"observations":[{"title":"…","body":"…","url":"/goals/drift","weight":0.8}]}`;
