CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "colors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"hex" text NOT NULL,
	"family" text NOT NULL,
	"finish" text DEFAULT 'matt' NOT NULL,
	"collection" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "colors_hex" CHECK ("colors"."hex" ~ '^#[0-9A-F]{6}$'),
	CONSTRAINT "colors_family" CHECK ("colors"."family" in ('white', 'grey', 'beige', 'yellow', 'orange', 'red', 'pink', 'purple', 'blue', 'green', 'brown', 'black')),
	CONSTRAINT "colors_finish" CHECK ("colors"."finish" in ('matt', 'satin', 'gloss'))
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"keys" jsonb NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_unique" UNIQUE("endpoint","admin_id"),
	CONSTRAINT "push_subscriptions_lang" CHECK ("push_subscriptions"."lang" in ('en', 'ms'))
);
--> statement-breakpoint
CREATE TABLE "request_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"area_type" text NOT NULL,
	"label" text,
	"exterior" boolean DEFAULT false NOT NULL,
	"size_sqft" integer,
	"condition" text DEFAULT 'good' NOT NULL,
	"furnished" boolean DEFAULT false NOT NULL,
	"color_id" uuid,
	"color_name" text,
	"color_code" text,
	"color_hex" text,
	"original_photo_id" uuid,
	"snapshot_id" uuid,
	CONSTRAINT "request_areas_area_type" CHECK ("request_areas"."area_type" in ('living_room', 'bedroom', 'kitchen', 'bathroom', 'hallway', 'ceiling', 'exterior_wall', 'fence', 'doors_trim', 'other')),
	CONSTRAINT "request_areas_condition" CHECK ("request_areas"."condition" in ('good', 'patching', 'peeling'))
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"client_name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"town" text DEFAULT '' NOT NULL,
	"property_type" text NOT NULL,
	"preferred_dates" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"admin_notes" text DEFAULT '' NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"token_hash" text NOT NULL,
	"whatsapp_opened_at" timestamp with time zone,
	"consent_at" timestamp with time zone NOT NULL,
	"created_ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requests_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "requests_status" CHECK ("requests"."status" in ('new', 'contacted', 'quoted', 'won', 'lost')),
	CONSTRAINT "requests_property_type" CHECK ("requests"."property_type" in ('house', 'apartment', 'office', 'shop', 'industrial', 'other')),
	CONSTRAINT "requests_lang" CHECK ("requests"."lang" in ('en', 'ms'))
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"business_name" text DEFAULT 'Painting Services' NOT NULL,
	"whatsapp_number" text DEFAULT '' NOT NULL,
	CONSTRAINT "settings_single_row" CHECK ("settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"request_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_areas" ADD CONSTRAINT "request_areas_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_areas" ADD CONSTRAINT "request_areas_color_id_colors_id_fk" FOREIGN KEY ("color_id") REFERENCES "public"."colors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "colors_active_sort_idx" ON "colors" USING btree ("active","sort_order");--> statement-breakpoint
CREATE INDEX "request_areas_request_idx" ON "request_areas" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "requests_status_created_idx" ON "requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "requests_created_idx" ON "requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "uploads_orphans_idx" ON "uploads" USING btree ("request_id","created_at");