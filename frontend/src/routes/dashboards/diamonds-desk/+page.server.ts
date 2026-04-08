import type { PageServerLoad } from "./$types";
import { loadDashboardConfig } from "$lib/dashboardConfig";
import { parseCalendarEvents } from "$lib/calendar";
import {
  HomeAssistantClient,
  currentTimeISO,
  type WeatherAttributes,
  type WeatherForecastResponse,
} from "$lib/homeAssistant";
import configRaw from "./config.json";

const HOUR = 60 * 60;

export type Config = {
  width: number;
  height: number;
  password: string | null;
  homeAssistant: {
    endpoint: string;
    token: string;
    weather: string; // weather entity ID
    calendars: string[]; // list of calendar entity IDs to fetch
  };
  timeline: {
    startHours: number; // hours before now to start timeline (negative value)
    endHours: number; // hours after now to end timeline
    pixelsPerHour: number; // height in pixels for each hour in the timeline
  };
  showMinutes: boolean | "quarterly";
  show24HourTime: boolean;
};

export const load: PageServerLoad = async (ev) => {
  const now = new Date();
  const config = await loadDashboardConfig<Config>(ev, configRaw);

  // Initialize Home Assistant client
  const haClient = new HomeAssistantClient(
    config.homeAssistant.endpoint,
    config.homeAssistant.token,
  );

  const haEntities = await haClient.entities();
  const haCalendarNames = Object.fromEntries(
    haEntities
      .filter((e) => config.homeAssistant.calendars.includes(e.entity_id))
      .map((e) => [e.entity_id, e.attributes.friendly_name] as const),
  );

  const startTime = currentTimeISO(config.timeline.startHours * HOUR);
  const endTime = currentTimeISO(config.timeline.endHours * HOUR);

  // Fetch calendar events from Home Assistant:
  const haCalendars = await Promise.all(
    config.homeAssistant.calendars.map(async (calendarID) => ({
      calendarID,
      events: await haClient.calendarEvents(calendarID, startTime, endTime),
    })),
  );

  // Parse HA events into our format
  const allEvents = haCalendars
    .map((calendar) =>
      parseCalendarEvents(calendar.events, {
        placeholderSummary: `busy - ${haCalendarNames[calendar.calendarID] || calendar.calendarID}`,
      }),
    )
    .flat();

  const weatherState = await haClient.entityStates<WeatherAttributes>(config.homeAssistant.weather);

  const weatherForecastHourlyResponse = await haClient.callService<WeatherForecastResponse>(
    "weather",
    "get_forecasts",
    {
      entity_id: config.homeAssistant.weather,
      type: "hourly",
    },
    { returnResponse: true },
  );
  const weatherForecastHourly =
    weatherForecastHourlyResponse.service_response?.[config.homeAssistant.weather]?.forecast ?? [];

  const weatherForecastDailyResponse = await haClient.callService<WeatherForecastResponse>(
    "weather",
    "get_forecasts",
    {
      entity_id: config.homeAssistant.weather,
      type: "daily",
    },
    { returnResponse: true },
  );
  const weatherForecastDaily =
    weatherForecastDailyResponse.service_response?.[config.homeAssistant.weather]?.forecast ?? [];

  return {
    now: now.toISOString(),
    config,
    weather: {
      condition: weatherState.state, // The state is the condition (e.g., "sunny", "cloudy")
      temperature: weatherState.attributes.temperature,
      temperatureUnit: weatherState.attributes.temperature_unit,
      humidity: weatherState.attributes.humidity,
      windSpeed: weatherState.attributes.wind_speed,
      windSpeedUnit: weatherState.attributes.wind_speed_unit,
      precipitation: weatherState.attributes.precipitation ?? 0,
      precipitationUnit: weatherState.attributes.precipitation_unit,
      forecastHourly: weatherForecastHourly,
      forecastDaily: weatherForecastDaily,
    },
    events: allEvents,
  };
};
