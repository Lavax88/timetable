const { get } = require('@vercel/edge-config');

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN || '';
const EDGE_CONFIG_ID   = process.env.EDGE_CONFIG_ID   || '';

// Only these event types may be self-deleted by a student completing them
const COMPLETABLE_TYPES = new Set(['deadline', 'reminder']);

async function readEdgeConfig() {
  if (!process.env.EDGE_CONFIG) {
    return { EVENTS: [], HOLIDAYS: [], SETTINGS: {} };
  }
  const data = await get('events');
  return {
    EVENTS:   (data && data.EVENTS)   || [],
    HOLIDAYS: (data && data.HOLIDAYS) || [],
    SETTINGS: (data && data.SETTINGS) || {},
  };
}

async function writeEdgeConfig(payload) {
  if (!EDGE_CONFIG_ID)   throw new Error('EDGE_CONFIG_ID env var is not set');
  if (!VERCEL_API_TOKEN) throw new Error('VERCEL_API_TOKEN env var is not set');

  const url  = `https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/items`;
  const body = {
    items: [{ operation: 'upsert', key: 'events', value: payload }],
  };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization:  `Bearer ${VERCEL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Edge Config write failed (${res.status}): ${text}`);
  }
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, date } = req.body || {};

  if (!title || !date) {
    return res.status(400).json({ error: 'Missing title or date.' });
  }

  try {
    const current = await readEdgeConfig();

    const before = current.EVENTS.length;

    // Only remove events that are of a completable type — safety guard
    current.EVENTS = current.EVENTS.filter(
      ev => !(ev.title === title && ev.date === date && COMPLETABLE_TYPES.has(ev.type))
    );

    const removed = before - current.EVENTS.length;

    if (removed > 0) {
      await writeEdgeConfig({
        EVENTS:   current.EVENTS,
        HOLIDAYS: current.HOLIDAYS,
        SETTINGS: current.SETTINGS,
      });
    }

    return res.status(200).json({ success: true, removed });
  } catch (err) {
    console.error('complete_event error:', err.message || err);
    return res.status(500).json({ error: `Failed to update events: ${err.message}` });
  }
};
