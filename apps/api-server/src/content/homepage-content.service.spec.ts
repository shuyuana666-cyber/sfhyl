import { BadRequestException } from "@nestjs/common";
import { ContentStatus, MediaAssetStatus } from "@prisma/client";
import {
  HomepageContentService,
  normalizeHomepageContent,
} from "./homepage-content.service";

function createService() {
  const prisma = {
    page: { findUnique: jest.fn(), findFirst: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    mediaAsset: { findMany: jest.fn() },
  };
  const audit = { record: jest.fn() };
  const cache = { invalidateAll: jest.fn() };
  const defaults = { ensure: jest.fn() };
  return {
    service: new HomepageContentService(
      prisma as never,
      audit as never,
      cache as never,
      defaults as never,
    ),
    prisma,
    audit,
    cache,
    defaults,
  };
}

const meta = { ipAddress: "127.0.0.1", userAgent: "jest", requestId: "test", method: "PUT", path: "/admin/homepage-content", durationMs: 0 };

describe("HomepageContentService", () => {
  it("treats legacy modules as enabled unless a module is explicitly hidden", () => {
    const content = normalizeHomepageContent({
      about: {},
      transport: { enabled: false },
      staff: {},
      videos: {},
      quickNav: {},
      locations: {},
    }) as {
      heroEnabled: boolean;
      about: { enabled: boolean };
      transport: { enabled: boolean };
      staff: { enabled: boolean };
      videos: { enabled: boolean };
      quickNav: { enabled: boolean };
      locations: { enabled: boolean };
    };

    expect(content.heroEnabled).toBe(true);
    expect(content.about.enabled).toBe(true);
    expect(content.transport.enabled).toBe(false);
    expect(content.staff.enabled).toBe(true);
    expect(content.videos.enabled).toBe(true);
    expect(content.quickNav.enabled).toBe(true);
    expect(content.locations.enabled).toBe(true);
  });

  it("normalizes, sanitizes, and orders custom modules", () => {
    const content = normalizeHomepageContent({
      companyOverviewBodyFormatVersion: 1,
      customModules: [
        {
          id: "company-story",
          title: { zh: "企业故事" },
          body: { zh: "<p>可靠服务</p><script>alert(1)</script>" },
          mediaType: "IMAGE",
          imageMediaId: "8",
        },
        {
          id: "company-story",
          mediaType: "UNSUPPORTED",
          videoMediaId: "9",
        },
      ],
    }) as {
      schemaVersion: number;
      customModules: Array<{
        id: string;
        mediaType: string;
        placement: string;
        displayScope: string;
        imageMediaId: string | null;
        videoMediaId: string | null;
        body: { zh: string };
      }>;
    };

    expect(content.schemaVersion).toBe(5);
    expect(content.customModules).toMatchObject([
      {
        id: "company-story",
        mediaType: "IMAGE",
        placement: "AFTER_VIDEOS",
        displayScope: "BOTH",
        imageMediaId: "8",
        body: { zh: "<p>可靠服务</p>" },
      },
      {
        id: "company-story-2",
        mediaType: "NONE",
        placement: "AFTER_VIDEOS",
        displayScope: "BOTH",
        videoMediaId: null,
      },
    ]);
  });

  it("normalizes custom module placement and display scope", () => {
    const content = normalizeHomepageContent({
      companyOverviewBodyFormatVersion: 1,
      customModules: [
        { id: "homepage-only", placement: "HOME_AFTER_FEATURES", displayScope: "HOME" },
        { id: "about-only", placement: "ABOUT_AFTER_INTRO", displayScope: "ABOUT" },
        { id: "legacy-about", placement: "BEFORE_ABOUT", displayScope: "ABOUT" },
        { id: "after-videos", placement: "AFTER_VIDEOS", displayScope: "ABOUT" },
      ],
    }) as {
      companyOverviewSeeded: boolean;
      companyOverviewLayoutVersion: number;
      companyOverviewBodyFormatVersion: number;
      customModules: Array<{ placement: string; displayScope: string }>;
    };

    expect(content.companyOverviewSeeded).toBe(false);
    expect(content.companyOverviewLayoutVersion).toBe(0);
    expect(content.companyOverviewBodyFormatVersion).toBe(1);
    expect(content.customModules).toEqual([
      expect.objectContaining({ placement: "HOME_AFTER_FEATURES", displayScope: "HOME" }),
      expect.objectContaining({ placement: "ABOUT_AFTER_INTRO", displayScope: "ABOUT" }),
      expect.objectContaining({ placement: "BEFORE_ABOUT", displayScope: "ABOUT" }),
      expect.objectContaining({ placement: "AFTER_VIDEOS", displayScope: "ABOUT" }),
    ]);
  });

  it("saves valid optional map links and invalidates the public cache", async () => {
    const { service, prisma, cache } = createService();
    prisma.page.findUnique.mockResolvedValue(null);
    prisma.page.upsert.mockResolvedValue({ id: 12n });

    await service.save({ locations: { items: [{ mapUrl: "" }] } }, 1n, meta);

    expect(prisma.page.upsert).toHaveBeenCalled();
    expect(cache.invalidateAll).toHaveBeenCalledTimes(1);
  });

  it("rejects unsafe links and unavailable media", async () => {
    const { service, prisma } = createService();
    await expect(service.save({ about: { button: { href: "javascript:alert(1)" } } }, 1n, meta)).rejects.toBeInstanceOf(BadRequestException);

    prisma.mediaAsset.findMany.mockResolvedValue([]);
    await expect(service.save({ hero: [{ imageMediaId: "10" }] }, 1n, meta)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows an active media asset to be reused across homepage fields", async () => {
    const { service, prisma } = createService();
    prisma.mediaAsset.findMany.mockResolvedValue([{ id: 8n, mimeType: "image/webp" }]);
    prisma.page.findUnique.mockResolvedValue(null);
    prisma.page.upsert.mockResolvedValue({ id: 12n });

    await expect(
      service.save(
        { hero: [{ imageMediaId: "8", mobileMediaId: "8" }] },
        1n,
        meta,
      ),
    ).resolves.toEqual({ id: 12n });

    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [8n] },
        status: MediaAssetStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true, mimeType: true },
    });
  });

  it("rejects a custom video module that references an image asset", async () => {
    const { service, prisma } = createService();
    prisma.mediaAsset.findMany.mockResolvedValue([{ id: 8n, mimeType: "image/webp" }]);

    await expect(
      service.save(
        {
          customModules: [
            { id: "factory-video", mediaType: "VIDEO", videoMediaId: "8" },
          ],
        },
        1n,
        meta,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("saves and resolves stage image references without changing service copy", async () => {
    const { service, prisma } = createService();
    const input = { customModules: [{ id: "home-service-process", mediaType: "IMAGE", body: { zh: "<ol><li>原有内容</li></ol>" }, stageImages: [{ imageMediaId: "8" }, { imageMediaId: null }, { imageMediaId: "9" }] }] };
    const assets = [{ id: 8n, mimeType: "image/webp" }, { id: 9n, mimeType: "image/jpeg" }];
    prisma.mediaAsset.findMany.mockResolvedValue(assets);
    prisma.page.findUnique.mockResolvedValue(null);
    prisma.page.upsert.mockResolvedValue({ id: 12n });
    await service.save(input, 1n, meta);
    const calls = prisma.page.upsert.mock.calls as Array<[{ update: { content: { customModules: unknown[] } } }]>;
    expect(calls[0]?.[0].update.content.customModules[0]).toMatchObject(input.customModules[0]!);
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith({ where: { id: { in: [8n, 9n] }, status: MediaAssetStatus.ACTIVE, deletedAt: null }, select: { id: true, mimeType: true } });
    prisma.page.findFirst.mockResolvedValue({ content: input });
    expect(await service.public()).toMatchObject({ media: { 8: assets[0], 9: assets[1] } });
  });

  it("rejects video and unavailable assets used as service stage photos", async () => {
    const { service, prisma } = createService();
    const input = { customModules: [{ id: "home-service-process", mediaType: "IMAGE", stageImages: [{ imageMediaId: "8" }] }] };
    prisma.mediaAsset.findMany.mockResolvedValue([{ id: 8n, mimeType: "video/mp4" }]);
    await expect(service.save(input, 1n, meta)).rejects.toBeInstanceOf(BadRequestException);
    prisma.mediaAsset.findMany.mockResolvedValue([]);
    await expect(service.save(input, 1n, meta)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.page.upsert).not.toHaveBeenCalled();
  });

  it("publishes saved content and records the audit event", async () => {
    const { service, prisma, audit, cache } = createService();
    const current = { id: 12n, slug: "homepage-content", status: ContentStatus.DRAFT };
    const published = { ...current, status: ContentStatus.PUBLISHED };
    prisma.page.findUnique.mockResolvedValue(current);
    prisma.page.update.mockResolvedValue(published);

    await expect(service.publish(1n, meta)).resolves.toEqual(published);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "publish", resourceType: "homepage_content" }));
    expect(cache.invalidateAll).toHaveBeenCalledTimes(1);
  });

  it("returns published content with resolved active media only", async () => {
    const { service, prisma, defaults } = createService();
    prisma.page.findFirst.mockResolvedValue({ content: { hero: [{ imageMediaId: "8" }] } });
    prisma.mediaAsset.findMany.mockResolvedValue([{ id: 8n, url: "https://cdn.example/hero.jpg", status: MediaAssetStatus.ACTIVE }]);

    const result = await service.public();
    expect(result).toMatchObject({
      content: {
        managed: true,
        hero: [{ imageMediaId: "8" }],
      },
      media: { 8: { id: 8n, url: "https://cdn.example/hero.jpg", status: MediaAssetStatus.ACTIVE } },
    });
    expect(defaults.ensure).toHaveBeenCalledTimes(1);
  });

  it("returns resolved media with the admin editing payload", async () => {
    const { service, prisma, defaults } = createService();
    prisma.page.findUnique.mockResolvedValue({
      id: 8n,
      content: { managed: true, hero: [{ imageMediaId: "9" }] },
    });
    prisma.mediaAsset.findMany.mockResolvedValue([
      { id: 9n, originalName: "hero.webp", url: "https://cdn.example/hero.webp" },
    ]);

    const result = await service.admin();
    expect(result).toMatchObject({
      id: 8n,
      content: {
        managed: true,
        hero: [{ imageMediaId: "9" }],
      },
      media: {
        9: {
          id: 9n,
          originalName: "hero.webp",
          url: "https://cdn.example/hero.webp",
        },
      },
    });
    expect(defaults.ensure).toHaveBeenCalledTimes(1);
  });
});
