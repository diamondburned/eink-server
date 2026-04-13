import { HomeAssistantClient, type WeatherForecastResponse } from "$lib/homeAssistant";
import * as luxon from "luxon";

export type WeatherForecast = {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  precipitation?: number;
  precipitation_probability?: number;
};

export async function fetchDailyForecast(
  client: HomeAssistantClient,
  entityID: string,
): Promise<WeatherForecast[]> {
  const daily = await callGetForecasts(client, entityID, "daily");
  if (daily) {
    return daily.map((forecast) => ({ ...forecast }) as WeatherForecast);
  }

  const twiceDaily = await callGetForecasts(client, entityID, "twice_daily");
  if (twiceDaily) {
    const daily: { day: WeatherForecast }[] = [];
    for (const forecast of twiceDaily) {
      const date = luxon.DateTime.fromISO(forecast.datetime).set({
        hour: 12,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
      if (!date.isValid) {
        throw new Error(`Invalid datetime in forecast: ${forecast.datetime}`);
      }

      const existing = daily.find((f) => f.day.datetime === date.toISO());
      if (existing) {
        // Prefer daytime forecast over nighttime.
        if (forecast.is_daytime) {
          existing.day = {
            ...forecast,
            templow: existing.day.templow,
          };
        } else {
          existing.day.templow = forecast.temperature;
        }
      } else {
        daily.push({
          day: {
            ...forecast,
            datetime: date.toISO(),
            temperature: forecast.is_daytime ? forecast.temperature : undefined,
            templow: forecast.is_daytime ? undefined : forecast.temperature,
          },
        });
      }
    }

    return daily.map((f) => f.day);
  }

  throw new Error(
    `Failed to fetch weather forecasts: both daily and twice_daily types are unavailable for ${entityID}`,
  );
}

async function callGetForecasts(
  client: HomeAssistantClient,
  entityID: string,
  type: "daily" | "twice_daily",
) {
  try {
    const response = await client.callServiceWithResponse<WeatherForecastResponse>(
      "weather",
      "get_forecasts",
      {
        entity_id: entityID,
        type,
      },
    );
    return response.service_response?.[entityID]?.forecast;
  } catch (err) {
    if (`${err}`.includes("Home Assistant")) {
      return undefined;
    }
    throw err;
  }
}
