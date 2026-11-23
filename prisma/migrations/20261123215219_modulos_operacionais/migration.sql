-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'KIOSK', 'OTHER');

-- CreateEnum
CREATE TYPE "InteractionStatus" AS ENUM ('PENDING', 'INTERESTED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('RECEIVED', 'AWAITING_PAYMENT', 'PAYMENT_CONFIRMED', 'IN_PREPARATION', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('CORREIOS', 'CAR', 'EXCURSION', 'PICKUP');

-- CreateTable
CREATE TABLE "kiosk_closings" (
    "id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "cash" INTEGER NOT NULL DEFAULT 0,
    "pix" INTEGER NOT NULL DEFAULT 0,
    "debit" INTEGER NOT NULL DEFAULT 0,
    "credit" INTEGER NOT NULL DEFAULT 0,
    "other" INTEGER NOT NULL DEFAULT 0,
    "debit_fee" INTEGER NOT NULL DEFAULT 0,
    "credit_fee" INTEGER NOT NULL DEFAULT 0,
    "credit_receive_date" DATE,
    "cash_account_id" TEXT,
    "pix_account_id" TEXT,
    "card_account_id" TEXT,
    "notes" TEXT,
    "entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kiosk_closings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "instagram" TEXT,
    "channel" "Channel" NOT NULL DEFAULT 'WHATSAPP',
    "city" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interactions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "date" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "InteractionStatus" NOT NULL DEFAULT 'PENDING',
    "attendant" TEXT,
    "follow_up_date" DATE,
    "order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_replies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "customer_id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "order_date" DATE NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'RECEIVED',
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "shipping_fee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "payment_method" "PaymentMethod",
    "account_id" TEXT,
    "paid_at" DATE,
    "attendant" TEXT,
    "delivery_method" "DeliveryMethod",
    "address" TEXT,
    "tracking_code" TEXT,
    "delivery_person" TEXT,
    "excursion_info" TEXT,
    "expected_delivery" DATE,
    "notes" TEXT,
    "entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "operation_id" TEXT,
    "salary" INTEGER NOT NULL,
    "payment_day" INTEGER NOT NULL,
    "hire_date" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_payments" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kiosk_closings_entry_id_key" ON "kiosk_closings"("entry_id");

-- CreateIndex
CREATE INDEX "kiosk_closings_date_idx" ON "kiosk_closings"("date");

-- CreateIndex
CREATE UNIQUE INDEX "kiosk_closings_operation_id_date_key" ON "kiosk_closings"("operation_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "products_name_key" ON "products"("name");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "interactions_date_idx" ON "interactions"("date");

-- CreateIndex
CREATE INDEX "interactions_status_idx" ON "interactions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_entry_id_key" ON "orders"("entry_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_order_date_idx" ON "orders"("order_date");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_idx" ON "order_status_history"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "salary_payments_entry_id_key" ON "salary_payments"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "salary_payments_employee_id_month_key" ON "salary_payments"("employee_id", "month");

-- AddForeignKey
ALTER TABLE "kiosk_closings" ADD CONSTRAINT "kiosk_closings_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosk_closings" ADD CONSTRAINT "kiosk_closings_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosk_closings" ADD CONSTRAINT "kiosk_closings_pix_account_id_fkey" FOREIGN KEY ("pix_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosk_closings" ADD CONSTRAINT "kiosk_closings_card_account_id_fkey" FOREIGN KEY ("card_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosk_closings" ADD CONSTRAINT "kiosk_closings_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restrições de integridade
ALTER TABLE "kiosk_closings" ADD CONSTRAINT "kiosk_closings_nonnegative"
  CHECK ("cash" >= 0 AND "pix" >= 0 AND "debit" >= 0 AND "credit" >= 0 AND "other" >= 0
     AND "debit_fee" >= 0 AND "credit_fee" >= 0 AND "debit_fee" <= "debit" AND "credit_fee" <= "credit");
ALTER TABLE "products" ADD CONSTRAINT "products_price_nonnegative" CHECK ("price" >= 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_positive" CHECK ("quantity" > 0 AND "unit_price" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_valid"
  CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "shipping_fee" >= 0 AND "total" = "subtotal" - "discount" + "shipping_fee" AND "total" >= 0);
ALTER TABLE "employees" ADD CONSTRAINT "employees_valid" CHECK ("salary" >= 0 AND "payment_day" BETWEEN 1 AND 31);
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_valid" CHECK ("amount" > 0 AND "month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
