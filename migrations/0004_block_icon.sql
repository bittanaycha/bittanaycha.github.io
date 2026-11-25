-- The glyph that marks a season in the strip. Text, so any emoji or character
-- will do; empty means the bar carries only its name.
ALTER TABLE `blocks` ADD COLUMN `icon` text DEFAULT '' NOT NULL;
UPDATE `blocks` SET `icon` = '🏃' WHERE `id` = 'marathon';
UPDATE `blocks` SET `icon` = '🎻' WHERE `id` = 'fiddle';
UPDATE `blocks` SET `icon` = '🌿' WHERE `id` = 'natural-history';
