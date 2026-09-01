CREATE TABLE `beans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`origin` text,
	`region` text,
	`farm` text,
	`variety` text,
	`process` text,
	`roast` text NOT NULL,
	`season` text,
	`agtron` text,
	`roast_date` text,
	`roaster` text,
	`flavor` text,
	`mine` integer DEFAULT true NOT NULL,
	`swatch` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_self` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`is_brew` integer DEFAULT false NOT NULL,
	`is_grinder` integer DEFAULT false NOT NULL,
	`gstep` real,
	`gmin` real,
	`gmax` real,
	`gdef` real,
	`gunit` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`mon` integer NOT NULL,
	`day` integer NOT NULL,
	`time` text NOT NULL,
	`drank_at_ms` integer NOT NULL,
	`method` text NOT NULL,
	`brand_id` text NOT NULL,
	`bean_id` text,
	`ice` integer,
	`rating` integer,
	`note` text DEFAULT '' NOT NULL,
	`photo` text,
	`gear` text,
	`grinder` text,
	`gunit` text,
	`dose` real,
	`water` real,
	`yield_g` real,
	`milk` real,
	`grind` real,
	`temp_c` integer,
	`sec` integer,
	`hours` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `records_drank_at_idx` ON `records` ("drank_at_ms" DESC);--> statement-breakpoint
CREATE INDEX `records_bean_idx` ON `records` (`bean_id`);--> statement-breakpoint
CREATE INDEX `records_brand_idx` ON `records` (`brand_id`);