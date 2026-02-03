CREATE TABLE "agent_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unassigned_at" timestamp with time zone,
	"reason_for_unassignment" text,
	"messages_handled" integer DEFAULT 0 NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"satisfaction" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"voice_provider" text DEFAULT 'none' NOT NULL,
	"voice_provider_id" text,
	"voice_provider_config" text,
	"system_prompt" text NOT NULL,
	"temperature" integer DEFAULT 70,
	"max_tokens" integer DEFAULT 2000,
	"model" text DEFAULT 'gpt-4' NOT NULL,
	"objectives" text,
	"escalation_rules" text,
	"allowed_actions" text,
	"knowledge_base" text,
	"assign_to_channels" text,
	"assign_to_campaigns" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"channel_type" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"credentials" text,
	"auto_reply" boolean DEFAULT true NOT NULL,
	"business_hours_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_agreement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"conversation_id" uuid,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contact_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_identifier" text,
	"source_metadata" text,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"interaction_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"company" text,
	"heat_score" integer DEFAULT 0 NOT NULL,
	"tags" text,
	"channel_preference" text,
	"timezone" text,
	"language" text DEFAULT 'es',
	"last_interaction_at" timestamp with time zone,
	"last_interaction_channel" text,
	"interaction_count" integer DEFAULT 0 NOT NULL,
	"lifetime_value" integer DEFAULT 0,
	"average_response_time" integer,
	"assigned_to_id" uuid,
	"custom_fields" text,
	"status" text DEFAULT 'active' NOT NULL,
	"merged_with_id" uuid,
	"merged_contact_ids" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"content_type" text DEFAULT 'text' NOT NULL,
	"channel" text NOT NULL,
	"external_id" text,
	"media_url" text,
	"media_mime_type" text,
	"generated_by_ai" boolean DEFAULT false NOT NULL,
	"model" text,
	"credits_used" integer,
	"action_triggered" text,
	"delivery_status" text,
	"error_message" text,
	"sent_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"channel" text NOT NULL,
	"handled_by_ai" boolean DEFAULT true NOT NULL,
	"transferred_to_human" boolean DEFAULT false NOT NULL,
	"transferred_to_id" uuid,
	"transfer_reason" text,
	"message_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone,
	"summary" text,
	"sentiment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "form_submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"data" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"referrer" text,
	"utm_params" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	"fields" text NOT NULL,
	"settings" text,
	"webhook_url" text,
	"email_notification" text,
	"views" integer DEFAULT 0 NOT NULL,
	"submissions" integer DEFAULT 0 NOT NULL,
	"conversion_rate" integer DEFAULT 0,
	"post_submit_action" text DEFAULT 'show_message' NOT NULL,
	"post_submit_config" text,
	"assign_to_agent_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category_id" uuid,
	"tags" text,
	"price" integer NOT NULL,
	"compare_at_price" integer,
	"currency" text DEFAULT 'usd' NOT NULL,
	"track_inventory" boolean DEFAULT true NOT NULL,
	"stock_quantity" integer DEFAULT 0,
	"low_stock_threshold" integer DEFAULT 10,
	"images" text,
	"active" boolean DEFAULT true NOT NULL,
	"external_id" text,
	"external_source" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"conversation_id" uuid,
	"contact_id" uuid NOT NULL,
	"agent_id" uuid,
	"direction" text NOT NULL,
	"from_number" text NOT NULL,
	"to_number" text NOT NULL,
	"provider" text NOT NULL,
	"provider_call_id" text,
	"provider_recording_url" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"duration" integer,
	"handled_by_ai" boolean DEFAULT true NOT NULL,
	"transcript" text,
	"summary" text,
	"cost_in_cents" integer,
	"credits_used" integer,
	"status" text DEFAULT 'queued' NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_assignment" ADD CONSTRAINT "agent_assignment_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_assignment" ADD CONSTRAINT "agent_assignment_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_assignment" ADD CONSTRAINT "agent_assignment_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_config" ADD CONSTRAINT "channel_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_agreement" ADD CONSTRAINT "contact_agreement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_agreement" ADD CONSTRAINT "contact_agreement_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_agreement" ADD CONSTRAINT "contact_agreement_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_note" ADD CONSTRAINT "contact_note_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_note" ADD CONSTRAINT "contact_note_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_note" ADD CONSTRAINT "contact_note_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_source" ADD CONSTRAINT "contact_source_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_assigned_to_id_user_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_merged_with_id_contact_id_fk" FOREIGN KEY ("merged_with_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_message" ADD CONSTRAINT "conversation_message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_message" ADD CONSTRAINT "conversation_message_sent_by_id_user_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_transferred_to_id_user_id_fk" FOREIGN KEY ("transferred_to_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submission" ADD CONSTRAINT "form_submission_form_id_form_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."form"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submission" ADD CONSTRAINT "form_submission_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form" ADD CONSTRAINT "form_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form" ADD CONSTRAINT "form_assign_to_agent_id_agent_id_fk" FOREIGN KEY ("assign_to_agent_id") REFERENCES "public"."agent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_parent_id_product_category_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."product_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_product_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_call" ADD CONSTRAINT "voice_call_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_call" ADD CONSTRAINT "voice_call_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_call" ADD CONSTRAINT "voice_call_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_call" ADD CONSTRAINT "voice_call_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_assignment_conversation_id_idx" ON "agent_assignment" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "agent_assignment_agent_id_idx" ON "agent_assignment" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_assignment_contact_id_idx" ON "agent_assignment" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "agent_assignment_assigned_at_idx" ON "agent_assignment" USING btree ("assigned_at");--> statement-breakpoint
CREATE INDEX "agent_organization_id_idx" ON "agent" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_type_idx" ON "agent" USING btree ("type");--> statement-breakpoint
CREATE INDEX "agent_active_idx" ON "agent" USING btree ("active");--> statement-breakpoint
CREATE INDEX "agent_org_active_idx" ON "agent" USING btree ("organization_id","active");--> statement-breakpoint
CREATE INDEX "channel_config_organization_id_idx" ON "channel_config" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_config_org_type_idx" ON "channel_config" USING btree ("organization_id","channel_type");--> statement-breakpoint
CREATE INDEX "contact_agreement_contact_id_idx" ON "contact_agreement" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contact_agreement_organization_id_idx" ON "contact_agreement" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contact_agreement_status_idx" ON "contact_agreement" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contact_agreement_type_idx" ON "contact_agreement" USING btree ("type");--> statement-breakpoint
CREATE INDEX "contact_note_contact_id_idx" ON "contact_note" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contact_note_created_by_id_idx" ON "contact_note" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "contact_note_type_idx" ON "contact_note" USING btree ("type");--> statement-breakpoint
CREATE INDEX "contact_source_contact_id_idx" ON "contact_source" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contact_source_type_idx" ON "contact_source" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "contact_source_identifier_idx" ON "contact_source" USING btree ("source_identifier");--> statement-breakpoint
CREATE INDEX "contact_source_contact_type_idx" ON "contact_source" USING btree ("contact_id","source_type");--> statement-breakpoint
CREATE INDEX "contact_organization_id_idx" ON "contact" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contact_heat_score_idx" ON "contact" USING btree ("heat_score");--> statement-breakpoint
CREATE INDEX "contact_email_idx" ON "contact" USING btree ("email");--> statement-breakpoint
CREATE INDEX "contact_phone_idx" ON "contact" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "contact_assigned_to_idx" ON "contact" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "contact_last_interaction_idx" ON "contact" USING btree ("last_interaction_at");--> statement-breakpoint
CREATE INDEX "contact_status_idx" ON "contact" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contact_org_heat_idx" ON "contact" USING btree ("organization_id","heat_score");--> statement-breakpoint
CREATE INDEX "conversation_message_conversation_id_idx" ON "conversation_message" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conversation_message_created_at_idx" ON "conversation_message" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "conversation_message_external_id_idx" ON "conversation_message" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "conversation_message_channel_idx" ON "conversation_message" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "conversation_message_conv_created_idx" ON "conversation_message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "conversation_organization_id_idx" ON "conversation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "conversation_contact_id_idx" ON "conversation" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "conversation_status_idx" ON "conversation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "conversation_channel_idx" ON "conversation" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "conversation_last_message_idx" ON "conversation" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "conversation_org_status_idx" ON "conversation" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "form_submission_form_id_idx" ON "form_submission" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "form_submission_contact_id_idx" ON "form_submission" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "form_submission_submitted_at_idx" ON "form_submission" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "form_organization_id_idx" ON "form" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "form_active_idx" ON "form" USING btree ("active");--> statement-breakpoint
CREATE INDEX "form_assign_to_agent_idx" ON "form" USING btree ("assign_to_agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "form_org_slug_idx" ON "form" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "product_category_organization_id_idx" ON "product_category" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "product_category_parent_id_idx" ON "product_category" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "product_organization_id_idx" ON "product" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "product_sku_idx" ON "product" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "product_category_id_idx" ON "product" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_active_idx" ON "product" USING btree ("active");--> statement-breakpoint
CREATE INDEX "product_external_id_idx" ON "product" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_org_sku_idx" ON "product" USING btree ("organization_id","sku");--> statement-breakpoint
CREATE INDEX "voice_call_organization_id_idx" ON "voice_call" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "voice_call_contact_id_idx" ON "voice_call" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "voice_call_agent_id_idx" ON "voice_call" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "voice_call_provider_call_id_idx" ON "voice_call" USING btree ("provider_call_id");--> statement-breakpoint
CREATE INDEX "voice_call_started_at_idx" ON "voice_call" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "voice_call_status_idx" ON "voice_call" USING btree ("status");--> statement-breakpoint
CREATE INDEX "voice_call_contact_started_idx" ON "voice_call" USING btree ("contact_id","started_at");