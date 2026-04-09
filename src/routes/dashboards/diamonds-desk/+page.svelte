<script lang="ts">
  import type { PageData } from "./$types";
  import Dashboard from "$lib/components/Dashboard.svelte";
  import { onMount } from "svelte";
  import { formatWeatherCondition, getWeatherIconSVG } from "$lib/homeAssistant";
  import {
    generateTimelineHours,
    generateTimelineEvents,
    getTodayAllDayEvents,
  } from "$lib/calendar";
  import {
    formatTime,
    formatDuration,
    formatDayName,
    getEventDayInfo,
    batteryLevelSVG,
  } from "./lib";
  import { mdiWeatherWindy, mdiWeatherPouring, mdiWaterPercent } from "@mdi/js";

  // Fix web components importing.
  // https://stackoverflow.com/a/74541536
  onMount(() => import("@jamescoyle/svg-icon"));

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
  const currentTime = () => new Date(data.now);

  // Timeline calculations (client-side) - use $derived for reactive computations
  const timeline = $derived.by(() => {
    const HOUR_MS = 60 * 60 * 1000;
    const now = currentTime();

    // Calculate unrounded timeline bounds using config values
    const startDate = new Date(now.getTime() + data.config.timeline.startHours * HOUR_MS);
    const endDate = new Date(now.getTime() + data.config.timeline.endHours * HOUR_MS);

    // Round start time down to the hour
    const roundedStart = new Date(startDate);
    roundedStart.setMinutes(0, 0, 0);

    // Round end time up to the hour
    const roundedEnd = new Date(endDate);
    if (
      roundedEnd.getMinutes() > 0 ||
      roundedEnd.getSeconds() > 0 ||
      roundedEnd.getMilliseconds() > 0
    ) {
      roundedEnd.setHours(roundedEnd.getHours() + 1);
    }
    roundedEnd.setMinutes(0, 0, 0);

    // Use rounded times for all calculations to ensure consistency
    const start = roundedStart.getTime();
    const end = roundedEnd.getTime();
    const duration = end - start;
    const currentOffset = now.getTime() - start;

    const hours = generateTimelineHours(startDate, endDate, now);
    const hourCount = hours.length - 1; // Number of hour spans

    return {
      hours,
      // TODO: render partial error bars:
      events: generateTimelineEvents(roundedStart, roundedEnd, data.events ?? []),
      allDayEvents: getTodayAllDayEvents(now, data.events ?? []),
      currentTimePercent: (currentOffset / duration) * 100,
      timelineHeight: hourCount * data.config.timeline.pixelsPerHour,
    };
  });

  let timelineContainer: HTMLElement;

  function scrollIfCurrent(element: HTMLDivElement, isCurrent: boolean) {
    if (!isCurrent) {
      return;
    }

    element.scrollIntoView({ behavior: "instant", block: "center" });
    // Scroll down a bit to show more of the future.
    setTimeout(() => {
      timelineContainer.scrollBy({ top: 100, behavior: "instant" });
    }, 0);
  }
</script>

<Dashboard config={data.config}>
  <div class="container">
    <!-- Left Pane: Clock and Weather -->
    <div class="left-pane">
      <section class="clock-section">
        <div class="time">
          {@html formatTime(data.now, {
            showMinutes: data.config.showMinutes,
            show24HourTime: data.config.show24HourTime,
          })}
        </div>
      </section>

      <section class="weather-section">
        {#if data.weather}
          <div class="weather-header">
            <svg-icon
              class="weather-icon"
              type="mdi"
              path={getWeatherIconSVG(data.weather.condition)}
              size="72"
            ></svg-icon>
            <div class="weather-info">
              <div class="temperature">
                {#if data.weather.temperature !== undefined}
                  {Math.round(data.weather.temperature)}<span class="unit"
                    >{data.weather.temperature_unit}</span
                  >
                {:else}
                  <span class="empty">NaN</span>
                {/if}
              </div>
              <div class="condition">
                {formatWeatherCondition(data.weather.condition)}
              </div>
            </div>
          </div>

          <div class="weather-details">
            {#if data.weather.precipitation_unit !== undefined}
              <div class="detail">
                <svg-icon type="mdi" path={mdiWeatherPouring}></svg-icon>
                <span class="value">
                  {data.weather.precipitation ?? 0}<span class="unit"
                    >{data.weather.precipitation_unit}</span
                  >
                </span>
              </div>
            {/if}
            {#if data.weather.humidity !== undefined}
              <div class="detail">
                <svg-icon type="mdi" path={mdiWaterPercent}></svg-icon>
                <span class="value">{data.weather.humidity}<span class="unit">%</span></span>
              </div>
            {/if}
            {#if data.weather.wind_speed_unit !== undefined}
              <div class="detail">
                <svg-icon type="mdi" path={mdiWeatherWindy}></svg-icon>
                <span class="value">
                  {Math.round(data.weather.wind_speed ?? 0)}<span class="unit"
                    >{data.weather.wind_speed_unit}</span
                  >
                </span>
              </div>
            {/if}
          </div>

          <div class="weather-forecast">
            {#if data.weather.forecastDaily}
              {#each data.weather.forecastDaily.slice(0, 5) as day}
                <div class="forecast-day">
                  <div class="forecast-day-name">{formatDayName(day.datetime, currentTime())}</div>
                  <svg-icon
                    class="forecast-icon"
                    type="mdi"
                    path={getWeatherIconSVG(day.condition ?? "")}
                    size="28"
                  ></svg-icon>
                  <div class="forecast-temps">
                    <span class="forecast-high">
                      {day.temperature !== undefined ? Math.round(day.temperature) : "—"}°
                    </span>
                    {#if day.templow !== undefined}
                      <span class="forecast-low">
                        {Math.round(day.templow)}°
                      </span>
                    {/if}
                  </div>
                </div>
              {/each}
            {:else}
              <div class="empty">No forecast data</div>
            {/if}
          </div>
        {:else}
          <div class="empty">No weather data</div>
        {/if}
      </section>
    </div>

    <!-- Right Pane: Timeline -->
    <div class="right-pane" class:show24HourTime={data.config.show24HourTime}>
      <section class="timeline-header">
        <span class="timeline-date">
          {currentTime().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </span>
      </section>

      {#if timeline.allDayEvents && timeline.allDayEvents.length > 0}
        <section class="all-day-events">
          {#each timeline.allDayEvents as event}
            {@const dayInfo = getEventDayInfo(event, currentTime())}
            <div class="all-day-event event">
              <div class="event-summary">
                {event.summary}
                {#if dayInfo}
                  <span class="event-day-info">
                    (day {dayInfo.currentDay}/{dayInfo.totalDays})
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </section>
      {/if}

      <section class="timeline-container" bind:this={timelineContainer}>
        <div class="timeline" style:min-height="{timeline.timelineHeight}px">
          <!-- Hour markers -->
          {#each timeline.hours as hour, i}
            <div
              class="hour-marker"
              class:past={hour.isPast}
              class:current={hour.isCurrent}
              use:scrollIfCurrent={hour.isCurrent}
              style:top="{(i / (timeline.hours.length - 1)) * 100}%"
            >
              <div class="hour-label">
                {formatTime(hour.time, {
                  showMinutes: data.config.show24HourTime,
                  show24HourTime: data.config.show24HourTime,
                })}
              </div>
              <div class="hour-line"></div>
            </div>
          {/each}

          <!-- Current time indicator -->
          <div class="current-time-indicator" style:top="{timeline.currentTimePercent}%">
            <div class="current-time-line"></div>
          </div>

          <!-- Events layer -->
          <div class="events-layer">
            {#each timeline.events as event}
              {@const isPast = event.end.getTime() < currentTime().getTime()}
              {@const eventHours = (event.end.getTime() - event.start.getTime()) / (60 * 60 * 1000)}
              <div
                class="timeline-event"
                class:timeline-event-half-hour={eventHours <= 0.5}
                class:timeline-event-one-hour={0.5 < eventHours && eventHours <= 1}
                class:past={isPast}
                style:top="{event.offsetPercent}%"
                style:height="{event.heightPercent}%"
                style:left="{(event.overlapColumn / event.overlapTotal) * 100}%"
                style:width="{100 / event.overlapTotal}%"
              >
                <div class="event-summary">{event.summary}</div>
                <div class="event-time">
                  {new Date(event.start).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    hour12: !data.config.show24HourTime,
                    minute: "2-digit",
                  })}
                  •
                  {formatDuration(event.start, event.end)}
                </div>
                {#if event.description}
                  <div class="event-description">{event.description}</div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </section>
    </div>

    {#if data.batteryLevel}
      <div class="battery-status">
        <svg-icon class="icon" type="mdi" path={batteryLevelSVG(data.batteryLevel)} size="20">
        </svg-icon>
        <span class="text">{data.batteryLevel}%</span>
      </div>
    {/if}
  </div>
</Dashboard>

<style>
  .container {
    display: grid;
    grid-template-columns: 1fr 1fr;

    height: 100%;
    overflow: hidden;
  }

  .left-pane {
    display: grid;
    grid-template-rows: 35% 1fr;
    grid-template-columns: 1fr;

    padding: 0 3em;
    border-right: 2px solid black;

    text-align: center;

    .clock-section {
      display: flex;
      align-items: center;
      justify-content: center;

      border-bottom: 1px solid black;

      .time {
        font-size: 6.5em;
        font-weight: 600;
        white-space: norap;

        :global(.hidden-minutes),
        :global(.quarterly-minutes) {
          color: white;
          paint-order: stroke fill;
          -webkit-text-stroke: 6px black;
        }
      }
    }

    .weather-section {
      display: flex;
      flex-direction: column;
      gap: 1em;

      .weather-header {
        margin-top: 2em;

        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-evenly;

        .weather-info {
          text-align: center;
        }

        .temperature {
          font-size: 4em;
          font-weight: 600;
          line-height: 1;

          .unit {
            font-size: 0.5em;
            font-weight: 300;
            vertical-align: super;
          }
        }

        .condition {
          font-size: 1.25em;
        }
      }

      .weather-details {
        display: grid;
        grid-template-rows: 1fr;
        grid-template-columns: repeat(3, 1fr);
        margin: 1em 0;

        .detail {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5em;
        }
      }
    }

    .weather-forecast {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.5em;

      .forecast-day {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5em;
        padding: 0 0.5em;

        .forecast-day-name {
          font-size: 0.9em;
        }

        .forecast-icon {
          margin: 0.25em 0;
        }

        .forecast-temps {
          display: flex;
          gap: 0.5em;
          font-size: 1em;

          .forecast-high {
            font-weight: 600;
          }

          .forecast-low {
            font-weight: 300;
          }
        }
      }
    }
  }

  .right-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 2em;
    overflow: hidden;

    --hour-width: 4em;
    --hour-left-shift: calc(var(--hour-width) - 0.5em);

    .timeline-header {
      text-align: center;
      border-bottom: 1px solid black;
      margin-bottom: 1em;
      padding-bottom: 1em;

      .timeline-date {
        font-size: 1.5em;
        font-weight: 600;
      }
    }

    .all-day-events {
      display: flex;
      flex-direction: column;
      gap: 0.25em;
      margin-left: var(--hour-width);
      margin-bottom: 0.5em;

      .all-day-event {
        padding: 0.25em 0.5em;
        margin: 0 0.25em;

        border: 1.5px solid black;
        border-radius: 4px;

        font-weight: 600;

        .event-summary {
          font-size: 0.9em;
        }

        .event-day-info {
          font-size: 0.9em;
          font-weight: 300;
        }
      }
    }

    .timeline-container {
      flex: 1;
      overflow-y: auto;
      position: relative;
    }

    .timeline {
      position: relative;
      height: 100%;
      /* min-height is set dynamically via inline style based on config */
    }

    .hour-marker {
      position: absolute;
      left: 0;
      right: 0;
      height: 0;
      /* Each hour is 100% / 12 hours apart */

      .hour-label {
        padding: 0.25em 0;
        margin-top: -0.25em;
      }
    }

    .hour-label {
      position: absolute;
      left: 0;
      top: -0.6em;
      width: var(--hour-width);
      font-size: 0.9em;
      padding-right: 0.5em;
      z-index: 2;

      text-align: right;

      :is(.show24HourTime) & {
        /* Align by the colon instead of the AM/PM: */
        text-align: center;
      }
    }

    .hour-line {
      position: absolute;
      left: 3.5em;
      right: 0;
      top: 0;
      border-top: 1px solid black;
      z-index: 1;
    }

    .current-time-indicator {
      position: absolute;
      left: 0;
      right: 0;
      height: 0;
      z-index: 4; /* Above events */
      pointer-events: none;

      .current-time-line {
        position: absolute;
        left: var(--hour-left-shift);
        right: 0;
        top: 0;
        border: 2px solid rgba(0, 0, 0, 0.8);
        border-radius: 4px;
      }
    }

    .events-layer {
      position: absolute;
      left: var(--hour-left-shift);
      right: 0;
      top: 0;
      bottom: 0;
      margin: 0 0.25em;
      z-index: 3;
    }

    .timeline-event {
      position: absolute;
      border: 1.5px solid black;
      border-radius: 4px;
      background: white;
      padding: 0.25em 0.5em;
      overflow: hidden;
      box-sizing: border-box;

      /* Prevent very small events from being invisible */
      min-height: 1.2em;

      .event-summary {
        font-weight: 600;
        font-size: 0.9em;
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        line-clamp: 2;
      }

      .event-time {
        font-size: 0.8em;
        margin-bottom: 0.2em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .event-description {
        font-size: 0.8em;
        margin-top: 0.2em;
        overflow: hidden;
        text-overflow: ellipsis;
        line-clamp: 2;
      }

      &.timeline-event-one-hour {
        .event-description {
          display: none;
        }
      }

      &.timeline-event-half-hour {
        padding-top: 0;
        padding-bottom: 0;

        .event-time,
        .event-description {
          display: none;
        }
      }
    }
  }

  .battery-status {
    position: absolute;
    bottom: 0.25em;
    right: 0.25em;

    display: flex;
    align-items: center;
    gap: 0.2em;

    .icon {
      transform: rotate(90deg);
    }

    .text {
      font-size: 0.8em;
    }
  }
</style>
