import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ count: totalQuestions }, { count: totalAttempts }, { data: lastAttempts }] = await Promise.all([
        supabase.from("questions").select("*", { count: "exact", head: true }),
        supabase.from("exam_attempts").select("*", { count: "exact", head: true }),
        supabase.from("exam_attempts").select("*").order("created_at", { ascending: false }).limit(5),
      ]);
      return { totalQuestions: totalQuestions ?? 0, totalAttempts: totalAttempts ?? 0, lastAttempts: lastAttempts ?? [] };
    },
  });

  if (loading || !user) return null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-serif text-4xl tracking-tight">Bem-vindo</h1>
      <p className="mt-2 text-muted-foreground">Seu banco pessoal de questões de residência médica.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Questões cadastradas</div>
          <div className="mt-1 font-serif text-4xl">{stats?.totalQuestions ?? "—"}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Provas realizadas</div>
          <div className="mt-1 font-serif text-4xl">{stats?.totalAttempts ?? "—"}</div>
        </Card>
        <Card className="flex flex-col gap-2 p-6">
          <div className="text-sm text-muted-foreground">Atalhos</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button asChild size="sm"><Link to="/exam">Iniciar prova</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/bank">Ver banco</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/settings">Cadastrar</Link></Button>
          </div>
        </Card>
      </div>

      {stats && stats.lastAttempts.length > 0 && (
        <div className="mt-10">
          <h2 className="font-serif text-2xl">Últimas provas</h2>
          <div className="mt-3 divide-y rounded-lg border bg-card">
            {stats.lastAttempts.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{new Date(a.created_at).toLocaleString("pt-BR")}</span>
                <span className="font-medium">{a.score} / {a.total} ({Math.round((a.score / a.total) * 100)}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
