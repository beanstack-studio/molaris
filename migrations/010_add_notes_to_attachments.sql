-- Add notes column to attachments table
ALTER TABLE public.attachments
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment
COMMENT ON COLUMN public.attachments.notes IS 'Optional notes or description for the attachment';
