-- CreateEnum
CREATE TYPE "entry_type" AS ENUM ('BUY', 'SELL', 'FEE', 'DEPOSIT', 'WITHDRAWAL', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_currency" TEXT NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "precision" INTEGER NOT NULL DEFAULT 8,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entry" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "entry_type" "entry_type" NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantity" DECIMAL(24,12) NOT NULL,
    "price" DECIMAL(24,12) NOT NULL,
    "fee" DECIMAL(24,12),
    "value_base" DECIMAL(24,12) NOT NULL,
    "pnl" DECIMAL(24,12),
    "asset_id" TEXT,
    "reference_asset_id" TEXT,
    "fee_asset_id" TEXT,
    "external_ref" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_metadata" (
    "id" TEXT NOT NULL,
    "ledger_entry_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ledger_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_symbol_key" ON "asset"("symbol");

-- CreateIndex
CREATE INDEX "ledger_entry_account_id_idx" ON "ledger_entry"("account_id");

-- CreateIndex
CREATE INDEX "ledger_entry_timestamp_idx" ON "ledger_entry"("timestamp");

-- CreateIndex
CREATE INDEX "ledger_entry_symbol_idx" ON "ledger_entry"("symbol");

-- CreateIndex
CREATE INDEX "ledger_entry_entry_type_idx" ON "ledger_entry"("entry_type");

-- CreateIndex
CREATE INDEX "ledger_metadata_ledger_entry_id_idx" ON "ledger_metadata"("ledger_entry_id");

-- CreateIndex
CREATE INDEX "ledger_metadata_key_idx" ON "ledger_metadata"("key");

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_reference_asset_id_fkey" FOREIGN KEY ("reference_asset_id") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_fee_asset_id_fkey" FOREIGN KEY ("fee_asset_id") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_metadata" ADD CONSTRAINT "ledger_metadata_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "ledger_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
