import { StorageDriver } from "@prisma/client";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { homepageDefaultAssets } from "./homepage-default-content";
import { legacyServiceModuleBodies, serviceModuleBodies } from "./homepage-service-content";
import {
  COMPANY_CORE_BUSINESS_MODULE_ID,
  COMPANY_CORE_STRENGTHS_MODULE_ID,
  COMPANY_OVERVIEW_BODY_FORMAT_VERSION,
  COMPANY_OVERVIEW_LAYOUT_VERSION,
  COMPANY_OVERVIEW_MODULE_ID,
  COMPANY_PARTS_EXPORTS_MODULE_ID,
  COMPANY_VEHICLE_EXPORTS_MODULE_ID,
} from "./homepage-company-overview";
import {
  HomepageDefaultImporterService,
  needsHomepageDefaultImport,
} from "./homepage-default-importer.service";

function createImporter(sourceDirectory: string, content: unknown) {
  let nextId = 1n;
  let pageContent = content;
  const prisma = {
    page: {
      findUnique: jest.fn().mockImplementation(() => ({ id: 12n, content: pageContent })),
      upsert: jest.fn().mockImplementation((args: { create: { content: unknown } }) => {
        const { create } = args;
        pageContent = create.content;
        return { id: 12n, content: pageContent };
      }),
      update: jest.fn().mockImplementation((args: { data: { content: unknown } }) => {
        const { data } = args;
        pageContent = data.content;
        return { id: 12n, content: pageContent };
      }),
    },
    mediaAsset: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(() => ({ id: nextId++ })),
      update: jest.fn(),
    },
  };
  const storage = {
    driver: StorageDriver.MINIO,
    putObject: jest.fn().mockImplementation(({ objectKey }: { objectKey: string }) => ({
      driver: StorageDriver.MINIO,
      bucket: "sfhyl",
      objectKey,
      url: `https://cdn.example/${objectKey}`,
    })),
  };
  const cache = { invalidateAll: jest.fn() };
  const audit = { record: jest.fn() };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key === "HOMEPAGE_DEFAULT_ASSETS_DIR" ? sourceDirectory : fallback,
    ),
  };
  return {
    importer: new HomepageDefaultImporterService(
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
    getPageContent: () => pageContent,
    setPageContent: (value: unknown) => {
      pageContent = value;
    },
  };
}

describe("HomepageDefaultImporterService", () => {
  let sourceDirectory = "";

  beforeEach(async () => {
    sourceDirectory = await mkdtemp(join(tmpdir(), "sfhyl-homepage-defaults-"));
    await Promise.all(
      homepageDefaultAssets.map((asset) =>
        writeFile(join(sourceDirectory, asset.filename), asset.filename),
      ),
    );
  });

  afterEach(async () => {
    await rm(sourceDirectory, { recursive: true, force: true });
  });

  it("imports legacy defaults into managed homepage content exactly once", async () => {
    const { importer, prisma, storage, cache, audit } = createImporter(
      sourceDirectory,
      { hero: [], about: { videoMediaId: null } },
    );

    await importer.onApplicationBootstrap();

    expect(storage.putObject).toHaveBeenCalledTimes(homepageDefaultAssets.length);
    expect(prisma.mediaAsset.create).toHaveBeenCalledTimes(
      homepageDefaultAssets.length,
    );
    expect(prisma.page.upsert).toHaveBeenCalledTimes(1);
    const upsertCalls = prisma.page.upsert.mock.calls as Array<
      [{ create: { content: Record<string, unknown> } }]
    >;
    const firstUpsert = upsertCalls.at(0);
    if (!firstUpsert) throw new Error("Expected homepage content to be saved.");
    const content = firstUpsert[0].create.content;
    expect(content.managed).toBe(true);
    expect((content.hero as unknown[]).length).toBe(4);
    expect(((content.videos as { items: unknown[] }).items).length).toBe(3);
    expect(content.companyOverviewSeeded).toBe(true);
    expect(
      (content.customModules as Array<{ id: string }>).some(
        (item) => item.id === COMPANY_OVERVIEW_MODULE_ID,
      ),
    ).toBe(true);
    expect(content.companyOverviewLayoutVersion).toBe(
      COMPANY_OVERVIEW_LAYOUT_VERSION,
    );
    expect(content.companyOverviewBodyFormatVersion).toBe(
      COMPANY_OVERVIEW_BODY_FORMAT_VERSION,
    );
    const modules = content.customModules as Array<{
      id: string;
      body: { zh: string; en: string; ru: string };
    }>;
    expect(modules.map((item) => item.id)).toEqual([
      "home-service-process",
      "home-service-regions",
      COMPANY_OVERVIEW_MODULE_ID,
      COMPANY_CORE_BUSINESS_MODULE_ID,
      COMPANY_VEHICLE_EXPORTS_MODULE_ID,
      COMPANY_PARTS_EXPORTS_MODULE_ID,
      COMPANY_CORE_STRENGTHS_MODULE_ID,
    ]);
    expect(modules.find((item) => item.id === COMPANY_OVERVIEW_MODULE_ID)?.body.zh).toContain(
      "张显东",
    );
    expect(modules.find((item) => item.id === COMPANY_CORE_BUSINESS_MODULE_ID)?.body.en).toContain(
      "Pre-owned vehicle exports",
    );
    expect(modules.find((item) => item.id === COMPANY_VEHICLE_EXPORTS_MODULE_ID)?.body.ru).toContain(
      "Toyota Corolla",
    );
    expect(modules.find((item) => item.id === COMPANY_CORE_STRENGTHS_MODULE_ID)?.body.zh).toContain(
      "26 年行业背书",
    );
    for (const module of modules.filter((item) => item.id.startsWith("company-"))) {
      expect(module.body.zh).not.toContain("<ul>");
      expect(module.body.en).not.toContain("<ul>");
      expect(module.body.ru).not.toContain("<ul>");
      expect(module.body.zh).toContain("<p>");
    }
    expect(cache.invalidateAll).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "import_defaults" }),
    );
  });

  it("does not overwrite content that is already managed or already references media", async () => {
    expect(needsHomepageDefaultImport({ managed: true, hero: [] })).toBe(false);
    expect(needsHomepageDefaultImport({ hero: [{ imageMediaId: "8" }] })).toBe(
      false,
    );

    const { importer, prisma, storage } = createImporter(sourceDirectory, {
      managed: true,
      companyOverviewSeeded: true,
      companyOverviewLayoutVersion: COMPANY_OVERVIEW_LAYOUT_VERSION,
      companyOverviewBodyFormatVersion: COMPANY_OVERVIEW_BODY_FORMAT_VERSION,
      hero: [],
    });
    await importer.ensure();

    expect(storage.putObject).not.toHaveBeenCalled();
    expect(prisma.page.upsert).not.toHaveBeenCalled();
    expect(prisma.page.update).not.toHaveBeenCalled();
  });

  it("expands only untouched service copy and preserves manual edits and presentation", async () => {
    const { importer, prisma, cache, audit, getPageContent } = createImporter(sourceDirectory, {
      managed: true,
      companyOverviewSeeded: true,
      companyOverviewLayoutVersion: COMPANY_OVERVIEW_LAYOUT_VERSION,
      companyOverviewBodyFormatVersion: COMPANY_OVERVIEW_BODY_FORMAT_VERSION,
      customModules: [
        {
          id: "home-service-process",
          enabled: false,
          placement: "HOME_AFTER_FEATURES",
          body: {
            zh: legacyServiceModuleBodies["home-service-process"].zh.replaceAll("<br>", "<br />"),
            en: "<p>Manually edited process.</p>",
            ru: legacyServiceModuleBodies["home-service-process"].ru,
          },
        },
        { id: "home-service-regions", body: legacyServiceModuleBodies["home-service-regions"] },
      ],
    });

    await importer.ensure();

    const modules = (getPageContent() as {
      customModules: Array<{ id: string; enabled?: boolean; placement?: string; body: { zh: string; en: string; ru: string } }>;
    }).customModules;
    expect(modules[0]).toMatchObject({ enabled: false, placement: "HOME_AFTER_FEATURES" });
    expect(modules[0]?.body.zh).toBe(serviceModuleBodies["home-service-process"].zh);
    expect(modules[0]?.body.en).toBe("<p>Manually edited process.</p>");
    expect(modules[0]?.body.ru).toBe(serviceModuleBodies["home-service-process"].ru);
    expect(modules[1]?.body).toEqual(serviceModuleBodies["home-service-regions"]);
    expect(prisma.page.update).toHaveBeenCalledTimes(1);
    expect(cache.invalidateAll).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "refresh_service_modules" }));

    await importer.ensure();
    expect(prisma.page.update).toHaveBeenCalledTimes(1);
  });

  it("seeds the company overview once and does not restore a manually deleted module", async () => {
    const { importer, prisma, cache, audit, getPageContent, setPageContent } = createImporter(
      sourceDirectory,
      { managed: true, customModules: [] },
    );

    await importer.ensure();

    expect(prisma.page.update).toHaveBeenCalledTimes(1);
    expect(cache.invalidateAll).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "seed_company_overview" }),
    );
    expect(
      (getPageContent() as { customModules: Array<{ id: string }> }).customModules.map(
        (item) => item.id,
      ),
    ).toEqual([
      COMPANY_OVERVIEW_MODULE_ID,
      COMPANY_CORE_BUSINESS_MODULE_ID,
      COMPANY_VEHICLE_EXPORTS_MODULE_ID,
      COMPANY_PARTS_EXPORTS_MODULE_ID,
      COMPANY_CORE_STRENGTHS_MODULE_ID,
    ]);

    const seeded = getPageContent() as Record<string, unknown>;
    setPageContent({ ...seeded, customModules: [] });
    await importer.ensure();

    expect(prisma.page.update).toHaveBeenCalledTimes(1);
    expect((getPageContent() as { customModules: unknown[] }).customModules).toEqual([]);
  });

  it("migrates the legacy single overview module once and retains its selected media", async () => {
    const { importer, prisma, getPageContent } = createImporter(sourceDirectory, {
      managed: true,
      companyOverviewSeeded: true,
      customModules: [
        {
          id: COMPANY_OVERVIEW_MODULE_ID,
          enabled: true,
          mediaType: "IMAGE",
          imageMediaId: "8",
          videoMediaId: null,
          posterMediaId: null,
          button: { label: { zh: "", en: "", ru: "" }, href: "" },
        },
      ],
    });

    await importer.ensure();

    const content = getPageContent() as {
      companyOverviewBodyFormatVersion: number;
      companyOverviewLayoutVersion: number;
      customModules: Array<{ id: string; mediaType: string; imageMediaId: string | null }>;
    };
    expect(content.companyOverviewLayoutVersion).toBe(
      COMPANY_OVERVIEW_LAYOUT_VERSION,
    );
    expect(content.companyOverviewBodyFormatVersion).toBe(
      COMPANY_OVERVIEW_BODY_FORMAT_VERSION,
    );
    expect(content.customModules.map((item) => item.id)).toEqual([
      COMPANY_OVERVIEW_MODULE_ID,
      COMPANY_CORE_BUSINESS_MODULE_ID,
      COMPANY_VEHICLE_EXPORTS_MODULE_ID,
      COMPANY_PARTS_EXPORTS_MODULE_ID,
      COMPANY_CORE_STRENGTHS_MODULE_ID,
    ]);
    expect(content.customModules[0]).toEqual(
      expect.objectContaining({ mediaType: "IMAGE", imageMediaId: "8" }),
    );

    await importer.ensure();
    expect(prisma.page.update).toHaveBeenCalledTimes(1);
  });

  it("converts legacy list markup to paragraphs without replacing manual company text", async () => {
    const { importer, prisma, getPageContent } = createImporter(sourceDirectory, {
      managed: true,
      companyOverviewSeeded: true,
      companyOverviewLayoutVersion: COMPANY_OVERVIEW_LAYOUT_VERSION,
      customModules: [
        {
          id: COMPANY_OVERVIEW_MODULE_ID,
          body: {
            zh: "<p>手工维护的公司概况。</p>",
            en: "<p>Manually maintained overview.</p>",
            ru: "<p>Описание, отредактированное вручную.</p>",
          },
        },
        {
          id: COMPANY_CORE_BUSINESS_MODULE_ID,
          body: {
            zh: "<ul><li><strong>手工业务：</strong>保留这段文字。</li></ul>",
            en: "<ul><li><strong>Manual business:</strong> Keep this text.</li></ul>",
            ru: "<ul><li><strong>Направление:</strong> Сохранить этот текст.</li></ul>",
          },
        },
      ],
    });

    await importer.ensure();

    const content = getPageContent() as {
      companyOverviewBodyFormatVersion: number;
      customModules: Array<{ id: string; body: { zh: string; en: string; ru: string } }>;
    };
    expect(content.companyOverviewBodyFormatVersion).toBe(
      COMPANY_OVERVIEW_BODY_FORMAT_VERSION,
    );
    expect(content.customModules.map((item) => item.id)).toEqual([
      COMPANY_OVERVIEW_MODULE_ID,
      COMPANY_CORE_BUSINESS_MODULE_ID,
    ]);
    expect(content.customModules[0]?.body.zh).toBe("<p>手工维护的公司概况。</p>");
    expect(content.customModules[1]?.body).toEqual({
      zh: "<p><strong>手工业务：</strong>保留这段文字。</p>",
      en: "<p><strong>Manual business:</strong> Keep this text.</p>",
      ru: "<p><strong>Направление:</strong> Сохранить этот текст.</p>",
    });

    await importer.ensure();
    expect(prisma.page.update).toHaveBeenCalledTimes(1);
  });
});
