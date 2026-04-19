import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const MAPS_BASE = 'https://maps.googleapis.com/maps/api/directions/json';
type Mode = 'driving' | 'transit' | 'walking' | 'cycling';
const VALID_MODES: Mode[] = ['driving', 'transit', 'walking', 'cycling'];

interface DirectionsRequestBody {
  origin: string;
  destination: string;
  arrivalTime: number; // Unix timestamp in seconds
  modes?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractLeg(data: any, mode: Mode, arrivalTime: number) {
  if (data.status === 'OVER_QUERY_LIMIT') return { error: 'OVER_QUERY_LIMIT' };
  if (data.status !== 'OK' || !data.routes?.length) return null;

  const leg = data.routes[0].legs[0];
  const distanceText: string = leg.distance?.text ?? '';

  if (mode === 'driving') {
    const durationWithTraffic: number = leg.duration_in_traffic?.value ?? leg.duration.value;
    const durationWithoutTraffic: number = leg.duration.value;
    return {
      durationSeconds: durationWithTraffic,
      durationText: leg.duration_in_traffic?.text ?? leg.duration.text,
      distanceText,
      departureTime: arrivalTime - durationWithTraffic,
      departureTimeText: formatTime(arrivalTime - durationWithTraffic),
      durationWithoutTrafficSeconds: durationWithoutTraffic,
      trafficDelaySeconds: durationWithTraffic - durationWithoutTraffic,
    };
  }

  if (mode === 'transit') {
    const duration: number = leg.duration.value;
    const departureTime: number = leg.departure_time?.value ?? (arrivalTime - duration);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const steps = (leg.steps as any[])
      .filter((s) => s.travel_mode === 'TRANSIT')
      .map((s) => ({
        line: s.transit_details?.line?.short_name || s.transit_details?.line?.name || '—',
        vehicle: s.transit_details?.line?.vehicle?.name || 'Transit',
        departure: s.transit_details?.departure_stop?.name || '',
        arrival: s.transit_details?.arrival_stop?.name || '',
      }));
    return {
      durationSeconds: duration,
      durationText: leg.duration.text,
      distanceText,
      departureTime,
      departureTimeText: formatTime(departureTime),
      steps,
    };
  }

  // walking / cycling — no traffic data, compute departure from arrival
  const duration: number = leg.duration.value;
  const departureTime = arrivalTime - duration;
  return {
    durationSeconds: duration,
    durationText: leg.duration.text,
    distanceText,
    departureTime,
    departureTimeText: formatTime(departureTime),
  };
}

router.post('/', async (req: Request, res: Response) => {
  const { origin, destination, arrivalTime, modes } = req.body as DirectionsRequestBody;

  if (
    typeof origin !== 'string' || typeof destination !== 'string' ||
    typeof arrivalTime !== 'number' ||
    origin.trim().length === 0 || destination.trim().length === 0 ||
    origin.length > 300 || destination.length > 300 ||
    !Number.isFinite(arrivalTime)
  ) {
    return res.status(400).json({ error: 'Invalid request parameters.' });
  }

  const requestedModes: Mode[] = Array.isArray(modes)
    ? modes.filter((m): m is Mode => VALID_MODES.includes(m as Mode))
    : ['driving', 'transit'];

  if (requestedModes.length === 0) {
    return res.status(400).json({ error: 'At least one valid transport mode required.' });
  }

  const serverKey = process.env.GOOGLE_MAPS_API_KEY;
  const clientKey = typeof req.headers['x-google-api-key'] === 'string' ? req.headers['x-google-api-key'] : undefined;
  const apiKey = serverKey || clientKey;
  if (!apiKey) {
    return res.status(400).json({ error: 'No Google Maps API key provided.' });
  }

  const estimatedDeparture = Math.max(Math.floor(Date.now() / 1000), arrivalTime - 7200);

  const modeParams: Record<Mode, Record<string, string | number>> = {
    driving:  { mode: 'driving',   departure_time: estimatedDeparture },
    transit:  { mode: 'transit',   arrival_time: arrivalTime },
    walking:  { mode: 'walking' },
    cycling:  { mode: 'bicycling' },
  };

  try {
    const calls = requestedModes.map(m =>
      axios.get(MAPS_BASE, { params: { origin: origin.trim(), destination: destination.trim(), key: apiKey, ...modeParams[m] } })
    );
    const settled = await Promise.allSettled(calls);

    let resolvedOriginAddress: string | undefined;
    let resolvedDestinationAddress: string | undefined;
    const modeResults: Partial<Record<Mode, unknown>> = {};
    let rateLimitHit = false;

    requestedModes.forEach((mode, i) => {
      const outcome = settled[i];
      if (outcome.status !== 'fulfilled') { modeResults[mode] = null; return; }

      const data = outcome.value.data;
      if (data.status === 'OVER_QUERY_LIMIT') { rateLimitHit = true; modeResults[mode] = null; return; }

      const parsed = extractLeg(data, mode, arrivalTime);
      modeResults[mode] = parsed;

      if (!resolvedOriginAddress && data.routes?.[0]?.legs?.[0]) {
        resolvedOriginAddress = data.routes[0].legs[0].start_address;
        resolvedDestinationAddress = data.routes[0].legs[0].end_address;
      }
    });

    const response: Record<string, unknown> = {
      driving:  modeResults.driving  ?? null,
      transit:  modeResults.transit  ?? null,
      walking:  modeResults.walking  ?? null,
      cycling:  modeResults.cycling  ?? null,
      resolvedOriginAddress,
      resolvedDestinationAddress,
    };
    if (rateLimitHit) {
      response.error = 'Google Maps quota exceeded. Check your API key billing settings at console.cloud.google.com.';
    }
    return res.json(response);
  } catch (err) {
    console.error('Directions API error:', err);
    return res.status(500).json({ error: 'Failed to fetch directions.' });
  }
});

function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default router;
