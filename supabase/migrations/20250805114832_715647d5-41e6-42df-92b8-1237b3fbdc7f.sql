-- Add base_price to projects table
ALTER TABLE public.projects 
ADD COLUMN base_price DECIMAL(10,2) DEFAULT 0;

-- Add payment type to distinguish base price from manual payments
ALTER TABLE public.payments 
ADD COLUMN type TEXT NOT NULL DEFAULT 'manual' CHECK (type IN ('base_price', 'manual'));

-- Update existing payments to be manual type
UPDATE public.payments SET type = 'manual' WHERE type IS NULL;