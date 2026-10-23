import { StorageDriver } from "@prisma/client";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { legacyVehicleDefaults } from "./legacy-vehicle-defaults";
import { LegacyVehicleImporterService } from "./legacy-vehicle-importer.service";

function createImporter(sourceDirectory: string, marker: unknown = null) {
  let nextBrandId = 1n;
  let nextMediaId = 100n;
  let nextVehicleId = 1n;
  const prisma = {
    siteSetting: {
      findUnique: jest.fn().mockResolvedValue(marker),
      upsert: jest.fn().mockResolvedValue({ id: 1n }),
    },
    vehicle: {
      count: jest.fn().mockResolvedValue(0),
      upsert: jest.fn().mockImplementation(() => ({
        id: nextVehicleId++,
        coverMediaId: null,
      })),
      update: jest.fn(),
    },
    mediaFolder: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 20n }),
    },
    brand: {
      upsert: jest.fn().mockImplementation(() => ({ id: nextBrandId++ })),
    },
    mediaAsset: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(() => ({ id: nextMediaId++ })),
    },
    vehicleMedia: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
  };
  const storage = {
    driver: StorageDriver.MINIO,
    putObject: jest.fn().mockImplementation(({ objectKey }: { objectKey: string }) => ({
      driver: StorageDriver.MINIO,
      bucket: "sfhyl",
      objectKey,
      url: `https://media.example/${objectKey}`,
    })),
  };
  const cache = { invalidateAll: jest.fn() };
  const audit = { record: jest.fn() };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key === "LEGACY_VEHICLE_ASSETS_DIR" ? sourceDirectory : fallback,
    ),
  };

  return {
    importer: new LegacyVehicleImporterService(
      prisma as never,
      storage as never,
      cache as never,
      audit as never,
      config as never,
    ),
    prisma,
    storage,
    cache,
    audit,
  };
}

describe("LegacyVehicleImporterService", () => {
  let sourceDirectory = "";

  beforeEach(async () => {
    sourceDirectory = await mkdtemp(join(tmpdir(), "sfhyl-legacy-vehicles-"));
    await Promise.all(
      legacyVehicleDefaults.map((vehicle) =>
        writeFile(join(sourceDirectory, vehicle.filename), vehicle.filename),
      ),
    );
  });

  afterEach(async () => {
    await rm(sourceDirectory, { recursive: true, force: true });
  });

  it("imports the legacy website vehicles and creates the completion marker", async () => {
    const { importer, prisma, storage, cache, audit } = createImporter(
      sourceDirectory,
    );

    await importer.ensure();

    expect(storage.putObject).toHaveBeenCalledTimes(legacyVehicleDefaults.length);
    expect(prisma.mediaAsset.create).toHaveBeenCalledTimes(
      legacyVehicleDefaults.length,
    );
    expect(prisma.vehicle.upsert).toHaveBeenCalledTimes(
      legacyVehicleDefaults.length,
    );
    expect(prisma.vehicleMedia.create).toHaveBeenCalledTimes(
      legacyVehicleDefaults.length,
    );
    const markerCalls = prisma.siteSetting.upsert.mock.calls as unknown as Array<[{
      create?: { key?: string; value?: { state?: string; vehicleCount?: number } };
    }]>;
    expect(markerCalls[0]?.[0]).toMatchObject({
      create: {
        key: "legacy_vehicle_import_v1",
        value: {
          state: "completed",
          vehicleCount: legacyVehicleDefaults.length,
        },
      },
    });
    expect(cache.invalidateAll).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "import_defaults", resourceType: "vehicle" }),
    );
  });

  it("does nothing after the completed import marker has been created", async () => {
    const { importer, prisma, storage } = createImporter(sourceDirectory, {
      id: 1n,
      value: { state: "completed" },
    });

    await importer.ensure();

    expect(prisma.vehicle.count).not.toHaveBeenCalled();
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(prisma.vehicle.upsert).not.toHaveBeenCalled();
  });

  it("retries an earlier skipped import marker", async () => {
    const { importer, prisma } = createImporter(sourceDirectory, {
      id: 1n,
      value: { state: "skipped" },
    });

    await importer.ensure();

    expect(prisma.vehicle.upsert).toHaveBeenCalledTimes(
      legacyVehicleDefaults.length,
    );
  });
});
