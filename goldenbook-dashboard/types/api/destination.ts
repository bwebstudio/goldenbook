// Raw backend response types for destinations (cities).
// Response from GET /api/v1/destinations?locale=en

export interface MediaAssetDTO {
  bucket: string | null;
  path: string | null;
}

export interface DestinationDTO {
  slug: string;
  name: string;
  heroImage: MediaAssetDTO;
}

export interface DestinationsResponseDTO {
  items: DestinationDTO[];
}
