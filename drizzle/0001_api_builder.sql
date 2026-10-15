CREATE TABLE "api_audit" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"api_id" uuid,
	"api_slug" text NOT NULL,
	"version" integer,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"summary" text NOT NULL,
	"before" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"collection" text NOT NULL,
	"slug" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"definition" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apis_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "api_audit" ADD CONSTRAINT "api_audit_api_id_apis_id_fk" FOREIGN KEY ("api_id") REFERENCES "public"."apis"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_records" ADD CONSTRAINT "api_records_version_id_api_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."api_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_versions" ADD CONSTRAINT "api_versions_api_id_apis_id_fk" FOREIGN KEY ("api_id") REFERENCES "public"."apis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_audit_api_id_idx" ON "api_audit" USING btree ("api_id");--> statement-breakpoint
CREATE INDEX "api_audit_created_at_idx" ON "api_audit" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "api_records_version_collection_slug_idx" ON "api_records" USING btree ("version_id","collection","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "api_versions_api_version_idx" ON "api_versions" USING btree ("api_id","version");