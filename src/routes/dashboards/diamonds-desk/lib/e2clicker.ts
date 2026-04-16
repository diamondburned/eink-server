import ky from "ky";
import { DateTime, Duration } from "luxon";

export type DosageResponse = {
  dosage: {
    interval: number; // days
  };
  history: {
    takenAt: string; // ISO date string
  }[];
};

export type NextDoseInfo = {
  nextDoseTime: string; // ISO date string
  nextDoseIn?: string; // human duration string
};

export async function getNextDoseTime(
  config: { token: string },
  now = DateTime.now(),
): Promise<NextDoseInfo | null> {
  const start = now.minus({ days: 30 });
  const end = now;

  const resp = await ky
    .get<DosageResponse>("https://e2clicker.app/api/dosage", {
      searchParams: {
        start: start.toISO(),
        end: end.toISO(),
      },
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
      timeout: 3000,
    })
    .then((r) => r.json())
    .catch((err) => {
      throw new Error("Failed to fetch dosage data from e2clicker", { cause: err });
    });
  if (!resp.dosage.interval || !resp.history) {
    return null;
  }

  const lastTakenAtZ = resp.history.at(-1)?.takenAt;
  if (!lastTakenAtZ) {
    return null;
  }

  const lastTakenAt = DateTime.fromISO(lastTakenAtZ);
  if (!lastTakenAt.isValid) {
    throw new Error(`Invalid takenAt date from e2clicker: ${lastTakenAtZ}`);
  }

  const nextDoseInterval = Duration.fromObject({ days: resp.dosage.interval });
  const nextDoseTime = lastTakenAt.plus(nextDoseInterval);

  const info: NextDoseInfo = {
    nextDoseTime: nextDoseTime.toISO(),
  };

  if (nextDoseTime < now) {
    let diff = now.diff(nextDoseTime, ["days", "hours", "minutes"]);
    if (diff.days == 0) {
      diff = diff.shiftTo("hours", "minutes");
    } else {
      diff = diff.shiftTo("days", "hours");
    }

    info.nextDoseIn = diff.toHuman({
      // from e2clicker source code:
      listStyle: "long",
      unitDisplay: "long",
      roundingMode: "ceil",
      roundingIncrement: 1,
      roundingPriority: "lessPrecision",
      maximumFractionDigits: 0,
    });
  }

  return info;
}
