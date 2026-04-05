import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;

  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function calculateDistance(start: any, destinations: any[]) {
  if (!start || destinations.length === 0) return 0;

  let total = 0;
  let current = start;

  for (let dest of destinations) {
    if (!dest.lat || !dest.lon) continue;

    const dist = getDistance(
      current.lat,
      current.lon,
      dest.lat,
      dest.lon
    );

    total += dist;
    current = dest;
  }

  return Math.round(total);
}

// Keep wrapper for backwards compatibility with booking page
export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  if (
    lat1 === null || lon1 === null || lat2 === null || lon2 === null ||
    isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)
  ) {
    return null;
  }
  if (lat1 === lat2 && lon1 === lon2) return 0;
  return Math.round(getDistance(lat1, lon1, lat2, lon2));
}
