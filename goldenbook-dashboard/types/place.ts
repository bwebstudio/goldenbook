export type PlaceStatus = "draft" | "published" | "featured";

export interface Place {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  country: string;
  city: string;
  address: string;
  googleMapsLink: string;
  category: string;
  subcategory: string;
  status: PlaceStatus;
  website: string;
  phone: string;
  email: string;
  instagram: string;
  mainImage: string;
  gallery: string[];
  featured: boolean;
  editorsPick: boolean;
}
