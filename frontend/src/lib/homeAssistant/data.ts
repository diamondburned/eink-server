// Home Assistant data mappings and constants
import {
  mdiWeatherCloudy,
  mdiWeatherFog,
  mdiWeatherHail,
  mdiWeatherLightning,
  mdiWeatherLightningRainy,
  mdiWeatherNight,
  mdiWeatherPartlyCloudy,
  mdiWeatherPouring,
  mdiWeatherRainy,
  mdiWeatherSnowy,
  mdiWeatherSnowyRainy,
  mdiWeatherSunny,
  mdiWeatherSunnyAlert,
  mdiWeatherWindy,
  mdiWeatherWindyVariant,
} from "@mdi/js";

// Maps Home Assistant weather states to user-friendly display strings.
// Reference: https://developers.home-assistant.io/docs/core/entity/weather/
export const weatherConditions: Record<string, string> = {
  cloudy: "Cloudy",
  exceptional: "Exceptional",
  fog: "Fog",
  hail: "Hail",
  lightning: "Lightning",
  partlycloudy: "Partly Cloudy",
  pouring: "Pouring",
  rainy: "Rainy",
  snowy: "Snowy",
  sunny: "Sunny",
  windy: "Windy",
  "clear-night": "Clear Night",
  "lightning-rainy": "Lightning + Rain",
  "snowy-rainy": "Snowy + Rainy",
  "windy-variant": "Windy + Cloudy",
};

// Maps Home Assistant weather states to MDI weather icon paths.
// Reference: https://developers.home-assistant.io/docs/core/entity/weather/
export const weatherIcons: Record<string, string> = {
  cloudy: mdiWeatherCloudy,
  exceptional: mdiWeatherSunnyAlert,
  fog: mdiWeatherFog,
  hail: mdiWeatherHail,
  lightning: mdiWeatherLightning,
  partlycloudy: mdiWeatherPartlyCloudy,
  pouring: mdiWeatherPouring,
  rainy: mdiWeatherRainy,
  snowy: mdiWeatherSnowy,
  sunny: mdiWeatherSunny,
  windy: mdiWeatherWindy,
  "clear-night": mdiWeatherNight,
  "lightning-rainy": mdiWeatherLightningRainy,
  "snowy-rainy": mdiWeatherSnowyRainy,
  "windy-variant": mdiWeatherWindyVariant,
};

// Formats a Home Assistant weather condition state to a display string.
// Falls back to the raw state if unknown.
export function formatWeatherCondition(condition: string): string {
  return weatherConditions[condition] || condition;
}

// Gets the MDI weather icon path for a Home Assistant weather condition.
// Falls back to sunny icon if unknown.
export function getWeatherIconSVG(condition: string): string {
  return weatherIcons[condition] || mdiWeatherSunny;
}
