-- Languages get the same short glyph a season has. The default is a letter
-- from the language's own script; the editor accepts anything short.
ALTER TABLE languages ADD COLUMN icon text NOT NULL DEFAULT '';
UPDATE languages SET icon = '中' WHERE id = 'zh';
UPDATE languages SET icon = 'Ñ' WHERE id = 'es';
UPDATE languages SET icon = 'Ç' WHERE id = 'fr';
UPDATE languages SET icon = 'È' WHERE id = 'it';
UPDATE languages SET icon = 'あ' WHERE id = 'ja';
UPDATE languages SET icon = 'Ŵ' WHERE id = 'cy';
