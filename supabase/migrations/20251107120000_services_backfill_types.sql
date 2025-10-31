-- Backfill existing services with coverage vs deliverable classification
-- and align the staffing flag for coverage rows.
DO $migration$
DECLARE
  coverage_category_list text[] := ARRAY[
    'coverage',
    'shoots',
    'sessions',
    'session',
    'team',
    'staff',
    'crew',
    'photography',
    'videography',
    'film crew',
    'event day',
    'wedding day',
    'ceremony',
    'reception',
    'drone',
    'live stream',
    'livestream',
    'photo booth'
  ];
  coverage_keyword_list text[] := ARRAY[
    'coverage',
    'shoot',
    'session',
    'assistant',
    'second shooter',
    'second photographer',
    'second videographer',
    'associate',
    'team',
    'staff',
    'crew',
    'photographer',
    'videographer',
    'camera operator',
    'filming',
    'capture',
    'drone',
    'live stream',
    'livestream',
    'photo booth',
    'on-site',
    'onsite',
    'makeup',
    'hair',
    'lighting',
    'sound',
    'extra hour',
    'additional hour',
    'hour of coverage',
    'hours of coverage',
    'overtime',
    'photo assistant',
    'video assistant',
    'lighting technician',
    'sound technician',
    'day-of coverage'
  ];
  deliverable_category_list text[] := ARRAY[
    'albums',
    'album',
    'prints',
    'print',
    'print sets',
    'digital',
    'digital products',
    'products',
    'deliverables',
    'retouching',
    'editing',
    'frames',
    'merch',
    'packages',
    'bundles',
    'slideshows'
  ];
  deliverable_keyword_list text[] := ARRAY[
    'album',
    'print',
    'canvas',
    'frame',
    'retouch',
    'edit',
    'touchup',
    'touch-up',
    'color grade',
    'color-grade',
    'grading',
    'usb',
    'drive',
    'box',
    'deliverable',
    'delivery',
    'gallery',
    'photobook',
    'photo book',
    'magazine',
    'poster',
    'card',
    'invitation',
    'slideshow',
    'preview',
    'proof',
    'digital download',
    'download',
    'file',
    'highlight clip',
    'highlight film',
    'highlight video',
    'teaser',
    'highlight reel',
    'instagram reel',
    'montage',
    'print box',
    'parent album',
    'mini album',
    'guest book',
    'folio',
    'wall art'
  ];

  coverage_matches integer;
  deliverable_matches integer;
BEGIN
  -- Pass 1: mark obvious deliverables so coverage heuristics do not override them.
  WITH deliverable_rows AS (
    SELECT id
    FROM public.services
    WHERE
      lower(coalesce(category, '')) = ANY(deliverable_category_list)
      OR EXISTS (
        SELECT 1
        FROM unnest(deliverable_keyword_list) AS keyword
        WHERE keyword <> ''
          AND (
            position(keyword IN lower(coalesce(name, ''))) > 0
            OR position(keyword IN lower(coalesce(description, ''))) > 0
          )
      )
  )
  UPDATE public.services AS svc
  SET
    service_type = 'deliverable',
    is_people_based = FALSE
  FROM deliverable_rows
  WHERE svc.id = deliverable_rows.id;

  GET DIAGNOSTICS deliverable_matches = ROW_COUNT;

  -- Pass 2: apply coverage classification when a row matches coverage heuristics
  -- and is not already identified as a deliverable.
  WITH coverage_rows AS (
    SELECT id
    FROM public.services
    WHERE (
      lower(coalesce(category, '')) = ANY(coverage_category_list)
      OR EXISTS (
        SELECT 1
        FROM unnest(coverage_keyword_list) AS keyword
        WHERE keyword <> ''
          AND (
            position(keyword IN lower(coalesce(name, ''))) > 0
            OR position(keyword IN lower(coalesce(description, ''))) > 0
          )
      )
    )
    AND NOT (
      lower(coalesce(category, '')) = ANY(deliverable_category_list)
      OR EXISTS (
        SELECT 1
        FROM unnest(deliverable_keyword_list) AS keyword
        WHERE keyword <> ''
          AND (
            position(keyword IN lower(coalesce(name, ''))) > 0
            OR position(keyword IN lower(coalesce(description, ''))) > 0
          )
      )
    )
  )
  UPDATE public.services AS svc
  SET
    service_type = 'coverage',
    is_people_based = TRUE
  FROM coverage_rows
  WHERE svc.id = coverage_rows.id;

  GET DIAGNOSTICS coverage_matches = ROW_COUNT;

  -- Final pass: ensure deliverables never keep a staffing flag by mistake.
  UPDATE public.services
  SET is_people_based = FALSE
  WHERE service_type = 'deliverable' AND is_people_based IS DISTINCT FROM FALSE;

  RAISE NOTICE 'Services classification backfill applied: % coverage rows updated, % deliverable rows updated. Current totals -> coverage: %, deliverable: %',
    coverage_matches,
    deliverable_matches,
    (SELECT count(*) FROM public.services WHERE service_type = 'coverage'),
    (SELECT count(*) FROM public.services WHERE service_type = 'deliverable');
END;
$migration$;
