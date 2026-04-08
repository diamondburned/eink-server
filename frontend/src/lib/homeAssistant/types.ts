// Home Assistant REST API Models
// https://developers.home-assistant.io/docs/api/rest/

export interface EntityState<T = Record<string, unknown>> {
  entity_id: string;
  state: string;
  last_changed: string;
  last_updated: string;
  attributes: T;
}

export type CalendarEvent = {
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  description?: string;
  location?: string;
};

export type WeatherAttributes = Partial<{
  temperature: number;
  temperature_unit: string;
  dew_point: number;
  humidity: number;
  cloud_coverage: number;
  uv_index: number;
  pressure: number;
  pressure_unit: string;
  wind_bearing: number;
  wind_speed: number;
  wind_speed_unit: string;
  visibility_unit: string;
  precipitation: number;
  precipitation_unit: string;
  precipitation_probability: number;
  attribution: string;
  friendly_name: string;
  supported_features: number;
  [key: string]: unknown; // Allow other attributes
}>;

// Weather forecast types
export interface WeatherForecast {
  datetime: string;
  is_daytime?: boolean; // Only set for twice_daily forecasts
  apparent_temperature?: number;
  cloud_coverage?: number;
  condition?: string;
  dew_point?: number;
  humidity?: number;
  precipitation_probability?: number;
  precipitation?: number;
  pressure?: number;
  temperature?: number;
  templow?: number;
  uv_index?: number;
  wind_bearing?: number | string; // Can be degrees (number) or cardinal direction (string)
  wind_gust_speed?: number;
  wind_speed?: number;
}

export type WeatherForecastType = "daily" | "twice_daily" | "hourly";

// Response from weather.get_forecasts service
export type WeatherForecastResponse = Record<string, { forecast: WeatherForecast[] }>;

// Service call response types
export interface ServiceCallResponse<T = unknown> {
  changed_states: EntityState[];
  service_response?: T;
}

// Basic service call response (without return_response)
export type ServiceCallStates = EntityState[];
