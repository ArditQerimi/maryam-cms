CREATE TABLE "category_attributes" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"data_type" "attribute_data_type" DEFAULT 'string' NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_attribute_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"attribute_id" integer NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE INDEX "cat_attr_category_idx" ON "category_attributes" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX "attr_val_product_idx" ON "product_attribute_values" USING btree ("product_id");
--> statement-breakpoint
CREATE INDEX "attr_val_attribute_idx" ON "product_attribute_values" USING btree ("attribute_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "attr_val_product_attr_idx" ON "product_attribute_values" USING btree ("product_id", "attribute_id");
--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN IF EXISTS "company_id";
--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN IF EXISTS "company_id";
--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "company_id";
--> statement-breakpoint
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_attribute_id_category_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."category_attributes"("id") ON DELETE cascade ON UPDATE no action;