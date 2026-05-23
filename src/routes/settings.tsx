import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { QuestionEditor } from "@/components/question-editor";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/settings")({ component: Settings });

function Settings() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | undefined>();
  const [shuffle, setShuffle] = useState<boolean>(() =>
    typeof window !== "undefined" && localStorage.getItem("residmed.shuffle") === "1"
  );

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const { data: questions = [] } = useQuery({
    queryKey: ["questions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, statement, specialty, institution, year, relevance, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = questions.filter((q: any) =>
    !search || q.statement.toLowerCase().includes(search.toLowerCase())
  );

  async function remove(id: string) {
    if (!confirm("Excluir esta questão?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Questão excluída.");
    qc.invalidateQueries({ queryKey: ["questions"] });
    if (editId === id) setEditId(undefined);
  }

  if (loading || !user) return null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-serif text-3xl">Configurações</h1>

      <Tabs defaultValue="register" className="mt-6">
        <TabsList>
          <TabsTrigger value="register">Cadastrar questões</TabsTrigger>
          <TabsTrigger value="account">Conta</TabsTrigger>
          <TabsTrigger value="prefs">Preferências</TabsTrigger>
        </TabsList>

        <TabsContent value="register" className="mt-6 space-y-6">
          <QuestionEditor editId={editId} onSaved={() => setEditId(undefined)} />

          <div>
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-xl">Suas questões ({filtered.length})</h2>
              <Input
                placeholder="Buscar no enunciado..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <div className="mt-3 space-y-2">
              {filtered.map((q: any) => (
                <Card key={q.id} className="flex items-start gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="line-clamp-2 text-sm">{q.statement}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[q.specialty, q.institution, q.year].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { setEditId(q.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(q.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </Card>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma questão cadastrada ainda.</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="account" className="mt-6">
          <Card className="p-6">
            <p className="text-sm">E-mail: <span className="font-medium">{user.email}</span></p>
            <Button className="mt-4" variant="outline" onClick={() => supabase.auth.signOut()}>Sair</Button>
          </Card>
        </TabsContent>

        <TabsContent value="prefs" className="mt-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Embaralhar alternativas no modo prova</Label>
                <p className="text-xs text-muted-foreground">Aleatoriza a ordem das alternativas ao iniciar a prova.</p>
              </div>
              <Switch
                checked={shuffle}
                onCheckedChange={(v) => {
                  setShuffle(v);
                  localStorage.setItem("residmed.shuffle", v ? "1" : "0");
                }}
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
