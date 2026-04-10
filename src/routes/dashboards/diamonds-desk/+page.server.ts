import type { PageServerLoad } from "./$types";
import { loadDashboardConfig } from "$lib/config";
import { parseCalendarEvents } from "$lib/calendar";
import {
  HomeAssistantClient,
  currentTimeISO,
  type WeatherAttributes,
  type WeatherForecast,
  type WeatherForecastResponse,
} from "$lib/homeAssistant";
import type { BaseDashboardConfig } from "$lib/config";
import * as e2clicker from "./lib/e2clicker";
import configRaw from "./config.json";
import { error } from "@sveltejs/kit";

const HOUR = 60 * 60;

export type Config = BaseDashboardConfig & {
  homeAssistant: {
    endpoint: string;
    token: string;
    weather: string; // weather entity ID
    calendars: string[]; // list of calendar entity IDs to fetch
    selfBatteryEntity?: string; // optional entity ID for the device running this dashboard, to show battery status
  };
  timeline: {
    startHours: number; // hours before now to start timeline (negative value)
    endHours: number; // hours after now to end timeline
    pixelsPerHour: number; // height in pixels for each hour in the timeline
  };
  showMinutes: boolean | "quarterly";
  show24HourTime: boolean;
  e2clicker?: {
    token: string;
  };
};

export type LoadedData = {
  now: string; // current time in ISO format
  config: Config;
  weather?: WeatherAttributes & {
    condition: string;
    forecastHourly?: WeatherForecast[];
    forecastDaily?: WeatherForecast[];
  };
  events?: ReturnType<typeof parseCalendarEvents>;
  batteryLevel?: number;
  estrogenInfo?: e2clicker.NextDoseInfo;
};

export const load: PageServerLoad = async (ev) => {
  const now = new Date();
  const config = await loadDashboardConfig<Config>(ev, configRaw);

  const data: LoadedData = {
    now: now.toISOString(),
    config,
  };

  // Initialize Home Assistant client
  const haClient = new HomeAssistantClient(
    config.homeAssistant.endpoint,
    config.homeAssistant.token,
  );

  const haEntities = await haClient
    .entities()
    .catch((err) => error(500, "Cannot fetch entities from Home Assistant: " + err.message));

  if (config.homeAssistant.calendars) {
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
    data.events = haCalendars
      .map((calendar) =>
        parseCalendarEvents(calendar.events, {
          placeholderSummary: `busy - ${haCalendarNames[calendar.calendarID] || calendar.calendarID}`,
        }),
      )
      .flat();
  }

  if (config.homeAssistant.weather) {
    const weatherState = haEntities.find((e) => e.entity_id === config.homeAssistant.weather);
    if (!weatherState) {
      error(500, `Weather entity ${config.homeAssistant.weather} not found in Home Assistant`);
    }

    data.weather = {
      condition: weatherState.state,
      ...weatherState.attributes,
    };

    await Promise.all([
      haClient
        .callServiceWithResponse<WeatherForecastResponse>("weather", "get_forecasts", {
          entity_id: config.homeAssistant.weather,
          type: "hourly",
        })
        .then((r) => {
          data.weather!.forecastHourly =
            r.service_response?.[config.homeAssistant.weather]?.forecast;
        }),
      haClient
        .callServiceWithResponse<WeatherForecastResponse>("weather", "get_forecasts", {
          entity_id: config.homeAssistant.weather,
          type: "daily",
        })
        .then((r) => {
          data.weather!.forecastDaily =
            r.service_response?.[config.homeAssistant.weather]?.forecast;
        }),
    ]);
  }

  if (config.homeAssistant.selfBatteryEntity) {
    const batteryEntity = haEntities.find(
      (e) => e.entity_id === config.homeAssistant.selfBatteryEntity,
    );
    assertEntityFound(config.homeAssistant.selfBatteryEntity, batteryEntity);
    const level = parseFloat(batteryEntity.state);
    if (!isNaN(level)) {
      data.batteryLevel = level;
    }
  }

  if (config.e2clicker) {
    try {
      const nextDoseTime = await e2clicker.getNextDoseTime(config.e2clicker);
      data.estrogenInfo = nextDoseTime ?? undefined;
    } catch (err) {
      console.warn("Failed to fetch next dose time from e2clicker:", err);
    }
  }

  return data;
};

function assertEntityFound(entityID: string, entity: unknown): asserts entity {
  if (!entity) {
    error(500, `Entity ${entityID} not found in Home Assistant`);
  }
}
