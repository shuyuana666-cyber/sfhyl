import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { Public } from "../common/decorators/public.decorator";
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user";
import { ParseBigIntPipe } from "../common/pipes/parse-bigint.pipe";
import { requestMeta } from "../common/utils/request-meta";
import {
  AddInquiryNoteDto,
  AssignInquiryDto,
  BatchInquiryAssignDto,
  BatchInquiryStatusDto,
  UpdateInquiryDto,
} from "./dto/inquiry-actions.dto";
import { InquiryQueryDto } from "./dto/inquiry-query.dto";
import { InquiryNoteQueryDto } from "./dto/inquiry-note-query.dto";
import { SubmitInquiryDto } from "./dto/submit-inquiry.dto";
import { InquiriesService } from "./inquiries.service";
import { PublicInquiryService } from "./public-inquiry.service";

@ApiTags("inquiries")
@Controller()
export class InquiriesController {
  constructor(
    private readonly inquiries: InquiriesService,
    private readonly publicInquiries: PublicInquiryService,
  ) {}

  @Public()
  @Post("public/inquiries")
  submit(
    @Body() dto: SubmitInquiryDto,
    @Req() request: Request,
  ): Promise<{ submitted: true; reference: string }> {
    return this.publicInquiries.submit(
      dto,
      requestMeta(request),
      request.header("referer")?.slice(0, 2048) ?? null,
    );
  }

  @ApiBearerAuth()
  @Get("admin/inquiries")
  @RequirePermissions("inquiry:list")
  list(@Query() query: InquiryQueryDto): Promise<unknown> {
    return this.inquiries.list(query);
  }

  @ApiBearerAuth()
  @Get("admin/inquiries/export")
  @RequirePermissions("inquiry:export")
  async export(
    @Query() query: InquiryQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const csv = await this.inquiries.exportCsv(
      query,
      actor.id,
      requestMeta(request),
    );
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="inquiries-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    response.status(200).send(csv);
  }

  @ApiBearerAuth()
  @Get("admin/inquiries/assignees")
  @RequirePermissions("inquiry:list")
  assignees(): Promise<unknown> {
    return this.inquiries.assignees();
  }

  @ApiBearerAuth()
  @Get("admin/inquiries/notes")
  @RequirePermissions("inquiry:note")
  notes(@Query() query: InquiryNoteQueryDto): Promise<unknown> {
    return this.inquiries.notes(query);
  }

  @ApiBearerAuth()
  @Post("admin/inquiries/batch-status")
  @RequirePermissions("inquiry:update")
  batchStatus(
    @Body() dto: BatchInquiryStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ affected: number }> {
    return this.inquiries.batchStatus(dto, actor.id, requestMeta(request));
  }

  @ApiBearerAuth()
  @Post("admin/inquiries/batch-assign")
  @RequirePermissions("inquiry:assign")
  batchAssign(
    @Body() dto: BatchInquiryAssignDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ affected: number }> {
    return this.inquiries.batchAssign(dto, actor.id, requestMeta(request));
  }

  @ApiBearerAuth()
  @Get("admin/inquiries/:id")
  @RequirePermissions("inquiry:view")
  detail(@Param("id", ParseBigIntPipe) id: bigint): Promise<unknown> {
    return this.inquiries.detail(id);
  }

  @ApiBearerAuth()
  @Patch("admin/inquiries/:id")
  @RequirePermissions("inquiry:update")
  update(
    @Param("id", ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateInquiryDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.inquiries.update(id, dto, actor.id, requestMeta(request));
  }

  @ApiBearerAuth()
  @Post("admin/inquiries/:id/notes")
  @RequirePermissions("inquiry:note")
  addNote(
    @Param("id", ParseBigIntPipe) id: bigint,
    @Body() dto: AddInquiryNoteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.inquiries.addNote(id, dto, actor.id, requestMeta(request));
  }

  @ApiBearerAuth()
  @Post("admin/inquiries/:id/assign")
  @RequirePermissions("inquiry:assign")
  assign(
    @Param("id", ParseBigIntPipe) id: bigint,
    @Body() dto: AssignInquiryDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.inquiries.assign(id, dto, actor.id, requestMeta(request));
  }

  @ApiBearerAuth()
  @Delete("admin/inquiries/:id")
  @RequirePermissions("inquiry:update")
  async archive(
    @Param("id", ParseBigIntPipe) id: bigint,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ archived: true }> {
    await this.inquiries.archive(id, actor.id, requestMeta(request));
    return { archived: true };
  }
}
