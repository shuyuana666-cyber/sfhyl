export interface HomepageVehicle {
  id: string | number | bigint;
  databaseId?: string;
  isFeatured?: boolean;
  isHomepage?: boolean;
}

export interface RecommendationSection<T extends HomepageVehicle> {
  id?: string | number | bigint;
  type?: string;
  isEnabled?: boolean;
  displayCount?: number | null;
  _count?: { recommendations?: number };
  recommendations?: Array<{
    vehicleId?: string | number | bigint;
    vehicle?: T | null;
    isEnabled?: boolean;
    startsAt?: string | Date | null;
    endsAt?: string | Date | null;
    sortOrder?: number;
  }>;
}

export function selectHomepageVehicles<T extends HomepageVehicle>(
  sections: RecommendationSection<T>[],
  vehicles: T[],
  now = Date.now(),
) {
  const section = sections.find(item => item.type === 'FEATURED_VEHICLES');
  const count = Math.max(0, section?.displayCount ?? 4);
  if (section?.isEnabled === false) return { vehicles: [] as T[], source: 'configured' as const, enabled: false };
  const recommendations = section?.recommendations ?? [];
  if (recommendations.length || section?._count?.recommendations) {
    const unique = new Map<string, T>();
    for (const item of [...recommendations].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
      if (item.isEnabled === false || (item.startsAt && new Date(item.startsAt).getTime() > now)
        || (item.endsAt && new Date(item.endsAt).getTime() <= now)) continue;
      const vehicle = item.vehicle ?? vehicles.find(candidate => String(candidate.databaseId ?? candidate.id) === String(item.vehicleId));
      if (vehicle) unique.set(String(vehicle.databaseId ?? vehicle.id), vehicle);
    }
    return { vehicles: [...unique.values()].slice(0, count), source: 'configured' as const, enabled: true };
  }
  const featured = vehicles.filter(item => item.isFeatured || item.isHomepage);
  return { vehicles: (featured.length ? featured : vehicles).slice(0, count),
    source: featured.length ? 'featured' as const : 'automatic' as const, enabled: true };
}
