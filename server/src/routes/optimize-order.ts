import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

interface OptimizeRequestBody {
  origin: string;
  stops: string[];
}

router.post('/', async (req: Request, res: Response) => {
  const { origin, stops } = req.body as OptimizeRequestBody;

  if (
    typeof origin !== 'string' || origin.trim().length === 0 ||
    !Array.isArray(stops) || stops.length < 2 || stops.length > 23 ||
    stops.some(s => typeof s !== 'string' || s.trim().length === 0)
  ) {
    return res.status(400).json({ error: 'Provide origin and 2–23 non-empty stop addresses.' });
  }

  const serverKey = process.env.GOOGLE_MAPS_API_KEY;
  const clientKey = typeof req.headers['x-google-api-key'] === 'string' ? req.headers['x-google-api-key'] : undefined;
  const apiKey = serverKey || clientKey;
  if (!apiKey) {
    return res.status(400).json({ error: 'No Google Maps API key provided.' });
  }

  // Use last stop as fixed destination; optimize the rest as intermediate waypoints.
  const destination = stops[stops.length - 1].trim();
  const midpoints = stops.slice(0, stops.length - 1).map(s => s.trim());
  const waypointsParam = midpoints.length > 0
    ? `optimize:true|${midpoints.join('|')}`
    : destination;

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: { origin: origin.trim(), destination, waypoints: waypointsParam, key: apiKey },
    });

    const { status, routes, error_message } = response.data;

    if (status === 'OVER_QUERY_LIMIT') {
      return res.json({ error: 'Google Maps API quota exceeded. Please try again later.' });
    }
    if (status !== 'OK' || !routes?.length) {
      console.error(`[optimize-order] status: ${status} — ${error_message ?? ''}`);
      return res.json({ error: status || 'No route found.' });
    }

    // waypoint_order covers only the intermediate waypoints (midpoints[]).
    // Append the last stop's original index (stops.length - 1) as the fixed final stop.
    const waypointOrder: number[] = routes[0].waypoint_order ?? [];
    const optimizedOrder: number[] = [...waypointOrder, stops.length - 1];

    return res.json({ optimizedOrder });
  } catch (err) {
    console.error('[optimize-order] error:', err);
    return res.status(500).json({ error: 'Optimization request failed.' });
  }
});

export default router;
