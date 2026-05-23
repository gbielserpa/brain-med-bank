
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS hint text;

CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own notes" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own notes" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own notes" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own notes" ON public.notes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER notes_set_updated_at BEFORE UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS notes_user_idx ON public.notes(user_id, created_at DESC);
