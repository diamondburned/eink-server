import {
  mdiBattery20,
  mdiBattery30,
  mdiBattery40,
  mdiBattery50,
  mdiBattery60,
  mdiBattery70,
  mdiBattery80,
  mdiBattery90,
  mdiBattery,
  mdiBatteryAlertVariantOutline,
} from "@mdi/js";

export function batteryLevelSVG(level: number): string {
  if (level <= 10) return mdiBatteryAlertVariantOutline;
  if (level <= 20) return mdiBattery20;
  if (level <= 30) return mdiBattery30;
  if (level <= 40) return mdiBattery40;
  if (level <= 50) return mdiBattery50;
  if (level <= 60) return mdiBattery60;
  if (level <= 70) return mdiBattery70;
  if (level <= 80) return mdiBattery80;
  if (level <= 90) return mdiBattery90;
  return mdiBattery; // Full battery
}
