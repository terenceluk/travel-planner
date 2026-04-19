import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { address } = req.query;

  if (
    typeof address !== 'string' ||
    address.trim().length === 0 ||
    address.length > 300
  ) {
    return res.status(400).send('Invalid address');
  }

  const serverKey = process.env.GOOGLE_MAPS_API_KEY;
  const clientKey = typeof req.headers['x-google-api-key'] === 'string' ? req.headers['x-google-api-key'] : undefined;
  const apiKey = serverKey || clientKey;
  if (!apiKey) {
    return res.status(400).send('No API key provided');
  }

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/staticmap',
      {
        params: {
          center: address.trim(),
          zoom: 15,
          size: '700x140',
          maptype: 'roadmap',
          markers: `color:red|${address.trim()}`,
          key: apiKey,
        },
        responseType: 'arraybuffer',
      },
    );

    const contentType = (response.headers['content-type'] as string) || ''
    // If Google returned an error page (API not enabled, quota exceeded, etc.)
    // the content-type will be text/html or application/json, not an image.
    if (!contentType.startsWith('image/')) {
      console.warn('place-image: Google returned non-image content-type:', contentType)
      return res.status(422).send('Map image unavailable')
    }

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // cache for 24 hours
    return res.send(response.data);
  } catch (err) {
    console.error('Place image error:', err);
    return res.status(500).send('Failed to fetch image');
  }
});

export default router;
