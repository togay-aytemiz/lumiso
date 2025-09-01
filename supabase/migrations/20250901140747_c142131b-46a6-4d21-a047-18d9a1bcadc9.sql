-- First, let's see what triggers currently exist for leads and projects
SELECT 
  schemaname, 
  tablename, 
  triggername, 
  actiontiming, 
  actionstatement 
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE tablename IN ('leads', 'projects') 
  AND triggername LIKE '%assignment%';