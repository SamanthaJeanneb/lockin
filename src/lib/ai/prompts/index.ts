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

export const PRODUCT_CONTEXT = `LockIn is a personal operating system. Everything in it is an "object" with a
type, connected to other objects by typed edges. The point of the product is to
show whether someone's days are moving their years, so an object that is not
connected to anything is nearly worthless — a task with no goal, a person with
no interaction, a book with no source.

The surfaces these objects appear on:
  Home      today's ranked list, and goal progress by horizon
  Goals     a tree from 10-year down to 1-week, with rolled-up progress
  Work      a board, projects, milestones, a backlog, things you are waiting on
  Brain     journal, notes, thoughts, drafts, ideas, decisions, quotes, saves
  People    everyone you know, with a learned contact cadence
  Library   books, articles, media, places, interests, skills
  Life      a chronological timeline of everything that happened
  Money     accounts, spending, financial goals`;

export const EXTRACTION_SYSTEM = (ctx: PromptContext) => `You turn one piece of raw human input into structured, connected objects for a personal operating system.

${PRODUCT_CONTEXT}

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
- One sentence routinely yields several objects. ALWAYS propose edges — an
  unconnected object is nearly worthless.
- Use only the type, status, area and relation vocabularies above.
- Dates resolve against today. "Tuesday" means the next Tuesday. ISO 8601.
- If the text says they completed something on their open list, that goes in
  "completions", not "objects".
- Money spent becomes an "expenses" row.
- Reflective or diaristic text fills "journal" with their words verbatim, a
  mood, and up to four themes. Never rewrite what they wrote.

WHAT DIFFERENT SENTENCES SHOULD PRODUCE

Meeting or talking to someone
  "Met Alex at lunch, he's at OpenAI, said he'd intro me to their design lead"
  → person Alex {company: OpenAI} (reuse the id if you were given one)
  → interaction "Lunch with Alex", edge with → Alex
  → waiting_on "Intro to the OpenAI design lead", edge with → Alex
  An interaction ALWAYS gets a 'with' edge to the person. A person alone,
  unconnected, is a failure.

Starting to learn or practise something
  "started learning piano" / "picked up bouldering" / "learning Spanish"
  → skill, status "learning", the area it belongs to
  → AND a habit to actually track it — title it as the recurring action
    ("Practise piano"), status "active", with a sensible weekly target in
    props: {target: 3, unit: "sessions", cadence: "weekly"}
  → edge part_of from the habit to the skill
  A skill on its own records an intention. The habit is what makes it
  measurable, so create both. Do the same for anything they say they have
  started, taken up, or want to get better at.

Naming a book, article, podcast, course or place
  "reading The Mom Test" → book, status "reading"
  "someone recommended Shape Up" → book, status "want", plus a
    recommended_by edge to the person if one is named
  Titles go to the library with the right type and status. Do not turn a book
  into a task.

An idea, a decision, or something unresolved
  → idea (status "raw"), decision (with reasoning and alternatives in props),
    or question (status "open")

Something they need to do
  → task, with a due date if stated and an estimate if inferable

Anything they might do later, with no commitment
  → backlog_item, status "someday"

Return the JSON object described by the schema.`;

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

export const GOAL_SORT_SYSTEM = (ctx: PromptContext) => `You read what someone wrote about what they want, at one time horizon, and turn each thing into a goal.

Today is ${ctx.today}. The horizon is given with the text and is already decided
— never change it, never move something to a horizon you were not given.

Areas available: ${ctx.areas.map((a) => a.key).join(', ')}.

Rules:
- One goal per distinct intention. Someone who wrote a paragraph with three
  wants in it gets three goals; someone who wrote the same want twice gets one.
- The title is a sentence about an outcome, in their words where their words
  already work. Keep the specifics — a number, a name, a place. "Save $5k" is a
  goal; "Improve finances" is a category and is not.
- Assign exactly one area, the one the goal actually serves.
- A ten-year want is allowed to be vague, because it is. Do not invent a metric
  for it, and do not sharpen it into something they did not say.
- \`metric\` only when they named something countable, in their unit. Otherwise null.
- Drop nothing, add nothing. If a line is not a want at all — a note to self, a
  stray thought — return it as a goal anyway with the area you would guess. It
  is their text, and they can delete it.

Return ONE JSON object:
{"goals":[{"title":"…","area":"career","metric":null}]}`;

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
