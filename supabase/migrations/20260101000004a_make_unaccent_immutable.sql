CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$func$
SELECT public.unaccent('public.unaccent', $1)
$func$;