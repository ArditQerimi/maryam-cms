CREATE TYPE "public"."discount_type" AS ENUM('Percentage', 'Fixed');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('Pending', 'Accepted', 'Expired', 'Revoked');--> statement-breakpoint
CREATE TYPE "public"."leave_status" AS ENUM('Applied', 'Approved', 'Rejected', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."payroll_status" AS ENUM('Draft', 'Paid', 'Partial');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('Ordered', 'Received', 'Pending', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('Pending', 'Completed', 'Cancelled', 'Returned');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('Active', 'Inactive', 'Archived', 'Pending', 'Suspended');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('Active', 'Inactive', 'Pending', 'Suspended');--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"clock_in" varchar(20),
	"clock_out" varchar(20),
	"production" varchar(20),
	"break_duration" varchar(20),
	"overtime" varchar(20),
	"total_hours" varchar(20),
	"status" varchar(20) DEFAULT 'Present',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authors" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"biography" text,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_account_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"account_type_id" integer,
	"account_holder_name" varchar(255) NOT NULL,
	"account_no" varchar(100) NOT NULL,
	"opening_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"company_name" varchar(255),
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"country" varchar(100),
	"postal_code" varchar(30),
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"commenter_name" varchar(255) NOT NULL,
	"comment" text NOT NULL,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_post_tags" (
	"company_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "blog_post_tags_company_id_post_id_tag_id_pk" PRIMARY KEY("company_id","post_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"category_id" integer,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"content" text,
	"author_name" varchar(255) NOT NULL,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"published_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"author_id" integer,
	"isbn" varchar(20),
	"publisher" varchar(255),
	"publication_date" timestamp,
	"language" varchar(100),
	"page_count" integer,
	"edition" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "book_details_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50),
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_discounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"discount_type" "discount_type" DEFAULT 'Percentage' NOT NULL,
	"discount_value" numeric(12, 2) NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"status" "status" DEFAULT 'Active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"state_id" integer NOT NULL,
	"country_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_countries" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(8) NOT NULL,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_faqs" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"category" varchar(255) NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"content" text,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"country_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_testimonials" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"author" varchar(255) NOT NULL,
	"role" varchar(255),
	"content" text NOT NULL,
	"rating" integer DEFAULT 5,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"address" text,
	"logo_url" text,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"code" varchar(100) NOT NULL,
	"discount_type" "discount_type" DEFAULT 'Percentage' NOT NULL,
	"discount_value" numeric(12, 2) NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"usage_limit" integer DEFAULT 0,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"country" varchar(100),
	"postal_code" varchar(30),
	"status" "status" DEFAULT 'Active' NOT NULL,
	"total_sales" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delete_account_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"requisition_date" timestamp NOT NULL,
	"delete_request_date" timestamp NOT NULL,
	"status" "status" DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"hod_name" varchar(255),
	"description" text,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "designations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"department_id" integer,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_leaves" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"leave_type_id" integer NOT NULL,
	"from_date" timestamp NOT NULL,
	"to_date" timestamp NOT NULL,
	"reason" text,
	"status" "leave_status" DEFAULT 'Applied' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"department_id" integer,
	"designation_id" integer,
	"shift_id" integer,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"emp_code" varchar(100) NOT NULL,
	"joining_date" timestamp,
	"salary" numeric(12, 2),
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"category" varchar(100) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reference" varchar(100),
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"feature_group" varchar(80) NOT NULL,
	"feature_key" varchar(80) NOT NULL,
	"label" varchar(140) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"code" varchar(100) NOT NULL,
	"initial_amount" numeric(12, 2) NOT NULL,
	"balance" numeric(12, 2) NOT NULL,
	"expiry_date" timestamp,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"from_date" timestamp NOT NULL,
	"to_date" timestamp NOT NULL,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"leave_quota" integer DEFAULT 0 NOT NULL,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" integer NOT NULL,
	"sender_user_id" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_thread_participants" (
	"thread_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"last_read_at" timestamp,
	CONSTRAINT "message_thread_participants_thread_id_user_id_pk" PRIMARY KEY("thread_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "message_threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"subject" varchar(255) NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "money_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"reference_number" varchar(100) NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"from_account_id" integer NOT NULL,
	"to_account_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" varchar(50) DEFAULT 'Bank Transfer',
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"user_limit" integer NOT NULL,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payrolls" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"pay_period" varchar(50) NOT NULL,
	"net_salary" numeric(12, 2) NOT NULL,
	"status" "payroll_status" DEFAULT 'Draft' NOT NULL,
	"paid_on" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(140) NOT NULL,
	"group_key" varchar(80) NOT NULL,
	"group_label" varchar(255) NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permission_definitions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "platform_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "product_discounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"discount_type" "discount_type" DEFAULT 'Percentage' NOT NULL,
	"discount_value" numeric(12, 2) NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"status" "status" DEFAULT 'Active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_stocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"min_stock_level" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"sku" varchar(100) NOT NULL,
	"barcode" varchar(100),
	"price" numeric(12, 2) NOT NULL,
	"cost_price" numeric(12, 2),
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer,
	"sub_category_id" integer,
	"brand_id" integer,
	"unit_id" integer,
	"store_id" integer,
	"warehouse_id" integer,
	"warranty_id" integer,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255),
	"sku" varchar(100),
	"barcode" varchar(100),
	"barcode_symbology" varchar(50),
	"item_code" varchar(100),
	"product_type" varchar(50),
	"price" numeric(12, 2),
	"cost_price" numeric(12, 2),
	"tax_rate" numeric(5, 2),
	"discount_type" varchar(50),
	"discount_value" numeric(12, 2),
	"stock_quantity" integer DEFAULT 0,
	"min_stock_level" integer DEFAULT 0,
	"manufactured_date" timestamp,
	"expiry_date" timestamp,
	"description" text,
	"image_url" text,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"purchase_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"cost_price" numeric(12, 2) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"supplier_id" integer,
	"warehouse_id" integer,
	"reference" varchar(100) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"status" "purchase_status" DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"sale_id" integer NOT NULL,
	"variant_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"customer_id" integer,
	"user_id" integer,
	"warehouse_id" integer,
	"reference" varchar(100) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0',
	"tax" numeric(12, 2) DEFAULT '0',
	"grand_total" numeric(12, 2) NOT NULL,
	"status" "sale_status" DEFAULT 'Pending' NOT NULL,
	"payment_method" varchar(50),
	"is_online" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings_store" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"key" varchar(140) NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"start_time" varchar(20),
	"end_time" varchar(20),
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"user_name" varchar(255),
	"email" varchar(255),
	"phone" varchar(50),
	"code" varchar(100),
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sub_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"package_id" integer NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"expiry_date" timestamp NOT NULL,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_role_permissions" (
	"tenant_role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_role_permissions_tenant_role_id_permission_id_pk" PRIMARY KEY("tenant_role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"short_name" varchar(50),
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"invited_by" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"tenant_role_id" integer NOT NULL,
	"status" "invitation_status" DEFAULT 'Pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"phone" varchar(50),
	"photo_url" text,
	"platform_role_id" integer,
	"tenant_role_id" integer,
	"status" "user_status" DEFAULT 'Active' NOT NULL,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "variant_attribute_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"attribute_id" integer NOT NULL,
	"value" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variant_attributes" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variant_options" (
	"variant_id" integer NOT NULL,
	"attribute_value_id" integer NOT NULL,
	CONSTRAINT "variant_options_variant_id_attribute_value_id_pk" PRIMARY KEY("variant_id","attribute_value_id")
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_person" varchar(255),
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"code" varchar(20),
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warranties" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"duration" varchar(100),
	"type" varchar(100),
	"status" "status" DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authors" ADD CONSTRAINT "authors_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_account_types" ADD CONSTRAINT "bank_account_types_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_account_type_id_bank_account_types_id_fk" FOREIGN KEY ("account_type_id") REFERENCES "public"."bank_account_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billers" ADD CONSTRAINT "billers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_categories" ADD CONSTRAINT "blog_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_tag_id_blog_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."blog_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_blog_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."blog_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_tags" ADD CONSTRAINT "blog_tags_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_details" ADD CONSTRAINT "book_details_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_details" ADD CONSTRAINT "book_details_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_details" ADD CONSTRAINT "book_details_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_discounts" ADD CONSTRAINT "category_discounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_discounts" ADD CONSTRAINT "category_discounts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_cities" ADD CONSTRAINT "cms_cities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_cities" ADD CONSTRAINT "cms_cities_state_id_cms_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."cms_states"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_cities" ADD CONSTRAINT "cms_cities_country_id_cms_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."cms_countries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_countries" ADD CONSTRAINT "cms_countries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_faqs" ADD CONSTRAINT "cms_faqs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_states" ADD CONSTRAINT "cms_states_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_states" ADD CONSTRAINT "cms_states_country_id_cms_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."cms_countries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_testimonials" ADD CONSTRAINT "cms_testimonials_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delete_account_requests" ADD CONSTRAINT "delete_account_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designations" ADD CONSTRAINT "designations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designations" ADD CONSTRAINT "designations_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_leaves" ADD CONSTRAINT "employee_leaves_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_leaves" ADD CONSTRAINT "employee_leaves_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_leaves" ADD CONSTRAINT "employee_leaves_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_designation_id_designations_id_fk" FOREIGN KEY ("designation_id") REFERENCES "public"."designations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_configurations" ADD CONSTRAINT "feature_configurations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_entries" ADD CONSTRAINT "message_entries_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_entries" ADD CONSTRAINT "message_entries_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_thread_participants" ADD CONSTRAINT "message_thread_participants_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_thread_participants" ADD CONSTRAINT "message_thread_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_transfers" ADD CONSTRAINT "money_transfers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_transfers" ADD CONSTRAINT "money_transfers_from_account_id_bank_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_transfers" ADD CONSTRAINT "money_transfers_to_account_id_bank_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_discounts" ADD CONSTRAINT "product_discounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_discounts" ADD CONSTRAINT "product_discounts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_stocks" ADD CONSTRAINT "product_stocks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_stocks" ADD CONSTRAINT "product_stocks_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_stocks" ADD CONSTRAINT "product_stocks_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sub_category_id_sub_categories_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "public"."sub_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_warranty_id_warranties_id_fk" FOREIGN KEY ("warranty_id") REFERENCES "public"."warranties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings_store" ADD CONSTRAINT "settings_store_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_categories" ADD CONSTRAINT "sub_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_categories" ADD CONSTRAINT "sub_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_role_permissions" ADD CONSTRAINT "tenant_role_permissions_tenant_role_id_tenant_roles_id_fk" FOREIGN KEY ("tenant_role_id") REFERENCES "public"."tenant_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_role_permissions" ADD CONSTRAINT "tenant_role_permissions_permission_id_permission_definitions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_tenant_role_id_tenant_roles_id_fk" FOREIGN KEY ("tenant_role_id") REFERENCES "public"."tenant_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_platform_role_id_platform_roles_id_fk" FOREIGN KEY ("platform_role_id") REFERENCES "public"."platform_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_role_id_tenant_roles_id_fk" FOREIGN KEY ("tenant_role_id") REFERENCES "public"."tenant_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_attribute_values" ADD CONSTRAINT "variant_attribute_values_attribute_id_variant_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."variant_attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_attributes" ADD CONSTRAINT "variant_attributes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_attribute_value_id_variant_attribute_values_id_fk" FOREIGN KEY ("attribute_value_id") REFERENCES "public"."variant_attribute_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "att_company_idx" ON "attendance_records" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "author_company_idx" ON "authors" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "bank_company_idx" ON "bank_accounts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "bank_company_created_at_idx" ON "bank_accounts" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_account_per_company" ON "bank_accounts" USING btree ("company_id","account_no");--> statement-breakpoint
CREATE INDEX "biller_company_idx" ON "billers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "biller_company_created_at_idx" ON "billers" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "blog_category_company_idx" ON "blog_categories" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_category_company_name_idx" ON "blog_categories" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "blog_comment_company_idx" ON "blog_comments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "blog_comment_company_created_idx" ON "blog_comments" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "blog_post_tag_company_idx" ON "blog_post_tags" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "blog_post_company_idx" ON "blog_posts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "blog_post_company_published_idx" ON "blog_posts" USING btree ("company_id","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_post_company_slug_idx" ON "blog_posts" USING btree ("company_id","slug");--> statement-breakpoint
CREATE INDEX "blog_tag_company_idx" ON "blog_tags" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_tag_company_name_idx" ON "blog_tags" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "book_details_company_idx" ON "book_details" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "book_details_product_idx" ON "book_details" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "brand_company_idx" ON "brands" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "cat_company_idx" ON "categories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "cms_city_company_idx" ON "cms_cities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "cms_city_state_idx" ON "cms_cities" USING btree ("state_id");--> statement-breakpoint
CREATE INDEX "cms_city_country_idx" ON "cms_cities" USING btree ("country_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_city_company_state_name_idx" ON "cms_cities" USING btree ("company_id","state_id","name");--> statement-breakpoint
CREATE INDEX "cms_country_company_idx" ON "cms_countries" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_country_company_name_idx" ON "cms_countries" USING btree ("company_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_country_company_code_idx" ON "cms_countries" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "cms_faq_company_idx" ON "cms_faqs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "cms_faq_company_created_idx" ON "cms_faqs" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "cms_page_company_idx" ON "cms_pages" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "cms_page_company_updated_idx" ON "cms_pages" USING btree ("company_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_page_company_slug_idx" ON "cms_pages" USING btree ("company_id","slug");--> statement-breakpoint
CREATE INDEX "cms_state_company_idx" ON "cms_states" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "cms_state_country_idx" ON "cms_states" USING btree ("country_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_state_company_country_name_idx" ON "cms_states" USING btree ("company_id","country_id","name");--> statement-breakpoint
CREATE INDEX "cms_testimonial_company_idx" ON "cms_testimonials" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "cms_testimonial_company_created_idx" ON "cms_testimonials" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "coupon_company_idx" ON "coupons" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_coupon_per_company" ON "coupons" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "cust_company_idx" ON "customers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "cust_company_created_at_idx" ON "customers" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "dept_company_idx" ON "departments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "desig_company_idx" ON "designations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "leave_company_idx" ON "employee_leaves" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "emp_company_idx" ON "employees" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_emp_code_per_company" ON "employees" USING btree ("company_id","emp_code");--> statement-breakpoint
CREATE INDEX "exp_company_idx" ON "expenses" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "exp_company_created_at_idx" ON "expenses" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "feature_cfg_company_group_key_idx" ON "feature_configurations" USING btree ("company_id","feature_group","feature_key");--> statement-breakpoint
CREATE INDEX "feature_cfg_company_group_idx" ON "feature_configurations" USING btree ("company_id","feature_group");--> statement-breakpoint
CREATE INDEX "giftcard_company_idx" ON "gift_cards" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_giftcard_per_company" ON "gift_cards" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "holiday_company_idx" ON "holidays" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "message_entry_thread_idx" ON "message_entries" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "message_entry_sender_idx" ON "message_entries" USING btree ("sender_user_id");--> statement-breakpoint
CREATE INDEX "message_thread_participant_user_idx" ON "message_thread_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_thread_company_idx" ON "message_threads" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "message_thread_updated_idx" ON "message_threads" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "transfer_company_idx" ON "money_transfers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "transfer_company_created_at_idx" ON "money_transfers" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "payroll_company_idx" ON "payrolls" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "stock_company_idx" ON "product_stocks" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wh_variant_unique" ON "product_stocks" USING btree ("warehouse_id","variant_id");--> statement-breakpoint
CREATE INDEX "variant_company_idx" ON "product_variants" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "prod_company_idx" ON "products" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "prod_company_store_idx" ON "products" USING btree ("company_id","store_id");--> statement-breakpoint
CREATE INDEX "prod_company_created_at_idx" ON "products" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "purchase_item_company_idx" ON "purchase_items" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "purch_company_idx" ON "purchases" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "purch_company_created_at_idx" ON "purchases" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "sale_item_company_idx" ON "sale_items" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sale_company_idx" ON "sales" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sale_company_user_idx" ON "sales" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "sale_company_created_at_idx" ON "sales" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_ref_idx" ON "sales" USING btree ("company_id","reference");--> statement-breakpoint
CREATE UNIQUE INDEX "company_key_idx" ON "settings_store" USING btree ("company_id","key");--> statement-breakpoint
CREATE INDEX "shift_company_idx" ON "shifts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "store_company_idx" ON "stores" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "store_company_created_at_idx" ON "stores" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "subcat_company_idx" ON "sub_categories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sub_company_idx" ON "subscriptions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sup_company_idx" ON "suppliers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sup_company_created_at_idx" ON "suppliers" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_role_per_company" ON "tenant_roles" USING btree ("name");--> statement-breakpoint
CREATE INDEX "unit_company_idx" ON "units" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "invite_company_idx" ON "user_invitations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "user_company_idx" ON "users" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "user_store_idx" ON "users" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "user_company_store_idx" ON "users" USING btree ("company_id","store_id");--> statement-breakpoint
CREATE INDEX "user_company_created_at_idx" ON "users" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "attr_company_idx" ON "variant_attributes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "wh_company_idx" ON "warehouses" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "wh_company_created_at_idx" ON "warehouses" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "warranty_company_idx" ON "warranties" USING btree ("company_id");