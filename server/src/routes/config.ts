import { Router } from 'express';

const router = Router();

// Tells the client whether it must supply its own Google Maps API key.
// When the server already has GOOGLE_MAPS_API_KEY set, the client never needs to prompt.
router.get('/', (_, res) => {
  res.json({ requiresApiKey: !process.env.GOOGLE_MAPS_API_KEY });
});

export default router;
