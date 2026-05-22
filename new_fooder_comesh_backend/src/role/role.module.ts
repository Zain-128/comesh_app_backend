import { Module } from '@nestjs/common';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { RoleSchema } from './role.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Role', schema: RoleSchema }])],
  controllers: [RoleController],
  providers: [RoleService],
})
export class RoleModule {}
