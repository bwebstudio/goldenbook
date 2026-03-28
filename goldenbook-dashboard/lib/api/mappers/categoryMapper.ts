import type { AdminCategoryDTO } from "@/types/api/category";
import type { UICategory, UISubcategory } from "@/types/ui/category";

export function mapCategoryToUI(dto: AdminCategoryDTO): UICategory {
  const subcategories: UISubcategory[] = dto.subcategories.map((s) => ({
    id:          s.id,
    slug:        s.slug,
    name:        s.name,
    description: s.description,
    parentId:    dto.id,
    parentName:  dto.name,
    sortOrder:   s.sortOrder,
    isActive:    s.isActive,
  }));

  return {
    id:               dto.id,
    slug:             dto.slug,
    name:             dto.name,
    description:      dto.description,
    iconName:         dto.iconName,
    sortOrder:        dto.sortOrder,
    isActive:         dto.isActive,
    subcategoryCount: subcategories.length,
    subcategories,
  };
}

export function mapCategoriesToUI(dtos: AdminCategoryDTO[]): UICategory[] {
  return dtos.map(mapCategoryToUI);
}