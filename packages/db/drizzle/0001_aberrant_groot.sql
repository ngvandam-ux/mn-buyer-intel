CREATE TABLE "budget_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid,
	"program" text NOT NULL,
	"category_keys" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"fiscal_period" text,
	"fund" text,
	"amount" double precision,
	"prior_amount" double precision,
	"trend_delta" double precision,
	"narrative" text,
	"source_document_id" uuid,
	"confidence" real DEFAULT 1 NOT NULL,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "role_category" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "title_rank" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "authority_note" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "reports_to_contact_id" uuid;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "is_decision_maker" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "metro" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_lines_entity_idx" ON "budget_lines" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "budget_lines_period_idx" ON "budget_lines" USING btree ("fiscal_period");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_reports_to_contact_id_contacts_id_fk" FOREIGN KEY ("reports_to_contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;