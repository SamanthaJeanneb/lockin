/**
 * JSON schemas for the structured-output calls.
 *
 * With a schema attached the API is constrained to it, so the response is valid
 * by construction — no prefill trick, no fence-stripping, no partial objects.
 * Every property is listed in `required` and `additionalProperties` is false,
 * which is what the API requires for a strict schema; "absent" is expressed as
 * an explicitly nullable field rather than an omitted key.
 */

const nullableString = { type: ['string', 'null'] } as const;
const nullableNumber = { type: ['number', 'null'] } as const;

/**
 * A strict schema cannot contain an open object — the API rejects any `object`
 * without `additionalProperties: false`. Type-specific fields (a person's
 * company, a book's author) are open by nature, so they travel as key/value
 * pairs and are folded back into an object on arrival.
 */
const propertyBag = {
  type: 'array',
  description: 'Type-specific fields as key/value pairs, e.g. {key:"company", value:"OpenAI"}.',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['key', 'value'],
    properties: { key: { type: 'string' }, value: { type: 'string' } },
  },
} as const;

export const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['objects', 'edges', 'updates', 'completions', 'not_done', 'expenses', 'journal', 'questions'],
  properties: {
    objects: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tmp', 'type', 'title', 'props', 'area', 'status', 'due_at', 'estimate_minutes', 'confidence'],
        properties: {
          tmp: { type: 'string', description: 'A local id such as o1, referenced by edges.' },
          type: { type: 'string', description: 'A key from the TYPES list.' },
          title: { type: 'string' },
          props: propertyBag,
          area: nullableString,
          status: nullableString,
          due_at: { ...nullableString, description: 'ISO 8601, resolved against today.' },
          estimate_minutes: nullableNumber,
          confidence: { type: 'number', description: '0 to 1.' },
        },
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['from', 'to', 'rel', 'confidence'],
        properties: {
          from: { type: 'string', description: 'A tmp id from this payload, or an existing uuid.' },
          to: { type: 'string' },
          rel: { type: 'string' },
          confidence: { type: 'number', description: '0 to 1.' },
        },
      },
    },
    updates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['object_id', 'set', 'confidence'],
        properties: {
          object_id: { type: 'string' },
          set: propertyBag,
          confidence: { type: 'number' },
        },
      },
    },
    completions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['object_id', 'confidence', 'evidence'],
        properties: {
          object_id: { type: 'string' },
          confidence: { type: 'number' },
          evidence: { type: 'string' },
        },
      },
    },
    not_done: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['object_id', 'snooze_to'],
        properties: { object_id: { type: 'string' }, snooze_to: { type: 'string' } },
      },
    },
    expenses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['amount', 'merchant', 'category'],
        properties: {
          amount: { type: 'number' },
          merchant: { type: 'string' },
          category: { type: 'string' },
        },
      },
    },
    journal: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['body', 'mood', 'themes'],
      properties: {
        body: { type: 'string' },
        mood: nullableString,
        themes: { type: 'array', items: { type: 'string' } },
      },
    },
    questions: { type: 'array', items: { type: 'string' } },
  },
} as const;

export const DEBRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['completions', 'not_done', 'objects', 'edges', 'expenses', 'journal', 'questions'],
  properties: {
    completions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['object_id', 'confidence', 'evidence', 'value', 'unit'],
        properties: {
          object_id: { type: 'string' },
          confidence: { type: 'number' },
          evidence: { type: 'string' },
          value: nullableNumber,
          unit: nullableString,
        },
      },
    },
    not_done: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['object_id', 'snooze_to'],
        properties: { object_id: { type: 'string' }, snooze_to: { type: 'string' } },
      },
    },
    objects: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tmp', 'type', 'title', 'props', 'confidence'],
        properties: {
          tmp: { type: 'string' },
          type: { type: 'string' },
          title: { type: 'string' },
          props: propertyBag,
          confidence: { type: 'number' },
        },
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['from', 'to', 'rel', 'confidence'],
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          rel: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
    expenses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['amount', 'merchant', 'category'],
        properties: {
          amount: { type: 'number' },
          merchant: { type: 'string' },
          category: { type: 'string' },
        },
      },
    },
    journal: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['body', 'mood', 'themes'],
      properties: {
        body: { type: 'string' },
        mood: nullableString,
        themes: { type: 'array', items: { type: 'string' } },
      },
    },
    questions: { type: 'array', items: { type: 'string' } },
  },
} as const;

export const BREAKDOWN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['milestones'],
  properties: {
    milestones: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'due_at', 'tasks'],
        properties: {
          title: { type: 'string' },
          due_at: nullableString,
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'estimate_minutes', 'energy'],
              properties: {
                title: { type: 'string' },
                estimate_minutes: nullableNumber,
                energy: nullableString,
              },
            },
          },
        },
      },
    },
  },
} as const;

export const GOAL_SORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['goals'],
  properties: {
    goals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'area', 'metric'],
        properties: {
          title: { type: 'string' },
          area: { type: 'string' },
          metric: nullableString,
        },
      },
    },
  },
} as const;
