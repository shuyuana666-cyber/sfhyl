export interface LegacyVehicleDefault {
  legacyId: string;
  brand: string;
  titleZh: string;
  titleEn: string;
  titleRu: string;
  filename: string;
  price: number;
  priceNote: string;
  year: number;
  mileage: number;
}

export const legacyVehicleDefaults: LegacyVehicleDefault[] = [
  { legacyId: "c206-260706-0108", brand: "HAVAL", titleZh: "Haval H6 2023 国潮版 1.5T 自动都市版", titleEn: "Haval H6 2023 Guochao 1.5T automatic city edition", titleRu: "Haval H6 2023, версия Guochao, 1.5T автомат, городская версия", filename: "car-01.jpg", price: 99300, priceNote: "1,123,013 RUB", year: 2023, mileage: 19000 },
  { legacyId: "c206-260704-0107", brand: "TOYOTA", titleZh: "Toyota Corolla 2022 CVT 1.2T 先锋 PLUS", titleEn: "Toyota Corolla 2022 CVT 1.2T Pioneer PLUS", titleRu: "Toyota Corolla 2022 CVT 1.2T Pioneer PLUS", filename: "car-02.jpg", price: 94500, priceNote: "1,068,729 RUB", year: 2022, mileage: 11000 },
  { legacyId: "c206-260703-0106", brand: "MAZDA", titleZh: "Mazda CX-5 2022 2.0L 自动前驱智尚版", titleEn: "Mazda CX-5 2022 2.0L automatic FWD Zhi Shang", titleRu: "Mazda CX-5 2022, 2.0L, автомат, передний привод, версия Zhi Shang", filename: "car-03.jpg", price: 139800, priceNote: "1,581,040 RUB", year: 2022, mileage: 40000 },
  { legacyId: "c206-260703-0105", brand: "BMW", titleZh: "BMW X1 2023 sDrive20Li X 设计套装", titleEn: "BMW X1 2023 sDrive20Li X design package", titleRu: "BMW X1 2023 sDrive20Li X, дизайн-пакет", filename: "car-04.jpg", price: 234500, priceNote: "2,652,031 RUB", year: 2023, mileage: 29500 },
  { legacyId: "c206-260703-0104", brand: "AUDI", titleZh: "Audi A3 2022 A3L Limousine 35 TFSI 时尚运动版", titleEn: "Audi A3 2022 A3L Limousine 35 TFSI sport edition", titleRu: "Audi A3 2022 A3L Limousine 35 TFSI, спортивная версия", filename: "car-05.jpg", price: 138800, priceNote: "1,569,731 RUB", year: 2022, mileage: 26297 },
  { legacyId: "c206-260703-0103", brand: "JETOUR", titleZh: "Jetour X70 PLUS", titleEn: "Jetour X70 PLUS", titleRu: "Jetour X70 PLUS", filename: "car-06.jpg", price: 92300, priceNote: "1,043,848 RUB", year: 2022, mileage: 44000 },
  { legacyId: "c207-260703-0043", brand: "JETOUR", titleZh: "Jetour X70 PLUS 2022 1.5T CVT 七座版", titleEn: "Jetour X70 PLUS 2022 1.5T CVT seven-seat edition", titleRu: "Jetour X70 PLUS 2022, 1.5T CVT, 7 мест", filename: "car-07.jpg", price: 99500, priceNote: "1,125,275 RUB", year: 2022, mileage: 47000 },
  { legacyId: "c207-260703-0042", brand: "JETOUR", titleZh: "Jetour X70 2023 1.5T DCT Brave PLUS 七座版", titleEn: "Jetour X70 2023 1.5T DCT Brave PLUS seven-seat edition", titleRu: "Jetour X70 2023, 1.5T DCT, Brave PLUS, 7 мест", filename: "car-08.jpg", price: 111500, priceNote: "1,260,987 RUB", year: 2023, mileage: 38760 },
  { legacyId: "c207-260703-0041", brand: "BMW", titleZh: "BMW X1 sDrive20Li X 设计版", titleEn: "BMW X1 sDrive20Li X design edition", titleRu: "BMW X1 sDrive20Li X, дизайн-версия", filename: "car-09.jpg", price: 226500, priceNote: "2,561,556 RUB", year: 2023, mileage: 30155 },
  { legacyId: "c207-260703-0040", brand: "AUDI", titleZh: "Audi A3L 2023 时尚动感版", titleEn: "Audi A3L 2023 stylish dynamic edition", titleRu: "Audi A3L 2023, стильная динамичная версия", filename: "car-10.jpg", price: 161500, priceNote: "1,826,452 RUB", year: 2023, mileage: 40000 },
  { legacyId: "c207-260703-0039", brand: "JETOUR", titleZh: "JETOUR X70 PLUS Brave 2023 七座版", titleEn: "JETOUR X70 PLUS Brave 2023 seven-seat edition", titleRu: "JETOUR X70 PLUS Brave 2023, 7 мест", filename: "car-11.jpg", price: 94500, priceNote: "1,068,729 RUB", year: 2023, mileage: 62000 },
  { legacyId: "c207-260701-0038", brand: "VOLKSWAGEN", titleZh: "Volkswagen Golf 2021 280TSI R-Line", titleEn: "Volkswagen Golf 2021 280TSI R-Line", titleRu: "Volkswagen Golf 2021 280TSI R-Line", filename: "car-12.jpg", price: 142300, priceNote: "1,609,313 RUB", year: 2021, mileage: 21500 },
  { legacyId: "c207-260701-0037", brand: "BMW", titleZh: "BMW X1 2023 sDrive20Li X 设计套装", titleEn: "BMW X1 2023 sDrive20Li X design package", titleRu: "BMW X1 2023 sDrive20Li X, дизайн-пакет", filename: "car-13.jpg", price: 242300, priceNote: "2,740,243 RUB", year: 2023, mileage: 685378 },
  { legacyId: "c207-260630-0035", brand: "AUDI", titleZh: "Audi Q3 2022 时尚动感版", titleEn: "Audi Q3 2022 stylish dynamic edition", titleRu: "Audi Q3 2022, стильная динамичная версия", filename: "car-14.jpg", price: 190000, priceNote: "2,148,767 RUB", year: 2022, mileage: 48000 },
  { legacyId: "c207-260630-0036", brand: "AUDI", titleZh: "Audi A3L 35TFSI 2022 时尚运动版", titleEn: "Audi A3L 35TFSI 2022 sport edition", titleRu: "Audi A3L 35TFSI 2022, спортивная версия", filename: "car-15.jpg", price: 169500, priceNote: "1,916,926 RUB", year: 2022, mileage: 32000 },
  { legacyId: "c207-260627-0034", brand: "MAZDA", titleZh: "Mazda CX-4 2021 2.0L 自动前驱蓝天活力版", titleEn: "Mazda CX-4 2021 2.0L automatic FWD Blue Sky Vitality", titleRu: "Mazda CX-4 2021, 2.0L, автомат, передний привод, Blue Sky Vitality", filename: "car-16.jpg", price: 125300, priceNote: "1,417,055 RUB", year: 2021, mileage: 13000 },
];
