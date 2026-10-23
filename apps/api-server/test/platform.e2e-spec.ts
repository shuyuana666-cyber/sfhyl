import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  AdminUserStatus,
  BannerStatus,
  ContentStatus,
  InquiryStatus,
  VehicleMediaType,
  VehicleType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import request, { type Response } from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { PublicCacheService } from "../src/infrastructure/cache/public-cache.service";
import { TranslationService } from "../src/translation/translation.service";

interface Envelope<T> {
  code: number;
  data: T;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface IdRecord {
  id: string;
}

interface PermissionRecord extends IdRecord {
  code: string;
}

interface RoleRecord extends IdRecord {
  code: string;
  permissions: Array<{ permission: PermissionRecord }>;
}

function data<T>(response: Response): T {
  const envelope = response.body as unknown as Envelope<T>;
  return envelope.data;
}

function expectStatus(response: Response, status: number): void {
  if (response.status !== status) {
    throw new Error(
      `Expected HTTP ${status}, received ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }
}

describe("SFHYL platform API", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken = "";
  let refreshToken = "";
  let readOnlyToken = "";
  let customerServiceToken = "";
  let testAdminId: bigint | null = null;
  let testUserId: bigint | null = null;
  let customerServiceUserId: bigint | null = null;
  let mediaId: bigint | null = null;
  let vehicleId: bigint | null = null;
  let bannerId: bigint | null = null;
  let inquiryId: bigint | null = null;
  let navigationId: bigint | null = null;
  let pageId: bigint | null = null;
  let recommendationId: bigint | null = null;
  let duplicateVehicleId: bigint | null = null;
  let categoryId: bigint | null = null;
  let originalShortName: unknown;

  const runId = Date.now().toString();
  const adminIdentifier = `e2e-admin-${runId}`;
  const adminEmail = `${adminIdentifier}@example.invalid`;
  const adminPassword = "AdminTestPassword123";
  const username = `e2e-reader-${runId}`;
  const email = `${username}@example.invalid`;
  const userPassword = "ReaderPassword123";
  const customerServiceUsername = `e2e-support-${runId}`;
  const customerServiceEmail = `${customerServiceUsername}@example.invalid`;
  const customerServicePassword = "SupportPassword123";
  const stockNo = `E2E-${runId}`;
  const vehicleSlug = `e2e-vehicle-${runId}`;
  const bannerKey = `e2e-banner-${runId}`;
  const inquiryEmail = `e2e-inquiry-${runId}@example.invalid`;
  const pageSlug = `e2e-page-${runId}`;
  const categorySlug = `e2e-category-${runId}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TranslationService)
      .useValue({
        translateChineseFields: async (fields: Record<string, string>) =>
          Object.fromEntries(
            Object.entries(fields).map(([key, value]) => [key, {
              en: `EN ${value}`,
              ru: `RU ${value}`,
            }]),
          ),
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: false,
      }),
    );
    app.setGlobalPrefix("api/v1", {
      exclude: ["health", "health/live", "health/ready"],
    });
    await app.init();
    prisma = app.get(PrismaService);
    const superAdminRole = await prisma.role.findUnique({
      where: { code: "super_admin" },
      select: { id: true },
    });
    if (!superAdminRole)
      throw new Error("The super_admin role must be seeded before e2e tests.");
    const testAdmin = await prisma.adminUser.create({
      data: {
        username: adminIdentifier,
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 10),
        displayName: "E2E Administrator",
        status: AdminUserStatus.ACTIVE,
        passwordChangedAt: new Date(),
        roles: { create: { roleId: superAdminRole.id } },
      },
      select: { id: true },
    });
    testAdminId = testAdmin.id;
    const shortName = await prisma.siteSetting.findUnique({
      where: { group_key: { group: "basic", key: "shortName" } },
    });
    originalShortName = shortName?.value;
  });

  afterAll(async () => {
    await prisma.inquiry.deleteMany({ where: { email: inquiryEmail } });
    if (recommendationId)
      await prisma.homepageRecommendation.deleteMany({
        where: { id: recommendationId },
      });
    if (pageId) await prisma.page.deleteMany({ where: { id: pageId } });
    if (navigationId)
      await prisma.navigationItem.deleteMany({ where: { id: navigationId } });
    if (duplicateVehicleId)
      await prisma.vehicle.deleteMany({ where: { id: duplicateVehicleId } });
    if (vehicleId)
      await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
    if (categoryId)
      await prisma.vehicleCategory.deleteMany({ where: { id: categoryId } });
    if (bannerId) await prisma.banner.deleteMany({ where: { id: bannerId } });
    if (mediaId) await prisma.mediaAsset.deleteMany({ where: { id: mediaId } });
    if (testUserId) {
      await prisma.refreshToken.deleteMany({
        where: { adminUserId: testUserId },
      });
      await prisma.adminUserRole.deleteMany({
        where: { adminUserId: testUserId },
      });
      await prisma.adminUser.deleteMany({ where: { id: testUserId } });
    }
    if (customerServiceUserId) {
      await prisma.refreshToken.deleteMany({
        where: { adminUserId: customerServiceUserId },
      });
      await prisma.adminUserRole.deleteMany({
        where: { adminUserId: customerServiceUserId },
      });
      await prisma.adminUser.deleteMany({
        where: { id: customerServiceUserId },
      });
    }
    if (testAdminId) {
      await prisma.refreshToken.deleteMany({
        where: { adminUserId: testAdminId },
      });
      await prisma.adminUserRole.deleteMany({
        where: { adminUserId: testAdminId },
      });
      await prisma.adminUser.deleteMany({ where: { id: testAdminId } });
    }
    if (originalShortName === undefined) {
      await prisma.siteSetting.deleteMany({
        where: { group: "basic", key: "shortName" },
      });
    } else {
      await prisma.siteSetting.update({
        where: { group_key: { group: "basic", key: "shortName" } },
        data: { value: originalShortName as never },
      });
    }
    await app.get(PublicCacheService).invalidateAll();
    await app.close();
  });

  it("exposes live and ready health checks", async () => {
    await request(app.getHttpServer()).get("/health/live").expect(200);
    await request(app.getHttpServer()).get("/health/ready").expect(200);
  });

  it("rejects an administrative request without a token", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/admin/vehicles")
      .expect(401);
  });

  it("rejects an incorrect password and accepts the correct password", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ identifier: adminIdentifier, password: "DefinitelyWrong123" })
      .expect(401);

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        identifier: adminIdentifier,
        password: adminPassword,
        remember: true,
      })
      .expect(201);
    const tokens = data<Tokens>(response);
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  it("rotates refresh tokens and rejects reuse", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken })
      .expect(201);
    const rotated = data<Tokens>(response);
    expect(rotated.refreshToken).not.toBe(refreshToken);
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken })
      .expect(401);
  });

  it("returns role permissions and blocks a read-only administrator from writing settings", async () => {
    const rolesResponse = await request(app.getHttpServer())
      .get("/api/v1/admin/roles")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const roles = data<RoleRecord[]>(rolesResponse);
    const readOnly = roles.find((role) => role.code === "read_only");
    const contentOperator = roles.find(
      (role) => role.code === "content_operator",
    );
    const customerService = roles.find(
      (role) => role.code === "customer_service",
    );
    expect(readOnly).toBeDefined();
    expect(
      contentOperator?.permissions.map(({ permission }) => permission.code),
    ).toEqual(
      expect.arrayContaining([
        "banner:create",
        "banner:update",
        "banner:delete",
      ]),
    );
    expect(
      customerService?.permissions.map(({ permission }) => permission.code),
    ).toEqual(
      expect.arrayContaining([
        "vehicle:view",
        "inquiry:update",
        "inquiry:assign",
        "inquiry:note",
        "inquiry:export",
      ]),
    );

    const permissionsResponse = await request(app.getHttpServer())
      .get("/api/v1/admin/permissions")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const permissionCodes = data<PermissionRecord[]>(permissionsResponse).map(
      ({ code }) => code,
    );
    expect(permissionCodes.length).toBeGreaterThan(40);
    expect(permissionCodes).toEqual(
      expect.arrayContaining([
        "vehicle:view",
        "banner:create",
        "banner:update",
        "banner:delete",
        "user:create",
        "user:update",
        "user:disable",
        "role:create",
        "role:update",
        "role:delete",
      ]),
    );

    const userResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        username,
        email,
        password: userPassword,
        roleIds: [readOnly!.id],
      })
      .expect(201);
    testUserId = BigInt(data<IdRecord>(userResponse).id);

    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ identifier: username, password: userPassword })
      .expect(201);
    readOnlyToken = data<Tokens>(loginResponse).accessToken;

    const customerServiceResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        username: customerServiceUsername,
        email: customerServiceEmail,
        password: customerServicePassword,
        roleIds: [customerService!.id],
      })
      .expect(201);
    customerServiceUserId = BigInt(data<IdRecord>(customerServiceResponse).id);
    const customerServiceLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        identifier: customerServiceUsername,
        password: customerServicePassword,
      })
      .expect(201);
    customerServiceToken = data<Tokens>(customerServiceLogin).accessToken;

    await request(app.getHttpServer())
      .patch("/api/v1/admin/settings/basic")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ settings: { shortName: "forbidden" } })
      .expect(403);
    await request(app.getHttpServer())
      .patch("/api/v1/admin/settings/basic")
      .set("Authorization", `Bearer ${customerServiceToken}`)
      .send({ settings: { shortName: "forbidden" } })
      .expect(403);
    await request(app.getHttpServer())
      .delete("/api/v1/admin/vehicles/1")
      .set("Authorization", `Bearer ${customerServiceToken}`)
      .expect(403);
  });

  it("updates website settings", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/public/site")
      .expect(200);
    const response = await request(app.getHttpServer())
      .patch("/api/v1/admin/settings/basic")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ settings: { shortName: "SFHYL E2E" } })
      .expect(200);
    expect(data<Record<string, unknown>>(response).shortName).toBe("SFHYL E2E");
    const publicResponse = await request(app.getHttpServer())
      .get("/api/v1/public/site")
      .expect(200);
    expect(
      data<{ settings: { basic: { shortName: string } } }>(publicResponse)
        .settings.basic.shortName,
    ).toBe("SFHYL E2E");
  });

  it("rejects a file whose bytes do not match an allowed media type", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/media/upload")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", Buffer.from("not a png"), {
        filename: "invalid.png",
        contentType: "image/png",
      })
      .expect(400);
  });

  it("uploads an image, creates and updates a vehicle, then publishes it", async () => {
    const categoryResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        nameZh: "测试分类",
        nameEn: "Test category",
        slug: categorySlug,
        sortOrder: 999,
      })
      .expect(201);
    categoryId = BigInt(data<IdRecord>(categoryResponse).id);

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFUlEQVR4nGPQiFrwnxjMMKpQg64KAfpv1OWfFw+RAAAAAElFTkSuQmCC",
      "base64",
    );
    const uploadResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/media/upload")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", png, { filename: "cover.png", contentType: "image/png" })
      .expect(201);
    mediaId = BigInt(data<IdRecord>(uploadResponse).id);

    const brandsResponse = await request(app.getHttpServer())
      .get("/api/v1/admin/brands")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const brand = data<IdRecord[]>(brandsResponse)[0];
    expect(brand).toBeDefined();

    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/vehicles")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        stockNo,
        type: VehicleType.USED,
        nameZh: "接口测试车辆",
        nameEn: "API test vehicle",
        slug: vehicleSlug,
        brandId: brand!.id,
        categoryId: categoryId.toString(),
        year: 2024,
        price: "100000.00",
        media: [
          {
            mediaId: mediaId.toString(),
            type: VehicleMediaType.GALLERY,
            sortOrder: 0,
          },
        ],
      })
      .expect(201);
    const created = data<IdRecord & { status: ContentStatus; coverMediaId: string }>(createResponse);
    vehicleId = BigInt(created.id);
    expect(created.status).toBe(ContentStatus.DRAFT);
    expect(created.coverMediaId).toBe(mediaId.toString());

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/categories/${categoryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(409);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/admin/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nameEn: "Updated API test vehicle" });
    expectStatus(updateResponse, 200);
    expect(data<{ nameEn: string }>(updateResponse).nameEn).toBe(
      "Updated API test vehicle",
    );

    const publishResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/vehicles/${vehicleId}/publish`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    expect(data<{ status: ContentStatus }>(publishResponse).status).toBe(
      ContentStatus.PUBLISHED,
    );
  });

  it("returns paginated public vehicles", async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/public/vehicles?page=1&pageSize=10&keyword=${encodeURIComponent("API test vehicle")}`,
      )
      .expect(200);
    const result = data<{
      items: Array<{ slug: string }>;
      pagination: { total: number };
    }>(response);
    expect(result.items.some((vehicle) => vehicle.slug === vehicleSlug)).toBe(
      true,
    );
    expect(result.pagination.total).toBeGreaterThan(0);
  });

  it("filters media by an inclusive creation date", async () => {
    if (!mediaId) throw new Error("The media upload scenario must run first.");
    const media = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: mediaId },
      select: { createdAt: true },
    });
    const date = media.createdAt.toISOString().slice(0, 10);
    const nextDateValue = new Date(`${date}T00:00:00.000Z`);
    nextDateValue.setUTCDate(nextDateValue.getUTCDate() + 1);
    const nextDate = nextDateValue.toISOString().slice(0, 10);

    const sameDayResponse = await request(app.getHttpServer())
      .get(`/api/v1/admin/media?createdFrom=${date}&createdTo=${date}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(
      data<{ items: IdRecord[] }>(sameDayResponse).items.some(
        (item) => item.id === mediaId!.toString(),
      ),
    ).toBe(true);

    const futureResponse = await request(app.getHttpServer())
      .get(`/api/v1/admin/media?createdFrom=${nextDate}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(
      data<{ items: IdRecord[] }>(futureResponse).items.some(
        (item) => item.id === mediaId!.toString(),
      ),
    ).toBe(false);
  });

  it("manages navigation and sanitized pages without granting write access to read-only users", async () => {
    const navigationResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/navigation")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        key: `e2e-${runId}`,
        labelZh: "测试页面",
        labelEn: "Test page",
        href: `/${pageSlug}`,
        sortOrder: 900,
      })
      .expect(201);
    navigationId = BigInt(data<IdRecord>(navigationResponse).id);

    await request(app.getHttpServer())
      .post("/api/v1/admin/pages")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({
        slug: pageSlug,
        titleZh: "拒绝",
        titleEn: "Denied",
        contentZh: "<p>Denied</p>",
      })
      .expect(403);

    const pageResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/pages")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        slug: pageSlug,
        titleZh: "接口测试页面",
        titleEn: "API test page",
        summaryZh: "页面摘要",
        contentZh: "<script>alert(1)</script><p>安全正文</p>",
        contentEn: "<p>Safe content</p>",
      })
      .expect(201);
    pageId = BigInt(data<IdRecord>(pageResponse).id);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/pages/${pageId}/publish`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    const publicPage = await request(app.getHttpServer())
      .get(`/api/v1/public/pages/${pageSlug}`)
      .expect(200);
    expect(JSON.stringify(data<unknown>(publicPage))).toContain("安全正文");
    expect(JSON.stringify(data<unknown>(publicPage))).not.toContain("<script");

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/pages/${pageId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/pages/${pageId}/restore`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
  });

  it("manages timed homepage recommendations", async () => {
    const section = await prisma.homepageSection.findFirstOrThrow({
      orderBy: { sortOrder: "asc" },
    });
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/recommendations")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        homepageSectionId: section.id.toString(),
        vehicleId: vehicleId!.toString(),
        label: "E2E pick",
        sortOrder: 990,
      })
      .expect(201);
    recommendationId = BigInt(data<IdRecord>(createResponse).id);

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/admin/recommendations?sectionId=${section.id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(
      data<IdRecord[]>(listResponse).some(
        ({ id }) => id === recommendationId!.toString(),
      ),
    ).toBe(true);
  });

  it("duplicates and exports vehicles", async () => {
    const duplicateResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/vehicles/${vehicleId}/duplicate`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    const duplicate = data<
      IdRecord & { status: ContentStatus; stockNo: string }
    >(duplicateResponse);
    duplicateVehicleId = BigInt(duplicate.id);
    expect(duplicate.status).toBe(ContentStatus.DRAFT);
    expect(duplicate.stockNo).toContain(stockNo);

    const exportResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/vehicles/export?keyword=${encodeURIComponent(stockNo)}`,
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect("Content-Type", /text\/csv/);
    expect(exportResponse.text).toContain(stockNo);
    expect(exportResponse.text).toContain("Updated API test vehicle");
  });

  it("validates, stores, deduplicates, and rate limits public inquiries", async () => {
    const endpoint = "/api/v1/public/inquiries";
    await request(app.getHttpServer())
      .post(endpoint)
      .send({ name: "No Contact", message: "Missing a contact method" })
      .expect(400);

    const payload = {
      name: "E2E Buyer",
      country: "Germany",
      companyName: "E2E Imports",
      email: inquiryEmail,
      vehicleId: vehicleId!.toString(),
      message: "<b>Please quote this vehicle</b>",
      sourcePage: `/vehicles/${vehicleSlug}`,
      utmSource: "e2e",
    };
    const submitResponse = await request(app.getHttpServer())
      .post(endpoint)
      .send(payload)
      .expect(201);
    inquiryId = BigInt(data<{ reference: string }>(submitResponse).reference);

    const stored = await prisma.inquiry.findUniqueOrThrow({
      where: { id: inquiryId },
    });
    expect(stored.message).toBe("Please quote this vehicle");
    expect(stored.vehicleId).toBe(vehicleId);
    expect(stored.clientIp).toBeTruthy();

    await request(app.getHttpServer()).post(endpoint).send(payload).expect(409);
    await request(app.getHttpServer())
      .post(endpoint)
      .send({ ...payload, message: "Unique request 1" })
      .expect(201);
    await request(app.getHttpServer())
      .post(endpoint)
      .send({ ...payload, message: "Unique request 2" })
      .expect(201);
    await request(app.getHttpServer())
      .post(endpoint)
      .send({ ...payload, message: "Unique request 3" })
      .expect(429);
  });

  it("lists, updates, annotates, assigns, and exports inquiries with RBAC", async () => {
    const listResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/inquiries?keyword=${encodeURIComponent(inquiryEmail)}`,
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const listed = data<{ items: IdRecord[]; pagination: { total: number } }>(
      listResponse,
    );
    expect(listed.pagination.total).toBe(3);
    expect(listed.items.some(({ id }) => id === inquiryId!.toString())).toBe(
      true,
    );

    await request(app.getHttpServer())
      .get(
        `/api/v1/admin/inquiries?keyword=${encodeURIComponent(inquiryEmail)}`,
      )
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .expect(200);
    const assigneesResponse = await request(app.getHttpServer())
      .get("/api/v1/admin/inquiries/assignees")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .expect(200);
    expect(
      data<Array<{ id: string; username: string }>>(assigneesResponse).some(
        ({ username: assignee }) => assignee === adminIdentifier,
      ),
    ).toBe(true);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/inquiries/${inquiryId}`)
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ status: InquiryStatus.CONTACTED })
      .expect(403);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/admin/inquiries/${inquiryId}`)
      .set("Authorization", `Bearer ${customerServiceToken}`)
      .send({ status: InquiryStatus.CONTACTED })
      .expect(200);
    expect(data<{ status: InquiryStatus }>(updateResponse).status).toBe(
      InquiryStatus.CONTACTED,
    );

    const noteResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/inquiries/${inquiryId}/notes`)
      .set("Authorization", `Bearer ${customerServiceToken}`)
      .send({ content: "<i>Called the buyer</i>" })
      .expect(201);
    expect(data<{ content: string }>(noteResponse).content).toBe(
      "Called the buyer",
    );

    const assignResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/inquiries/${inquiryId}/assign`)
      .set("Authorization", `Bearer ${customerServiceToken}`)
      .send({ assignedToId: testUserId!.toString(), note: "Primary owner" })
      .expect(201);
    expect(data<{ assignedToId: string }>(assignResponse).assignedToId).toBe(
      testUserId!.toString(),
    );

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/admin/inquiries/${inquiryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const detail = data<{
      vehicle: IdRecord;
      notes: unknown[];
      assignments: unknown[];
    }>(detailResponse);
    expect(detail.vehicle.id).toBe(vehicleId!.toString());
    expect(detail.notes).toHaveLength(1);
    expect(detail.assignments).toHaveLength(1);

    const exportResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/inquiries/export?keyword=${encodeURIComponent(inquiryEmail)}`,
      )
      .set("Authorization", `Bearer ${customerServiceToken}`)
      .expect(200)
      .expect("Content-Type", /text\/csv/);
    expect(exportResponse.text).toContain("E2E Buyer");
    expect(exportResponse.text).not.toContain("Called the buyer");
  });

  it("returns live dashboard statistics and filterable login logs", async () => {
    const dashboardResponse = await request(app.getHttpServer())
      .get("/api/v1/admin/dashboard?range=7")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const dashboard = data<{
      summary: { vehicleTotal: number; inquiryToday: number };
      inquiryTrend: unknown[];
      recentLogins: unknown[];
    }>(dashboardResponse);
    expect(dashboard.summary.vehicleTotal).toBeGreaterThanOrEqual(2);
    expect(dashboard.summary.inquiryToday).toBeGreaterThanOrEqual(3);
    expect(dashboard.inquiryTrend).toHaveLength(7);
    expect(dashboard.recentLogins.length).toBeGreaterThan(0);

    const customDashboardResponse = await request(app.getHttpServer())
      .get("/api/v1/admin/dashboard?range=custom&from=2026-07-01&to=2026-07-03")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(
      data<{ inquiryTrend: unknown[] }>(customDashboardResponse).inquiryTrend,
    ).toHaveLength(3);

    const loginLogsResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/login-logs?keyword=${encodeURIComponent(adminIdentifier)}`,
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(
      data<{ pagination: { total: number } }>(loginLogsResponse).pagination
        .total,
    ).toBeGreaterThan(0);
  });

  it("returns non-sensitive storage, mail, log, and runtime system information", async () => {
    const storageResponse = await request(app.getHttpServer())
      .get("/api/v1/admin/system/storage")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const storage = data<Record<string, unknown>>(storageResponse);
    expect(storage.driver).toBeTruthy();
    expect(JSON.stringify(storage).toLowerCase()).not.toContain("secret");
    expect(JSON.stringify(storage).toLowerCase()).not.toContain("accesskey");

    const mailResponse = await request(app.getHttpServer())
      .get("/api/v1/admin/system/mail")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const mail = data<Record<string, unknown>>(mailResponse);
    expect(mail).toHaveProperty("passwordConfigured");
    expect(mail).not.toHaveProperty("password");

    const logsResponse = await request(app.getHttpServer())
      .get("/api/v1/admin/system/logs?limit=20")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(Array.isArray(data<unknown[]>(logsResponse))).toBe(true);

    const infoResponse = await request(app.getHttpServer())
      .get("/api/v1/admin/system/info")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const info = data<Record<string, unknown>>(infoResponse);
    expect(info.application).toBe("@sfhyl/api-server");
    expect(info.nodeVersion).toBeTruthy();
  });

  it("moves referenced media through the recycle bin without deleting its object", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/media/${mediaId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const archived = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: mediaId! },
    });
    expect(archived.deletedAt).not.toBeNull();

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/media/${mediaId}/permanent`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/media/${mediaId}/restore`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    const restored = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: mediaId! },
    });
    expect(restored.deletedAt).toBeNull();
  });

  it("sorts banners", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/banners")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        key: bannerKey,
        titleEn: "E2E banner",
        status: BannerStatus.DRAFT,
        sortOrder: 999,
      })
      .expect(201);
    bannerId = BigInt(data<IdRecord>(createResponse).id);

    const listResponse = await request(app.getHttpServer())
      .get("/api/v1/admin/banners")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const banners = data<IdRecord[]>(listResponse);
    await request(app.getHttpServer())
      .put("/api/v1/admin/banners/sort")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        items: banners.map((banner, index) => ({
          id: banner.id,
          sortOrder: index * 10,
        })),
      })
      .expect(200);
  });

  it("soft deletes and restores a vehicle", async () => {
    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/v1/admin/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expectStatus(deleteResponse, 200);
    const deleted = await prisma.vehicle.findUniqueOrThrow({
      where: { id: vehicleId! },
    });
    expect(deleted.deletedAt).not.toBeNull();

    const restoreResponse = await request(app.getHttpServer())
      .post(`/api/v1/admin/vehicles/${vehicleId}/restore`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    expect(data<{ status: ContentStatus }>(restoreResponse).status).toBe(
      ContentStatus.DRAFT,
    );
  });
});
