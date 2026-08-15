CREATE OR REPLACE FUNCTION note_property_text(p_note_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(string_agg(extracted, ' '), '')
  FROM (
    SELECT CASE jsonb_typeof(np.value)
      WHEN 'string' THEN np.value #>> '{}'
      WHEN 'number' THEN np.value #>> '{}'
      WHEN 'boolean' THEN np.value #>> '{}'
      WHEN 'array' THEN (
        SELECT string_agg(elem #>> '{}', ' ')
        FROM jsonb_array_elements(np.value) AS elem
      )
      WHEN 'object' THEN np.value::text
      ELSE ''
    END AS extracted
    FROM note_properties np
    WHERE np.note_id = p_note_id
  ) AS parts
  WHERE extracted IS NOT NULL AND extracted <> '';
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION note_search_vector(p_title text, p_body text, p_note_id uuid)
RETURNS tsvector
LANGUAGE sql
STABLE
AS $$
  SELECT
    setweight(to_tsvector('english', coalesce(p_title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(p_body, '')), 'B')
    || setweight(to_tsvector('english', note_property_text(p_note_id)), 'C');
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION notes_search_vector_before()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := note_search_vector(NEW.title, NEW.body, NEW.id);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION note_properties_search_vector_after()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.note_id;
  ELSE
    target_id := NEW.note_id;
  END IF;

  UPDATE notes
  SET search_vector = note_search_vector(title, body, id)
  WHERE id = target_id;

  RETURN NULL;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS notes_search_vector_before ON notes;
--> statement-breakpoint
CREATE TRIGGER notes_search_vector_before
BEFORE INSERT OR UPDATE OF title, body ON notes
FOR EACH ROW
EXECUTE FUNCTION notes_search_vector_before();
--> statement-breakpoint
DROP TRIGGER IF EXISTS note_properties_search_vector_after ON note_properties;
--> statement-breakpoint
CREATE TRIGGER note_properties_search_vector_after
AFTER INSERT OR UPDATE OR DELETE ON note_properties
FOR EACH ROW
EXECUTE FUNCTION note_properties_search_vector_after();
