import { apiGet } from "./client";
import type { DestinationsResponseDTO, DestinationDTO } from "@/types/api/destination";

// GET /api/v1/destinations?locale=en
// Returns the list of active cities in the app.
export async function fetchDestinations(locale = "en"): Promise<DestinationDTO[]> {
  const data = await apiGet<DestinationsResponseDTO>("/api/v1/destinations", { locale });
  return data.items;
}
