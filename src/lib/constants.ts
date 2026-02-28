export interface MapViewState {
  latitude: number;
  longitude: number;
  zoom: number;
  bearing?: number;
}

export const DEFAULT_VIEW: MapViewState = {
  latitude: 52.3676,
  longitude: 4.9041,
  zoom: 13,
  bearing: 0,
};

export type Category =
  | "all"
  | "monument"
  | "nature"
  | "building"
  | "art"
  | "history"
  | "religion"
  | "water";

export const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: "all", label: "Alles", icon: "🗺️" },
  { value: "monument", label: "Monumenten", icon: "🏛️" },
  { value: "nature", label: "Natuur", icon: "🌿" },
  { value: "building", label: "Gebouwen", icon: "🏗️" },
  { value: "art", label: "Kunst", icon: "🎨" },
  { value: "history", label: "Geschiedenis", icon: "📜" },
  { value: "religion", label: "Religie", icon: "⛪" },
  { value: "water", label: "Water", icon: "💧" },
];
