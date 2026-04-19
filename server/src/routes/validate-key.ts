import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// Lightweight probe: test the Places Autocomplete API with a known query.
// This confirms the key exists, is unrestricted (or allows this API), and has billing active.
router.get('/', async (req: Request, res: Response) => {
  const serverKey = process.env.GOOGLE_MAPS_API_KEY;
  const clientKey =
    typeof req.headers['x-google-api-key'] === 'string'
      ? req.headers['x-google-api-key']
      : undefined;
  const apiKey = serverKey || clientKey;

  if (!apiKey) {
    return res.status(400).json({ valid: false, error: 'No API key provided.' });
  }

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json',
      { params: { input: 'toronto', key: apiKey }, timeout: 8000 },
    );
    const { status } = response.data as { status: string };

    if (status === 'OK' || status === 'ZERO_RESULTS') {
      return res.json({ valid: true });
    }

    // Map Google's error codes to human-friendly messages
    const messages: Record<string, string> = {
      REQUEST_DENIED: 'Key is invalid, not enabled for Places API, or restricted.',
      OVER_QUERY_LIMIT: 'Quota exceeded for this key.',
      OVER_DAILY_LIMIT: 'Daily limit reached for this key.',
      INVALID_REQUEST: 'Key rejected — check it is a valid Google Maps API key.',
    };
    return res.json({
      valid: false,
      error: messages[status] ?? `Google returned: ${status}`,
    });
  } catch (err) {
    console.error('[validate-key] error:', err);
    return res.status(500).json({ valid: false, error: 'Could not reach Google to validate the key.' });
  }
});

export default router;
