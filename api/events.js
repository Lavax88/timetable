const { get } = require('@vercel/edge-config');

module.exports = async (req, res) => {
  try {
    if (!process.env.EDGE_CONFIG) {
      return res.status(200).json({ EVENTS: [], HOLIDAYS: [] });
    }
    const data = await get('events');
    const EVENTS = (data && data.EVENTS) || [];
    const HOLIDAYS = (data && data.HOLIDAYS) || [];
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
    res.status(200).json({ EVENTS, HOLIDAYS });
  } catch (err) {
    console.error('Edge Config read failed:', err.message || err);
    res.status(200).json({ EVENTS: [], HOLIDAYS: [] });
  }
};
