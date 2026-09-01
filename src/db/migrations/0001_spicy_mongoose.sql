CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `records` ADD `base` text;--> statement-breakpoint
--- 特调 and 其他 used to share one enum value. Existing rows carried the old
--- label, which no longer matches anything in METHODS, so their pill would lose
--- its colour and their ratio would stop computing.
UPDATE `records` SET `method` = '特调' WHERE `method` = '特调 & 其他';--> statement-breakpoint
--- Those rows recorded dose / yieldG / milk, which is the espresso shape.
UPDATE `records` SET `base` = '浓缩' WHERE `method` = '特调' AND `base` IS NULL;
