-- Whether a language is being used, or losing ground. The levels alone do not
-- say this: Japanese has an N1 and no practice.
ALTER TABLE `languages` ADD COLUMN `state` text DEFAULT '' NOT NULL;
