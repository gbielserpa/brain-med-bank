import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Trash2, StickyNote, Pencil, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/notes")({ component: NotesPage });

function NotesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [newText, setNewText] = useState("");

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, content, question_id, created_at, questions(statement)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = notes.filter((n) => !search || n.content.toLowerCase().includes(search.toLowerCase()));

  async function addNote() {
    if (!user || !newText.trim()) return;
    const { error } = await supabase.from("notes").insert({ user_id: user.id, content: newText.trim() });
    if (error) return toast.error(error.message);
    setNewText("");
    qc.invalidateQueries({ queryKey: ["notes"] });
  }
  async function saveEdit(id: string) {
    const { error } = await supabase.from("notes").update({ content: editText.trim() }).eq("id", id);
    if (error) return toast.error(error.message);
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["notes"] });
  }
  async function remove(id: string) {
    if (!confirm("Excluir esta nota?")) return;
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["notes"] });
  }

  if (loading || !user) return null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-2">
        <StickyNote className="size-6 text-primary" />
        <h1 className="font-serif text-3xl">Minhas anotações</h1>
      </div>

      <Card className="mt-6 p-4">
        <Textarea rows={3} placeholder="Escrever nova anotação..."
          value={newText} onChange={(e) => setNewText(e.target.value)} />
        <div className="mt-2 flex justify-end">
          <Button onClick={addNote} disabled={!newText.trim()}>Adicionar nota</Button>
        </div>
      </Card>

      <div className="mt-6">
        <Input placeholder="Buscar nas anotações..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      <div className="mt-4 space-y-3">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma anotação ainda. As notas criadas durante a prova aparecem aqui.</p>
        )}
        {filtered.map((n) => (
          <Card key={n.id} className="p-4">
            {editingId === n.id ? (
              <>
                <Textarea rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(n.id)}><Check className="mr-1 size-4" /> Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                </div>
              </>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-sm">{n.content}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <div>
                    {new Date(n.created_at).toLocaleString("pt-BR")}
                    {n.question_id && n.questions?.statement && (
                      <> · <Link to="/bank/$id" params={{ id: n.question_id }} className="underline hover:text-foreground">
                        {n.questions.statement.slice(0, 60)}...
                      </Link></>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="size-7"
                      onClick={() => { setEditingId(n.id); setEditText(n.content); }}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => remove(n.id)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        ))}
      </div>
    </main>
  );
}
