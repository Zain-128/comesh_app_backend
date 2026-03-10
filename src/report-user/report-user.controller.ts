import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ReportUserService } from './report-user.service';
import { CreateReportUserDto } from './dto/create-report-user.dto';
import { UpdateReportUserDto } from './dto/update-report-user.dto';
import { AuthGuard } from 'src/guards/auth.guard';
import { IGetUserAuthInfoRequest } from 'src/interfaces';

@Controller('report-user')
export class ReportUserController {
  constructor(private readonly reportUserService: ReportUserService) {}

  @Post()
  @UseGuards(AuthGuard)
  create(
    @Body() createReportUserDto: CreateReportUserDto,
    @Req() req: IGetUserAuthInfoRequest,
  ) {
    let body = {
      userId: req.user._id,
      ...createReportUserDto,
    };

    return this.reportUserService.create(body);
  }

  @Get()
  findAll(@Req() req: IGetUserAuthInfoRequest) {
    return this.reportUserService.findAll(req);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reportUserService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateReportUserDto: UpdateReportUserDto,
  ) {
    return this.reportUserService.update(+id, updateReportUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reportUserService.remove(+id);
  }
}
