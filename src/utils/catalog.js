export const brandOptions = [
  'select',
  'all',
];

export const priceRanges = [
  { key: 'all', labels: { ru: 'Все цены', zh: '全部价格', en: 'All prices' }, min: 0, max: Infinity },
  { key: 'under10', labels: { ru: 'до 10', zh: '10万以内', en: 'Under 100k' }, min: 0, max: 100000 },
  { key: '10to15', labels: { ru: '10 - 15', zh: '10 - 15万', en: '100k - 150k' }, min: 100000, max: 150000 },
  { key: '15to20', labels: { ru: '15 - 20', zh: '15 - 20万', en: '150k - 200k' }, min: 150000, max: 200000 },
  { key: 'over20', labels: { ru: 'свыше 20', zh: '20万以上', en: 'Over 200k' }, min: 200000, max: Infinity },
];

export function yearRangesForVehicles(vehicles = []) {
  const years = [...new Set(vehicles.map((vehicle) => Number(vehicle.year)).filter((year) => Number.isInteger(year) && year > 0))]
    .sort((left, right) => right - left);
  return [
    { key: 'all', labels: { ru: 'Все годы', zh: '全部年份', en: 'All years' }, min: 0, max: Infinity },
    ...years.map((year) => ({ key: String(year), labels: { ru: String(year), zh: String(year), en: String(year) }, min: year, max: year })),
  ];
}

export const mileageRanges = [
  { key: 'all', labels: { ru: 'Любой пробег', zh: '全部里程', en: 'Any mileage' }, min: 0, max: Infinity },
  { key: 'under20k', labels: { ru: 'до 20,000km', zh: '2万公里以内', en: 'Under 20,000km' }, min: 0, max: 20000 },
  { key: '20to50k', labels: { ru: '20,000 - 50,000km', zh: '2万-5万公里', en: '20,000 - 50,000km' }, min: 20000, max: 50000 },
  { key: 'over50k', labels: { ru: 'свыше 50,000km', zh: '5万公里以上', en: 'Over 50,000km' }, min: 50000, max: Infinity },
];
