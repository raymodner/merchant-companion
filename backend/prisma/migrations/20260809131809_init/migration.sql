-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "preferred_country" VARCHAR(100),
    "preferred_state" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cell_paints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cell_key" VARCHAR(50) NOT NULL,
    "user_id" UUID,
    "painted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terrain_id" UUID,
    "region_id" UUID NOT NULL,

    CONSTRAINT "cell_paints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(30) NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "resource_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "resource_type_id" UUID NOT NULL,
    "icon" VARCHAR(20),
    "info" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terrains" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "icon" VARCHAR(10) NOT NULL,

    CONSTRAINT "terrains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "terrain_id" UUID NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resource_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "stars" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "resource_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_chain" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resource_id" UUID NOT NULL,
    "processed_name" VARCHAR(100) NOT NULL,
    "processed_category_id" UUID NOT NULL,
    "final1_name" VARCHAR(100),
    "final1_category_id" UUID,
    "final2_name" VARCHAR(100),
    "final2_category_id" UUID,

    CONSTRAINT "production_chain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "map_regions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "parent_id" UUID,
    "lat_min" DECIMAL(7,4) NOT NULL,
    "lat_max" DECIMAL(7,4) NOT NULL,
    "lng_min" DECIMAL(8,4) NOT NULL,
    "lng_max" DECIMAL(8,4) NOT NULL,
    "center_lat" DECIMAL(7,4),
    "center_lng" DECIMAL(8,4),
    "zoom" SMALLINT,

    CONSTRAINT "map_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tribes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "icon" VARCHAR(10) NOT NULL,

    CONSTRAINT "tribes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tribe_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(20) NOT NULL,

    CONSTRAINT "tribe_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tribe_markers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "placed_by" UUID NOT NULL,
    "tribe_id" UUID NOT NULL,
    "tribe_type_id" UUID NOT NULL,
    "region_id" UUID NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tribe_markers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_stages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "tier" SMALLINT NOT NULL DEFAULT 1,
    "icon" VARCHAR(10) NOT NULL,
    "population" INTEGER,
    "days_building" SMALLINT,

    CONSTRAINT "settlement_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_settlements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "region_id" UUID NOT NULL,
    "resource_type_id" UUID,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "name" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_public" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "player_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "cell_paints_lookup" ON "cell_paints"("region_id", "cell_key", "painted_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "resource_types_name_key" ON "resource_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "resources_name_key" ON "resources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "terrains_name_key" ON "terrains"("name");

-- CreateIndex
CREATE UNIQUE INDEX "locations_name_terrain_id_key" ON "locations"("name", "terrain_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_locations_resource_id_location_id_key" ON "resource_locations"("resource_id", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_chain_resource_id_key" ON "production_chain"("resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "tribes_name_key" ON "tribes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tribe_types_name_key" ON "tribe_types"("name");

-- CreateIndex
CREATE INDEX "tribe_markers_region" ON "tribe_markers"("region_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_stages_name_key" ON "settlement_stages"("name");

-- CreateIndex
CREATE INDEX "player_settlements_region" ON "player_settlements"("region_id");

-- AddForeignKey
ALTER TABLE "cell_paints" ADD CONSTRAINT "cell_paints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cell_paints" ADD CONSTRAINT "cell_paints_terrain_id_fkey" FOREIGN KEY ("terrain_id") REFERENCES "terrains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cell_paints" ADD CONSTRAINT "cell_paints_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "map_regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "resource_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_terrain_id_fkey" FOREIGN KEY ("terrain_id") REFERENCES "terrains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_locations" ADD CONSTRAINT "resource_locations_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_locations" ADD CONSTRAINT "resource_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_chain" ADD CONSTRAINT "production_chain_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_chain" ADD CONSTRAINT "production_chain_processed_category_id_fkey" FOREIGN KEY ("processed_category_id") REFERENCES "resource_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_chain" ADD CONSTRAINT "production_chain_final1_category_id_fkey" FOREIGN KEY ("final1_category_id") REFERENCES "resource_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_chain" ADD CONSTRAINT "production_chain_final2_category_id_fkey" FOREIGN KEY ("final2_category_id") REFERENCES "resource_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_regions" ADD CONSTRAINT "map_regions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "map_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tribe_markers" ADD CONSTRAINT "tribe_markers_placed_by_fkey" FOREIGN KEY ("placed_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tribe_markers" ADD CONSTRAINT "tribe_markers_tribe_id_fkey" FOREIGN KEY ("tribe_id") REFERENCES "tribes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tribe_markers" ADD CONSTRAINT "tribe_markers_tribe_type_id_fkey" FOREIGN KEY ("tribe_type_id") REFERENCES "tribe_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tribe_markers" ADD CONSTRAINT "tribe_markers_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "map_regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_settlements" ADD CONSTRAINT "player_settlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_settlements" ADD CONSTRAINT "player_settlements_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "settlement_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_settlements" ADD CONSTRAINT "player_settlements_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "map_regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_settlements" ADD CONSTRAINT "player_settlements_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "resource_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Expression unique index for map_regions upserts (COALESCE handles NULL parent_id)
CREATE UNIQUE INDEX "map_regions_name_parent_uidx"
  ON "map_regions" ("name", COALESCE("parent_id", '00000000-0000-0000-0000-000000000000'::uuid));
