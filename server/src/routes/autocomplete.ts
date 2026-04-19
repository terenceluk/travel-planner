import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { input, sessiontoken, countryCode } = req.query;

  if (
    typeof input !== 'string' ||
    input.trim().length < 2 ||
    input.length > 200
  ) {
    return res.json({ predictions: [] });
  }

  // Session tokens reduce billing to one charge per session rather than per keystroke.
  // Validate format: UUID-like (alphanumeric + hyphens, max 50 chars).
  if (
    sessiontoken !== undefined &&
    (typeof sessiontoken !== 'string' ||
      sessiontoken.length > 50 ||
      !/^[a-zA-Z0-9-]+$/.test(sessiontoken))
  ) {
    return res.status(400).json({ predictions: [] });
  }

  // Validate countryCode: optional ISO 3166-1 alpha-2 code (e.g. "au", "us")
  if (countryCode !== undefined && (typeof countryCode !== 'string' || !/^[a-zA-Z]{2}$/.test(countryCode))) {
    return res.status(400).json({ predictions: [] });
  }

  const serverKey = process.env.GOOGLE_MAPS_API_KEY;
  const clientKey = typeof req.headers['x-google-api-key'] === 'string' ? req.headers['x-google-api-key'] : undefined;
  const apiKey = serverKey || clientKey;
  if (!apiKey) {
    return res.status(400).json({ predictions: [], status: 'NO_API_KEY' });
  }

  try {
    const params: Record<string, string> = {
      input: input.trim(),
      key: apiKey,
    };
    if (typeof sessiontoken === 'string') {
      params.sessiontoken = sessiontoken;
    }
    if (typeof countryCode === 'string' && /^[a-zA-Z]{2}$/.test(countryCode)) {
      params.components = `country:${countryCode.toLowerCase()}`;
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json',
      { params },
    );

    const { status, error_message, predictions: raw } = response.data;

    if (status && status !== 'OK' && status !== 'ZERO_RESULTS') {
      console.error(`[autocomplete] Google status: ${status} — ${error_message ?? '(no message)'}`);
      return res.json({ predictions: [], status });
    }

    const predictions = (raw ?? []).map(
      (p: { description: string; place_id: string }) => ({
        description: p.description,
        place_id: p.place_id,
      }),
    );

    return res.json({ predictions });
  } catch (err) {
    console.error('Autocomplete error:', err);
    return res.json({ predictions: [] });
  }
});

export default router;
