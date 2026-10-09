import { describe, it, expect } from "vitest";
import {
  rowsToWeek,
  googlePeriodsToWeek,
  validateOpeningDay,
  weekToPayload,
  copyDayToAll,
  weeksEqual,
  emptyWeek,
  isOvernight,
} from "../opening-hours";

describe("rowsToWeek", () => {
  it("groups API rows per weekday, strips seconds and sorts intervals", () => {
    const week = rowsToWeek([
      { dayOfWeek: 1, opensAt: "19:00:00", closesAt: "23:00:00", isClosed: false },
      { dayOfWeek: 1, opensAt: "12:00:00", closesAt: "15:00:00", isClosed: false },
      { dayOfWeek: 0, opensAt: null, closesAt: null, isClosed: true },
      { dayOfWeek: 5, opensAt: "22:00:00", closesAt: "02:00:00", isClosed: false },
    ]);
    expect(week).toHaveLength(7);
    expect(week[1]).toEqual({
      dayOfWeek: 1,
      closed: false,
      intervals: [{ opens: "12:00", closes: "15:00" }, { opens: "19:00", closes: "23:00" }],
    });
    expect(week[0]).toEqual({ dayOfWeek: 0, closed: true, intervals: [] });
    // A day with no row at all is closed, as the app renders it.
    expect(week[3].closed).toBe(true);
    expect(isOvernight(week[5].intervals[0])).toBe(true);
  });
});

describe("googlePeriodsToWeek", () => {
  it("expands Google's single 00:00-23:59 period to every day", () => {
    const week = googlePeriodsToWeek([{ dayOfWeek: 0, opensAt: "00:00", closesAt: "23:59" }]);
    expect(week.every((d) => !d.closed && d.intervals[0].opens === "00:00")).toBe(true);
  });

  it("marks days Google omits as closed", () => {
    const week = googlePeriodsToWeek([{ dayOfWeek: 2, opensAt: "10:00", closesAt: "18:00" }]);
    expect(week.filter((d) => !d.closed).map((d) => d.dayOfWeek)).toEqual([2]);
  });
});

describe("validateOpeningDay", () => {
  const day = (intervals: [string, string][], closed = false) => ({
    dayOfWeek: 1,
    closed,
    intervals: intervals.map(([opens, closes]) => ({ opens, closes })),
  });

  it("accepts split shifts and a final overnight interval", () => {
    expect(validateOpeningDay(day([["12:00", "15:00"], ["22:00", "02:00"]]))).toBeNull();
    expect(validateOpeningDay(day([], true))).toBeNull();
  });

  it("reports overlap, equal times, bad format and empty open days", () => {
    expect(validateOpeningDay(day([["10:00", "14:00"], ["13:00", "18:00"]]))).toBe("overlap");
    expect(validateOpeningDay(day([["22:00", "02:00"], ["23:00", "23:30"]]))).toBe("overlap");
    expect(validateOpeningDay(day([["10:00", "10:00"]]))).toBe("same-time");
    expect(validateOpeningDay(day([["", "10:00"]]))).toBe("invalid-time");
    expect(validateOpeningDay(day([]))).toBe("no-intervals");
  });
});

describe("weekToPayload", () => {
  it("sends [] for an all-closed week so the place goes back to hours unknown", () => {
    expect(weekToPayload(emptyWeek())).toEqual([]);
  });

  it("sends all seven days, closed ones without intervals", () => {
    const week = emptyWeek();
    week[1] = { dayOfWeek: 1, closed: false, intervals: [{ opens: "09:00", closes: "18:00" }] };
    const payload = weekToPayload(week);
    expect(payload).toHaveLength(7);
    expect(payload[1]).toEqual(week[1]);
    expect(payload[0]).toEqual({ dayOfWeek: 0, closed: true, intervals: [] });
  });
});

describe("copyDayToAll / weeksEqual", () => {
  it("copies one day's schedule to every day without sharing references", () => {
    const week = emptyWeek();
    week[1] = { dayOfWeek: 1, closed: false, intervals: [{ opens: "09:00", closes: "18:00" }] };
    const copied = copyDayToAll(week, 1);
    expect(copied.every((d) => !d.closed && d.intervals[0].closes === "18:00")).toBe(true);
    copied[2].intervals[0].closes = "20:00";
    expect(copied[1].intervals[0].closes).toBe("18:00");
    expect(weeksEqual(week, copied)).toBe(false);
    expect(weeksEqual(week, rowsToWeek([{ dayOfWeek: 1, opensAt: "09:00:00", closesAt: "18:00:00", isClosed: false }]))).toBe(true);
  });
});
