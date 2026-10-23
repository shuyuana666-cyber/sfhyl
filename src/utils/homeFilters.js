import { brandOptions, mileageRanges, priceRanges, yearRangesForVehicles } from './catalog.js';
import { translations } from '../i18n/language.js';

export function slugifyModel(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff\u4e00-\u9fa5]+/gi, '_')
    .replace(/^_+|_+$/g, '');
}

export function vehicleModelLabel(vehicle) {
  return vehicle.model || vehicle.title.split(' ').slice(0, 2).join(' ');
}

export function normalizeBrandParam(value, vehiclesData = [], brands = []) {
  if (!value) return 'select';
  const options = [
    ...new Set([
      ...brandOptions,
      ...vehiclesData.map((vehicle) => vehicle.brand).filter(Boolean),
      ...brands.map((brand) => brand.nameEn).filter(Boolean),
    ]),
  ];
  const match = options.find(
    (brand) => brand.toLowerCase() === String(value).toLowerCase(),
  );
  return match || 'select';
}

export function modelOptionsForVehicles(vehiclesData, brand, t) {
  const filtered = vehiclesData
    .filter(
      (vehicle) =>
        brand === 'select' || brand === 'all' || vehicle.brand === brand,
    )
    .map((vehicle) => {
      const label = vehicleModelLabel(vehicle);
      return { value: slugifyModel(label), label };
    });

  const unique = new Map();
  filtered.forEach((option) => {
    if (option.value && !unique.has(option.value)) {
      unique.set(option.value, option);
    }
  });

  return [
    { value: 'select', label: t.selectModel },
    ...Array.from(unique.values()).slice(0, 8),
  ];
}

export function normalizeModelParam(value, vehiclesData, brand) {
  if (!value) return 'select';
  const normalized = slugifyModel(value);
  const options = modelOptionsForVehicles(vehiclesData, brand, translations.en);
  return options.some((option) => option.value === normalized)
    ? normalized
    : 'select';
}

export function filtersFromUrl(vehiclesData, brands = []) {
  const params = new URLSearchParams(window.location.search);
  const brand = normalizeBrandParam(params.get('brand'), vehiclesData, brands);
  const yearRanges = yearRangesForVehicles(vehiclesData);
  return {
    brand,
    model: normalizeModelParam(params.get('model'), vehiclesData, brand),
    price: priceRanges.some((range) => range.key === params.get('price'))
      ? params.get('price')
      : 'all',
    year: yearRanges.some((range) => range.key === params.get('year'))
      ? params.get('year')
      : 'all',
    mileage: mileageRanges.some((range) => range.key === params.get('mileage'))
      ? params.get('mileage')
      : 'all',
    query: params.get('query') || '',
  };
}
