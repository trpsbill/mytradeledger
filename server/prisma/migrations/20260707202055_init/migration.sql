-- CreateEnum
CREATE TYPE "entry_type" AS ENUM ('BUY', 'SELL', 'FEE', 'DEPOSIT', 'WITHDRAWAL', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_access_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "last_four_chars" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "personal_access_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_currency" TEXT NOT NULL DEFAULT 'USD',
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
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
    "net_pnl" DECIMAL(24,12),
    "pnl_status" TEXT,
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
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "email_verification_token_token_hash_idx" ON "email_verification_token"("token_hash");

-- CreateIndex
CREATE INDEX "email_verification_token_user_id_idx" ON "email_verification_token"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_token_token_hash_idx" ON "password_reset_token"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_token_user_id_idx" ON "password_reset_token"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "personal_access_token_token_hash_key" ON "personal_access_token"("token_hash");

-- CreateIndex
CREATE INDEX "personal_access_token_token_hash_idx" ON "personal_access_token"("token_hash");

-- CreateIndex
CREATE INDEX "personal_access_token_user_id_idx" ON "personal_access_token"("user_id");

-- CreateIndex
CREATE INDEX "account_user_id_idx" ON "account"("user_id");

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
ALTER TABLE "email_verification_token" ADD CONSTRAINT "email_verification_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_token" ADD CONSTRAINT "password_reset_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_access_token" ADD CONSTRAINT "personal_access_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
