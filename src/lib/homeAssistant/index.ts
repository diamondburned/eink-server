// Home Assistant REST API Client
// https://developers.home-assistant.io/docs/api/rest/

import type { EntityState, CalendarEvent, ServiceCallResponse, ServiceCallStates } from "./types";
import ky from "ky";

export * from "./types";
export * from "./data";

export class HomeAssistantClient {
  constructor(
    readonly baseURL: string,
    readonly accessToken: string,
  ) {
    this.baseURL = this.baseURL.replace(/\/$/, "");
  }

  async entities(): Promise<
    EntityState<{
      friendly_name?: string;
      [key: string]: unknown;
    }>[]
  > {
    return this.request<Awaited<ReturnType<typeof this.entities>>>("/api/states");
  }

  async entityStates<T = Record<string, unknown>>(entityID: string): Promise<EntityState<T>> {
    return this.request<EntityState<T>>(`/api/states/${entityID}`);
  }

  async calendarEvents(
    calendarEntityID: string,
    start = currentTimeISO(0),
    end = currentTimeISO(24 * 60 * 60 /* 1 day ahead */),
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({ start, end });
    return this.request<CalendarEvent[]>(`/api/calendars/${calendarEntityID}?${params.toString()}`);
  }

  // Overload: without returnResponse (returns array of changed states)
  async callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    options?: { returnResponse?: false },
  ): Promise<ServiceCallStates>;

  // Overload: with returnResponse (returns object with changed_states and service_response)
  async callService<T = Record<string, unknown>>(
    domain: string,
    service: string,
    serviceData: Record<string, unknown> | undefined,
    options: { returnResponse: true },
  ): Promise<ServiceCallResponse<T>>;

  // Implementation
  async callService<T = unknown>(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    { returnResponse }: { returnResponse?: boolean } = {},
  ): Promise<ServiceCallStates | ServiceCallResponse<T>> {
    const endpoint = returnResponse
      ? `/api/services/${domain}/${service}?return_response`
      : `/api/services/${domain}/${service}`;

    const response = await ky
      .post(`${this.baseURL}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: serviceData ? JSON.stringify(serviceData) : undefined,
      })
      .catch((err) => {
        throw new Error(`Network error while calling Home Assistant service`, { cause: err });
      });

    if (!response.ok) {
      throw new Error(`Home Assistant API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async callServiceWithResponse<T = Record<string, unknown>>(
    domain: string,
    service: string,
    serviceData: Record<string, unknown> | undefined,
  ): Promise<ServiceCallResponse<T>> {
    return this.callService(domain, service, serviceData, { returnResponse: true });
  }

  private async request<T>(endpoint: string): Promise<T> {
    const response = await ky
      .get(`${this.baseURL}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      })
      .catch((err) => {
        throw new Error(`Network error while calling Home Assistant API`, { cause: err });
      });

    if (!response.ok) {
      throw new Error(`Home Assistant API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

export function currentTimeISO(offsetSec: number): string {
  let date = new Date();
  if (offsetSec !== 0) {
    date = new Date(date.getTime() + offsetSec * 1000);
  }
  return date.toISOString();
}
