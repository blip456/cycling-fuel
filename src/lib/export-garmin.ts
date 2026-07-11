import { format, parseISO } from "date-fns";
import { formatTime, formatDuration } from "./utils";
import type { FuelPlan, ScheduleItem } from "./types";

function buildStepName(item: ScheduleItem): string {
  const t = formatTime(item.timeMin);
  const foodShort = item.food?.name.slice(0, 8) ?? "";
  let action = "";

  if (foodShort && item.drink) {
    action = `${foodShort}+B${item.drink.bottleIndex}`;
  } else if (foodShort) {
    action = foodShort;
  } else if (item.drink) {
    const drinkShort = item.drink.drinkName.split(" ")[0].slice(0, 7);
    action = `B${item.drink.bottleIndex} ${drinkShort}`;
  } else if (item.note) {
    action = item.note.slice(0, 14);
  } else {
    action = "Ride";
  }

  return `${t} ${action}`.slice(0, 20);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateGarminTCX(plan: FuelPlan): string {
  const result = plan.result!;
  const schedule = result.schedule;
  const totalMin = result.durationHours * 60;

  const rideDate = format(parseISO(plan.rideDate), "MMM d");
  const workoutName = escapeXml(
    `CycleFuel ${rideDate} ${plan.distance}km`.slice(0, 30)
  );

  const bottleSummary = result.bottlePrep
    .map((b) =>
      b.scoops > 0
        ? `B${b.bottleIndex} ${b.drinkName} ${b.scoops}sc/${b.waterMl}ml (${b.carbsTotal}g)`
        : `B${b.bottleIndex} water ${b.waterMl}ml`
    )
    .join(" · ");

  const notes = escapeXml(
    [
      `CycleFuel Plan — ${format(parseISO(plan.rideDate), "MMM d, yyyy")}`,
      `${plan.distance}km · ${formatDuration(result.durationHours)} · ${plan.carbsPerHour}g carbs/hr`,
      `Total: ${result.totalCarbs}g carbs · ${Math.round(result.totalFluidMl / 100) / 10}L fluid`,
      (result.sodiumTargetMg ?? 0) > 0
        ? `Sodium: ~${result.sodiumDeliveredMg}mg planned / ~${result.sodiumTargetMg}mg lost`
        : "",
      bottleSummary,
      plan.location ? `Location: ${plan.location}` : "",
      result.caffeineNote ? `\n${result.caffeineNote}` : "",
      result.recoveryNote ? `\nRecovery: ${result.recoveryNote}` : "",
      "",
      "Import: Garmin Connect → Training → Workouts → Import Workout, then sync to your Edge.",
    ]
      .filter((l) => l !== undefined)
      .join("\n")
  );

  const steps = schedule
    .map((item, i) => {
      const nextTimeMin =
        i < schedule.length - 1 ? schedule[i + 1].timeMin : totalMin;
      const durationSec = Math.max(
        60,
        Math.round((nextTimeMin - item.timeMin) * 60)
      );
      const stepName = escapeXml(buildStepName(item));
      return `      <Step xsi:type="Step_t">
        <StepId>${i + 1}</StepId>
        <Name>${stepName}</Name>
        <Duration xsi:type="Time_t">
          <Seconds>${durationSec}</Seconds>
        </Duration>
        <Intensity>Active</Intensity>
        <Target xsi:type="None_t"/>
      </Step>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Workouts>
    <Workout Sport="Biking">
      <Name>${workoutName}</Name>
${steps}
      <Notes>${notes}</Notes>
    </Workout>
  </Workouts>
</TrainingCenterDatabase>`;
}
