CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "categories_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid,
	"office_id" uuid,
	"name" text NOT NULL,
	"title" text,
	"email" text,
	"phone" text,
	"source_document_id" uuid,
	"confidence" real DEFAULT 1 NOT NULL,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"entity_type" text NOT NULL,
	"jurisdiction" text DEFAULT 'MN' NOT NULL,
	"county" text,
	"city" text,
	"lat" double precision,
	"lng" double precision,
	"website" text,
	"source_document_id" uuid,
	"confidence" real DEFAULT 1 NOT NULL,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_spans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_document_id" uuid NOT NULL,
	"target_table" text NOT NULL,
	"target_id" uuid,
	"field" text NOT NULL,
	"locator" text NOT NULL,
	"raw_snippet" text NOT NULL,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_profile_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"entity_id" uuid,
	"score" real NOT NULL,
	"tier" text NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"source_document_id" uuid,
	"confidence" real DEFAULT 1 NOT NULL,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid,
	"office_id" uuid,
	"external_id" text,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'unknown' NOT NULL,
	"business_unit" text,
	"solicitation_type" text,
	"posted_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"url" text,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category_keys" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"embedding" jsonb,
	"source_document_id" uuid,
	"confidence" real DEFAULT 1 NOT NULL,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_categories" (
	"opportunity_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "opportunity_categories_opportunity_id_category_id_pk" PRIMARY KEY("opportunity_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "refresh_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"documents_fetched" integer DEFAULT 0 NOT NULL,
	"extractions_parsed" integer DEFAULT 0 NOT NULL,
	"records_upserted" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"capabilities" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"services" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"products" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"keywords" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"certifications" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"categories" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"geographies" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid,
	"opportunity_id" uuid,
	"signal_type" text NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"strength" real DEFAULT 0.5 NOT NULL,
	"observed_at" timestamp with time zone,
	"url" text,
	"source_document_id" uuid,
	"confidence" real DEFAULT 1 NOT NULL,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector_id" text NOT NULL,
	"url" text NOT NULL,
	"content_type" text NOT NULL,
	"body" text NOT NULL,
	"sha256" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_spans" ADD CONSTRAINT "evidence_spans_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_seller_profile_id_seller_profiles_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "public"."seller_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offices" ADD CONSTRAINT "offices_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offices" ADD CONSTRAINT "offices_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_categories" ADD CONSTRAINT "opportunity_categories_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_categories" ADD CONSTRAINT "opportunity_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_entity_idx" ON "contacts" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "contacts_office_idx" ON "contacts" USING btree ("office_id");--> statement-breakpoint
CREATE INDEX "entities_type_idx" ON "entities" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "entities_jurisdiction_idx" ON "entities" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "entities_name_idx" ON "entities" USING btree ("name");--> statement-breakpoint
CREATE INDEX "evidence_spans_doc_idx" ON "evidence_spans" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "evidence_spans_target_idx" ON "evidence_spans" USING btree ("target_table","target_id");--> statement-breakpoint
CREATE INDEX "matches_seller_idx" ON "matches" USING btree ("seller_profile_id");--> statement-breakpoint
CREATE INDEX "matches_target_idx" ON "matches" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "matches_tier_idx" ON "matches" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "offices_entity_idx" ON "offices" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "opportunities_entity_idx" ON "opportunities" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "opportunities_status_idx" ON "opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "opportunities_external_idx" ON "opportunities" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "opportunities_due_idx" ON "opportunities" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "refresh_jobs_connector_idx" ON "refresh_jobs" USING btree ("connector_id");--> statement-breakpoint
CREATE INDEX "refresh_jobs_status_idx" ON "refresh_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "signals_entity_idx" ON "signals" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "signals_opportunity_idx" ON "signals" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "signals_type_idx" ON "signals" USING btree ("signal_type");--> statement-breakpoint
CREATE INDEX "source_documents_connector_idx" ON "source_documents" USING btree ("connector_id");--> statement-breakpoint
CREATE INDEX "source_documents_sha_idx" ON "source_documents" USING btree ("sha256");