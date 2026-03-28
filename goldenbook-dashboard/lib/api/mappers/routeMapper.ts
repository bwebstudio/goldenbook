// Mappers: admin route DTOs → UI types used by dashboard components.

import { getStorageUrl } from "@/lib/utils/storage";
import type { AdminRouteResponseDTO, AdminRoutePlaceDTO } from "@/types/api/route";
import type { UIRoute, UIRouteStop, UIRouteDetail, RouteStatus } from "@/types/ui/route";

function toStatus(s: string): RouteStatus {
  if (s === "published" || s === "archived" || s === "draft") return s;
  return "draft";
}

export function mapRouteToUI(dto: AdminRouteResponseDTO): UIRoute {
  return {
    id:               dto.id,
    slug:             dto.slug,
    title:            dto.title,
    summary:          dto.summary,
    routeType:        dto.routeType,
    estimatedMinutes: dto.estimatedMinutes,
    featured:         dto.featured,
    status:           toStatus(dto.status),
    city:             dto.cityName,
    citySlug:         dto.citySlug,
    stopsCount:       dto.placesCount,
    coverImage:       getStorageUrl(dto.heroImage.bucket, dto.heroImage.path),
  };
}

export function mapRoutesToUI(dtos: AdminRouteResponseDTO[]): UIRoute[] {
  return dtos.map(mapRouteToUI);
}

export function mapRouteStopToUI(dto: AdminRoutePlaceDTO): UIRouteStop {
  return {
    id:          dto.id,
    slug:        dto.slug,
    name:        dto.name,
    note:        dto.note ?? "",
    stayMinutes: dto.stayMinutes,
    sortOrder:   dto.sortOrder,
    image:       getStorageUrl(dto.heroImage.bucket, dto.heroImage.path),
    city:        dto.city,
  };
}

export function mapRouteDetailToUI(
  dto: AdminRouteResponseDTO,
  placeDTOs: AdminRoutePlaceDTO[],
): UIRouteDetail {
  return {
    ...mapRouteToUI(dto),
    body:  dto.body,
    stops: placeDTOs.map(mapRouteStopToUI),
  };
}