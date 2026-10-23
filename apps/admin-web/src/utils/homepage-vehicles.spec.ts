import { describe, expect, it } from "vitest";
import { selectHomepageVehicles } from "../../../../shared/homepage-vehicles";

describe("Shared homepage vehicle selection", () => {
  const vehicles = [
    { id: "1" },
    { id: "2", isFeatured: true },
    { id: "3", isHomepage: true }
  ];

  it("shows existing vehicle flags and automatic vehicles when no recommendations were configured", () => {
    expect(
      selectHomepageVehicles([], vehicles).vehicles.map(item => item.id)
    ).toEqual(["2", "3"]);
    expect(selectHomepageVehicles([], [{ id: "1" }]).source).toBe("automatic");
  });

  it("honors configured order and count including a vehicle outside the catalogue page", () => {
    const selected = selectHomepageVehicles(
      [
        {
          type: "FEATURED_VEHICLES",
          displayCount: 1,
          recommendations: [
            { vehicle: { id: "2" }, sortOrder: 2 },
            { vehicle: { id: "outside-page" }, sortOrder: 1 }
          ]
        }
      ],
      vehicles
    );
    expect(selected.vehicles.map(item => item.id)).toEqual(["outside-page"]);
    expect(selected.source).toBe("configured");
  });

  it("keeps an intentionally empty or disabled configuration from reverting to automatic vehicles", () => {
    expect(
      selectHomepageVehicles(
        [
          {
            type: "FEATURED_VEHICLES",
            _count: { recommendations: 2 },
            recommendations: []
          }
        ],
        vehicles
      ).vehicles
    ).toEqual([]);
    expect(
      selectHomepageVehicles(
        [{ type: "FEATURED_VEHICLES", isEnabled: false }],
        vehicles
      ).enabled
    ).toBe(false);
  });

  it("filters scheduled, expired and disabled items and removes duplicates", () => {
    const now = Date.parse("2026-10-01T00:00:00Z");
    const selected = selectHomepageVehicles(
      [
        {
          type: "FEATURED_VEHICLES",
          recommendations: [
            { vehicle: { id: "1" } },
            { vehicle: { id: "1" } },
            { vehicle: { id: "2" }, startsAt: "2026-10-02T00:00:00Z" },
            { vehicle: { id: "3" }, endsAt: "2026-10-01T00:00:00Z" },
            { vehicle: { id: "4" }, isEnabled: false }
          ]
        }
      ],
      vehicles,
      now
    );
    expect(selected.vehicles.map(item => item.id)).toEqual(["1"]);
  });
});
