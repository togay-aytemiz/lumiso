-- Add cost_price and selling_price columns to services table
ALTER TABLE public.services 
ADD COLUMN cost_price numeric DEFAULT 0,
ADD COLUMN selling_price numeric DEFAULT 0;

-- Update existing services to use selling_price as the current price value
UPDATE public.services 
SET selling_price = COALESCE(price, 0)
WHERE selling_price = 0;

-- We'll keep the price column for backward compatibility but it will be deprecated
COMMENT ON COLUMN public.services.price IS 'Deprecated: Use selling_price instead';
COMMENT ON COLUMN public.services.cost_price IS 'Internal cost price for the service';
COMMENT ON COLUMN public.services.selling_price IS 'Selling price charged to clients';