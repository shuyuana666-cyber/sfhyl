import { Global, Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { LegacyVehicleImporterService } from './legacy-vehicle-importer.service';
import { PublicVehiclesService } from './public-vehicles.service';
import { VehiclesService } from './vehicles.service';

@Global()
@Module({
  controllers: [VehiclesController],
  providers: [VehiclesService, PublicVehiclesService, LegacyVehicleImporterService],
  exports: [VehiclesService, PublicVehiclesService],
})
export class VehiclesModule {}
