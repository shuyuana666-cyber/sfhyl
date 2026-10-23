import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdminUserStatus,
  Prisma,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { paginated } from "../common/interfaces/api-response";
import { sanitizePlainText } from "../common/security/sanitize-plain-text";
import type { RequestMeta } from "../common/utils/request-meta";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import type {
  AddInquiryNoteDto,
  AssignInquiryDto,
  BatchInquiryAssignDto,
  BatchInquiryStatusDto,
  UpdateInquiryDto,
} from "./dto/inquiry-actions.dto";
import type { InquiryQueryDto } from "./dto/inquiry-query.dto";
import type { InquiryNoteQueryDto } from "./dto/inquiry-note-query.dto";

const detailInclude = {
  vehicle: { include: { brand: true, coverMedia: true } },
  notes: {
    where: { deletedAt: null },
    include: {
      author: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  },
  assignments: {
    include: {
      assignedTo: { select: { id: true, username: true, displayName: true } },
      assignedBy: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: { assignedAt: "desc" },
  },
} satisfies Prisma.InquiryInclude;

@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: InquiryQueryDto): Promise<unknown> {
    const where = this.where(query);
    const orderBy = {
      [query.sortBy]: query.sortOrder,
    } as Prisma.InquiryOrderByWithRelationInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.inquiry.findMany({
        where,
        include: {
          vehicle: {
            select: {
              id: true,
              stockNo: true,
              nameZh: true,
              nameEn: true,
              slug: true,
            },
          },
          assignments: {
            where: { endedAt: null },
            take: 1,
            include: {
              assignedTo: {
                select: { id: true, username: true, displayName: true },
              },
            },
          },
          _count: { select: { notes: true } },
        },
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.inquiry.count({ where }),
    ]);
    return paginated(items, total, query.page, query.pageSize);
  }

  assignees(): Promise<unknown> {
    return this.prisma.adminUser.findMany({
      where: { status: AdminUserStatus.ACTIVE, deletedAt: null },
      select: { id: true, username: true, displayName: true },
      orderBy: [{ displayName: "asc" }, { username: "asc" }],
    });
  }

  async notes(query: InquiryNoteQueryDto): Promise<unknown> {
    const where: Prisma.InquiryNoteWhereInput = {
      deletedAt: null,
      isInternal: true,
      authorId: query.authorId ? BigInt(query.authorId) : undefined,
      inquiry: { deletedAt: null },
      createdAt:
        query.createdFrom || query.createdTo
          ? {
              gte: query.createdFrom ? new Date(query.createdFrom) : undefined,
              lte: query.createdTo
                ? this.endOfDate(query.createdTo)
                : undefined,
            }
          : undefined,
      ...(query.keyword
        ? {
            OR: [
              { content: { contains: query.keyword } },
              { inquiry: { name: { contains: query.keyword } } },
              { inquiry: { companyName: { contains: query.keyword } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.inquiryNote.findMany({
        where,
        include: {
          author: { select: { id: true, username: true, displayName: true } },
          inquiry: {
            select: {
              id: true,
              name: true,
              companyName: true,
              status: true,
              vehicle: { select: { stockNo: true, nameZh: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.inquiryNote.count({ where }),
    ]);
    return paginated(items, total, query.page, query.pageSize);
  }

  async detail(id: bigint): Promise<unknown> {
    const inquiry = await this.prisma.inquiry.findFirst({
      where: { id, deletedAt: null },
      include: detailInclude,
    });
    if (!inquiry) throw new NotFoundException("询盘不存在");
    return inquiry;
  }

  async update(
    id: bigint,
    dto: UpdateInquiryDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    const before = await this.active(id);
    const inquiry = await this.prisma.inquiry.update({
      where: { id },
      data: {
        status: dto.status,
        name: sanitizePlainText(dto.name),
        country: sanitizePlainText(dto.country),
        companyName: sanitizePlainText(dto.companyName),
        phone: sanitizePlainText(dto.phone),
        whatsapp: sanitizePlainText(dto.whatsapp),
        email: dto.email?.trim().toLowerCase(),
        message: sanitizePlainText(dto.message),
        updatedById: actorId,
      },
      include: detailInclude,
    });
    await this.audit.record({
      actorId,
      action: "update",
      resourceType: "inquiry",
      resourceId: id,
      beforeData: before,
      afterData: inquiry,
      meta,
    });
    return inquiry;
  }

  async addNote(
    id: bigint,
    dto: AddInquiryNoteDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    await this.active(id);
    const content = sanitizePlainText(dto.content);
    if (!content) throw new BadRequestException("备注不能为空");
    const note = await this.prisma.inquiryNote.create({
      data: {
        inquiryId: id,
        authorId: actorId,
        content,
        isInternal: dto.isInternal,
      },
      include: {
        author: { select: { id: true, username: true, displayName: true } },
      },
    });
    await this.audit.record({
      actorId,
      action: "note",
      resourceType: "inquiry",
      resourceId: id,
      afterData: note,
      meta,
    });
    return note;
  }

  async assign(
    id: bigint,
    dto: AssignInquiryDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<unknown> {
    const assignedToId = BigInt(dto.assignedToId);
    await this.assertAssignee(assignedToId);
    const assignment = await this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM inquiries WHERE id = ${id} AND deletedAt IS NULL FOR UPDATE
      `;
      if (rows.length !== 1) throw new NotFoundException("询盘不存在");
      await transaction.inquiryAssignment.updateMany({
        where: { inquiryId: id, endedAt: null },
        data: { endedAt: new Date() },
      });
      return transaction.inquiryAssignment.create({
        data: {
          inquiryId: id,
          assignedToId,
          assignedById: actorId,
          note: sanitizePlainText(dto.note),
        },
        include: {
          assignedTo: {
            select: { id: true, username: true, displayName: true },
          },
        },
      });
    });
    await this.audit.record({
      actorId,
      action: "assign",
      resourceType: "inquiry",
      resourceId: id,
      afterData: assignment,
      meta,
    });
    return assignment;
  }

  async batchStatus(
    dto: BatchInquiryStatusDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<{ affected: number }> {
    const ids = this.uniqueIds(dto.ids);
    this.assertUnique(dto.ids, ids);
    const affected = await this.prisma.$transaction(async (transaction) => {
      const count = await transaction.inquiry.count({
        where: { id: { in: ids }, deletedAt: null },
      });
      if (count !== ids.length) throw new NotFoundException("部分询盘不存在");
      const result = await transaction.inquiry.updateMany({
        where: { id: { in: ids }, deletedAt: null },
        data: { status: dto.status, updatedById: actorId },
      });
      return result.count;
    });
    await this.audit.record({
      actorId,
      action: "batch_status",
      resourceType: "inquiry",
      afterData: dto,
      meta,
    });
    return { affected };
  }

  async batchAssign(
    dto: BatchInquiryAssignDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<{ affected: number }> {
    const ids = this.uniqueIds(dto.ids);
    this.assertUnique(dto.ids, ids);
    const assignedToId = BigInt(dto.assignedToId);
    await this.assertAssignee(assignedToId);
    await this.prisma.$transaction(async (transaction) => {
      // All assignment writers lock the same parent rows first. Sort IDs so
      // overlapping batch requests acquire locks in a consistent order.
      const sortedIds = [...ids].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
      const rows = await transaction.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM inquiries
        WHERE id IN (${Prisma.join(sortedIds)}) AND deletedAt IS NULL
        ORDER BY id FOR UPDATE
      `;
      if (rows.length !== ids.length) throw new NotFoundException("部分询盘不存在");
      await transaction.inquiryAssignment.updateMany({
        where: { inquiryId: { in: ids }, endedAt: null },
        data: { endedAt: new Date() },
      });
      await transaction.inquiryAssignment.createMany({
        data: ids.map((inquiryId) => ({
          inquiryId,
          assignedToId,
          assignedById: actorId,
          note: sanitizePlainText(dto.note),
        })),
      });
    });
    await this.audit.record({
      actorId,
      action: "batch_assign",
      resourceType: "inquiry",
      afterData: dto,
      meta,
    });
    return { affected: ids.length };
  }

  async archive(id: bigint, actorId: bigint, meta: RequestMeta): Promise<void> {
    const before = await this.active(id);
    await this.prisma.inquiry.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actorId },
    });
    await this.audit.record({
      actorId,
      action: "archive",
      resourceType: "inquiry",
      resourceId: id,
      beforeData: before,
      meta,
    });
  }

  async exportCsv(
    query: InquiryQueryDto,
    actorId: bigint,
    meta: RequestMeta,
  ): Promise<string> {
    const rows = await this.prisma.inquiry.findMany({
      where: this.where(query),
      include: {
        vehicle: { select: { stockNo: true, nameEn: true } },
        assignments: {
          where: { endedAt: null },
          take: 1,
          include: { assignedTo: { select: { username: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });
    const header = [
      "ID",
      "Status",
      "Name",
      "Country",
      "Company",
      "Phone",
      "WhatsApp",
      "Email",
      "Vehicle",
      "Message",
      "Source",
      "Source Page",
      "Assignee",
      "Created At",
    ];
    const lines = rows.map((row) =>
      [
        row.id.toString(),
        row.status,
        row.name,
        row.country,
        row.companyName,
        row.phone,
        row.whatsapp,
        row.email,
        row.vehicle ? `${row.vehicle.stockNo} ${row.vehicle.nameEn}` : "",
        row.message,
        row.source,
        row.sourcePage,
        row.assignments[0]?.assignedTo.username ?? "",
        row.createdAt.toISOString(),
      ]
        .map(this.csvCell)
        .join(","),
    );
    await this.audit.record({
      actorId,
      action: "export",
      resourceType: "inquiry",
      summary: `Exported ${rows.length} inquiries`,
      meta,
    });
    return `\uFEFF${header.map(this.csvCell).join(",")}\r\n${lines.join("\r\n")}`;
  }

  private where(query: InquiryQueryDto): Prisma.InquiryWhereInput {
    return {
      deletedAt: null,
      status: query.status,
      source: query.source,
      vehicleId: query.vehicleId ? BigInt(query.vehicleId) : undefined,
      assignments: query.assigneeId
        ? { some: { assignedToId: BigInt(query.assigneeId), endedAt: null } }
        : undefined,
      createdAt:
        query.createdFrom || query.createdTo
          ? {
              gte: query.createdFrom ? new Date(query.createdFrom) : undefined,
              lte: query.createdTo ? new Date(query.createdTo) : undefined,
            }
          : undefined,
      ...(query.keyword
        ? {
            OR: [
              { name: { contains: query.keyword } },
              { email: { contains: query.keyword } },
              { phone: { contains: query.keyword } },
              { whatsapp: { contains: query.keyword } },
              { companyName: { contains: query.keyword } },
              { message: { contains: query.keyword } },
            ],
          }
        : {}),
    };
  }

  private endOfDate(value: string): Date {
    const date = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value))
      date.setUTCHours(23, 59, 59, 999);
    return date;
  }

  private async active(
    id: bigint,
  ): Promise<Prisma.InquiryGetPayload<{ include: typeof detailInclude }>> {
    const inquiry = await this.prisma.inquiry.findFirst({
      where: { id, deletedAt: null },
      include: detailInclude,
    });
    if (!inquiry) throw new NotFoundException("询盘不存在");
    return inquiry;
  }

  private async assertAssignee(id: bigint): Promise<void> {
    const user = await this.prisma.adminUser.findFirst({
      where: { id, status: AdminUserStatus.ACTIVE, deletedAt: null },
    });
    if (!user) throw new NotFoundException("负责人不存在或已停用");
  }

  private uniqueIds(values: string[]): bigint[] {
    return [...new Set(values)].map(BigInt);
  }

  private assertUnique(raw: string[], ids: bigint[]): void {
    if (raw.length !== ids.length)
      throw new BadRequestException("批量操作包含重复 ID");
  }

  private readonly csvCell = (value: unknown): string => {
    let text: string;
    if (value == null) text = "";
    else if (typeof value === "string") text = value;
    else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "bigint"
    )
      text = value.toString();
    else if (value instanceof Date) text = value.toISOString();
    else text = JSON.stringify(value);
    if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
}
