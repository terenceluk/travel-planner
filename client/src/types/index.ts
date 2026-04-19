export interface Destination {
  id: string;
  label: string;
  address: string;
  arrivalTime: string; // HH:MM
  dwellMinutes?: number; // planned time to spend at this stop
}

export type TransportMode = 'driving' | 'transit' | 'walking' | 'cycling';

export interface TravelLeg {
  durationSeconds: number;
  durationText: string;
  distanceText?: string;
  departureTime: number; // Unix timestamp
  departureTimeText: string;
  durationWithoutTrafficSeconds?: number;
  trafficDelaySeconds?: number;
}

export interface TransitStep {
  line: string;
  vehicle: string;
  departure: string;
  arrival: string;
}

export interface TransitLeg extends TravelLeg {
  steps: TransitStep[];
}

export interface TravelResult {
  driving: TravelLeg | null;
  transit: TransitLeg | null;
  walking?: TravelLeg | null;
  cycling?: TravelLeg | null;
  error?: string;
  resolvedOriginAddress?: string;
  resolvedDestinationAddress?: string;
}

export interface DestinationWithResult extends Destination {
  originAddress: string;
  originLabel: string;
  parkingBufferMinutes: number;
  arrivalTimestamp?: number;
  result?: TravelResult;
  loading?: boolean;
  impossibilityWarning?: string;
}
