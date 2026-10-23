import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./client";
import type { MediaAsset, Vehicle } from "@/types/business";

export interface HomepageRecord {
  id: string;
  key?: string;
  type?: string;
  status?: string;
  titleZh?: string | null;
  titleEn?: string | null;
  titleRu?: string | null;
  subtitleZh?: string | null;
  subtitleEn?: string | null;
  descriptionZh?: string | null;
  descriptionEn?: string | null;
  descriptionRu?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  sortOrder?: number;
  isEnabled?: boolean;
  styleKey?: string | null;
  displayCount?: number | null;
  config?: Record<string, unknown> | null;
  iconName?: string | null;
  iconType?: string;
  iconColor?: string | null;
  desktopMediaId?: string | null;
  mobileMediaId?: string | null;
  imageMediaId?: string | null;
  backgroundMediaId?: string | null;
  desktopMedia?: MediaAsset | null;
  mobileMedia?: MediaAsset | null;
  imageMedia?: MediaAsset | null;
  backgroundMedia?: MediaAsset | null;
  homepageSectionId?: string;
  vehicleId?: string;
  vehicle?: Vehicle | null;
  label?: string | null;
}
export const getBanners = () => apiGet<HomepageRecord[]>("/admin/banners");
export const createBanner = (data: object) =>
  apiPost<HomepageRecord>("/admin/banners", data);
export const updateBanner = (id: string, data: object) =>
  apiPatch<HomepageRecord>(`/admin/banners/${id}`, data);
export const deleteBanner = (id: string) => apiDelete(`/admin/banners/${id}`);
export const sortBanners = (items: Array<{ id: string; sortOrder: number }>) =>
  apiPut("/admin/banners/sort", { items });

export const getFeatures = () => apiGet<HomepageRecord[]>("/admin/features");
export const createFeature = (data: object) =>
  apiPost<HomepageRecord>("/admin/features", data);
export const updateFeature = (id: string, data: object) =>
  apiPatch<HomepageRecord>(`/admin/features/${id}`, data);
export const deleteFeature = (id: string) => apiDelete(`/admin/features/${id}`);
export const sortFeatures = (items: Array<{ id: string; sortOrder: number }>) =>
  apiPut("/admin/features/sort", { items });

export const getSections = () =>
  apiGet<HomepageRecord[]>("/admin/homepage-sections");
export const updateSection = (id: string, data: object) =>
  apiPatch<HomepageRecord>(`/admin/homepage-sections/${id}`, data);
export const sortSections = (items: Array<{ id: string; sortOrder: number }>) =>
  apiPut("/admin/homepage-sections/sort", { items });

export const getRecommendations = (params?: object) =>
  apiGet<HomepageRecord[]>("/admin/recommendations", params);
export const getHomepagePreview = async () => {
  const [home, vehicles] = await Promise.all([
    apiGet<{
      sections: Array<
        HomepageRecord & {
          recommendations?: HomepageRecord[];
          _count?: { recommendations: number };
        }
      >;
    }>("/public/home"),
    apiGet<{ items: Vehicle[] }>("/public/vehicles", {
      page: 1,
      pageSize: 100,
      sortBy: "sortOrder",
      sortOrder: "asc"
    })
  ]);
  return { sections: home.sections, vehicles: vehicles.items };
};
export const createRecommendation = (data: object) =>
  apiPost<HomepageRecord>("/admin/recommendations", data);
export const updateRecommendation = (id: string, data: object) =>
  apiPatch<HomepageRecord>(`/admin/recommendations/${id}`, data);
export const deleteRecommendation = (id: string) =>
  apiDelete(`/admin/recommendations/${id}`);
export const sortRecommendations = (
  items: Array<{ id: string; sortOrder: number }>
) => apiPut("/admin/recommendations/sort", { items });
