import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { QuestionEditor } from "@/components/question-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSignedImageUrl } from "@/lib/image";
import { sanitizeHtml } from "@/lib/sanitize";

export const Route = createFileRoute("/bank/$id")({ component: BankDetail });

function BankDetail() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const { data: q, refetch } = useQuery({
    queryKey: ["question", id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("questions").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (q?.image_url) getSignedImageUrl(q.image_url).then(setImageUrl);
    else setImageUrl(null);
  }, [q?.image_url]);

  if (loading || !user || !q) return null;

  if (editing) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Button variant="ghost" onClick={() => setEditing(false)} className="mb-4">← Cancelar edição</Button>
        <QuestionEditor editId={id} onSaved={() => { setEditing(false); refetch(); }} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/bank" className="text-sm text-muted-foreground hover:text-foreground">← Voltar ao banco</Link>

      <Card className="mt-4 p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {q.specialty && <Badge variant="secondary">{q.specialty}</Badge>}
          {q.institution && <Badge variant="outline">{q.institution}{q.year ? ` ${q.year}` : ""}</Badge>}
          {q.tags?.map((t: string) => <Badge key={t} variant="outline">#{t}</Badge>)}
        </div>

        <p className="font-serif text-lg leading-relaxed whitespace-pre-wrap">{q.statement}</p>

        {imageUrl && <img src={imageUrl} alt="" className="mt-4 max-h-96 rounded-md border" />}

        <ol className="mt-6 space-y-2">
          {(q.alternatives as any[]).map((a) => (
            <li key={a.letter} className={`rounded-md border p-3 text-sm ${a.letter === q.correct_letter ? "border-primary bg-primary/5" : ""}`}>
              <span className="font-mono mr-2">{a.letter})</span>{a.text}
              {a.letter === q.correct_letter && <span className="ml-2 text-xs text-primary font-medium">✓ correta</span>}
            </li>
          ))}
        </ol>

        {q.explanation && (
          <div className="mt-6 rounded-md border bg-muted/30 p-4">
            <h3 className="text-sm font-medium">Comentário</h3>
            <div className="mt-1 prose prose-sm max-w-none text-sm text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.explanation) }} />
          </div>
        )}

        {(q as any).hint && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <span className="font-medium">Dica: </span>{(q as any).hint}
          </div>
        )}

        <Button className="mt-6" onClick={() => setEditing(true)}>Editar questão</Button>
      </Card>
    </main>
  );
}
