import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { lat, lng } = req.query;

  if (typeof lat !== 'string' || typeof lng !== 'string') {
    return res.status(400).json({ error: 'Missing lat/lng parameters.' });
  }

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  if (
    !Number.isFinite(latNum) || !Number.isFinite(lngNum) ||
    latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180
  ) {
    return res.status(400).json({ error: 'Invalid coordinates.' });
  }

  const serverKey = process.env.GOOGLE_MAPS_API_KEY;
  const clientKey = typeof req.headers['x-google-api-key'] === 'string' ? req.headers['x-google-api-key'] : undefined;
  const apiKey = serverKey || clientKey;
  if (!apiKey) {
    return res.status(400).json({ error: 'No Google Maps API key provided.' });
  }

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { latlng: `${latNum},${lngNum}`, key: apiKey },
    });

    const { status, results, error_message } = response.data;

    if (status === 'OVER_QUERY_LIMIT') {
      return res.json({ address: null, status, error: 'Google Maps API quota exceeded. Please try again later or check your billing settings.' });
    }
    if (status === 'REQUEST_DENIED') {
      return res.json({ address: null, status, error: 'Google Maps API request denied. Check that Geocoding API is enabled for your key.' });
    }
    if (status !== 'OK' || !results?.length) {
      console.error(`[geocode] status: ${status} — ${error_message ?? ''}`);
      return res.json({ address: null, status });
    }

    return res.json({ address: results[0].formatted_address as string });
  } catch (err) {
    console.error('[geocode] error:', err);
    return res.status(500).json({ error: 'Reverse geocoding failed.' });
  }
});

export default router;
