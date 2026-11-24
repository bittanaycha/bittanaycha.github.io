-- Dose and target were notes, not plan: the slot says who, the dates say when.
ALTER TABLE `assignments` DROP COLUMN `dose`;
ALTER TABLE `assignments` DROP COLUMN `target`;
ALTER TABLE `blocks` DROP COLUMN `dose`;
ALTER TABLE `blocks` DROP COLUMN `target`;
