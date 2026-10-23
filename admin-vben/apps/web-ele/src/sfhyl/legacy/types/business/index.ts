export interface MediaAsset {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
  webpUrl?: string | null;
  originalName?: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: string;
  width?: number | null;
  height?: number | null;
  extension?: string | null;
  objectKey?: string;
  driver?: string;
  altZh?: string | null;
  altEn?: string | null;
  folderId?: string | null;
  createdAt: string;
  deletedAt?: string | null;
  _count?: Record<string, number>;
}

export interface MediaUploadRecord {
  id: string;
  originalName: string;
  mimeType?: string | null;
  sizeBytes: string;
  status: "PROCESSING" | "SUCCEEDED" | "FAILED";
  errorMessage?: string | null;
  durationMs?: number | null;
  createdAt: string;
  completedAt?: string | null;
  mediaAsset?: Pick<MediaAsset, "id" | "url" | "thumbnailUrl"> | null;
  createdBy?: {
    id: string;
    username: string;
    displayName?: string | null;
  } | null;
}

export interface Brand {
  id: string;
  nameZh: string;
  nameEn: string;
  nameRu?: string | null;
  slug: string;
  isEnabled: boolean;
  logoMedia?: MediaAsset | null;
  country?: string | null;
  sortOrder?: number;
  _count?: Record<string, number>;
}

export interface VehicleSeries {
  id: string;
  brandId: string;
  nameZh: string;
  nameEn: string;
  slug: string;
  isEnabled: boolean;
  brand?: Brand;
  sortOrder?: number;
  _count?: Record<string, number>;
}

export interface VehicleModel {
  id: string;
  brandId: string;
  seriesId: string;
  nameZh: string;
  nameEn: string;
  slug: string;
  year?: number | null;
  isEnabled: boolean;
  brand?: Brand;
  series?: VehicleSeries;
  sortOrder?: number;
  _count?: Record<string, number>;
}

export interface VehicleTag {
  id: string;
  nameZh: string;
  nameEn: string;
  slug: string;
  color?: string | null;
  isEnabled: boolean;
  _count?: Record<string, number>;
}

export interface VehicleCategory {
  id: string;
  nameZh: string;
  nameEn: string;
  nameRu?: string | null;
  slug: string;
  descriptionZh?: string | null;
  descriptionEn?: string | null;
  sortOrder: number;
  isEnabled: boolean;
  _count?: { vehicles: number };
}

export interface VehicleMediaRelation {
  mediaId: string;
  type: "COVER" | "GALLERY" | "EXTERIOR" | "INTERIOR" | "DETAIL" | "VIDEO";
  altZh?: string | null;
  altEn?: string | null;
  sortOrder: number;
  isCover: boolean;
  media: MediaAsset;
}

export interface Vehicle {
  id: string;
  stockNo: string;
  vin?: string | null;
  nameZh: string;
  nameEn: string;
  slug: string;
  type: "NEW" | "USED";
  year: number;
  price: string;
  currency: string;
  status: "DRAFT" | "PUBLISHED" | "OFFLINE" | "ARCHIVED";
  saleStatus: "AVAILABLE" | "RESERVED" | "SOLD";
  isFeatured: boolean;
  brand: Brand;
  brandId: string;
  seriesId?: string | null;
  modelId?: string | null;
  categoryId?: string | null;
  series?: VehicleSeries | null;
  model?: VehicleModel | null;
  categoryRef?: VehicleCategory | null;
  coverMedia?: MediaAsset | null;
  coverMediaId?: string | null;
  tags?: Array<{ tagId: string; tag: VehicleTag }>;
  media?: VehicleMediaRelation[];
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
