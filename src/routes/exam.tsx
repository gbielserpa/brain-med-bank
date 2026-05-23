import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getSignedImageUrl } from "@/lib/image";
import { toast } from "sonner";

export const Route = createFileRoute("/exam")({ component: Exam });

type Stage = "setup" | "run" | "result";
type Alt = { letter: string; text: string };
type Q = {
  id: string;
  statement: string;
  image_url: string | null;
  alternatives: Alt[];
  correct_letter: string;
  explanation: string | null;
  specialty: string | null;
  institution: string | null;
  year: number | null;
};

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Exam() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("setup");
  const [filters, setFilters] = useState({ specialty: "", institution: "", year: "", minRelevance: 0 });
  const [count, setCount] = useState(10);
  const [order, setOrder] = useState<"random" | "sequence">("random");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const { data: all = [] } = useQuery({
    queryKey: ["questions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("questions").select("*");
      if (error) throw error;
      return data as unknown as Q[];
    },
  });

  const pool = useMemo(() => all.filter((q) => {
    if (filters.specialty && q.specialty !== filters.specialty) return false;
    if (filters.institution && q.institution !== filters.institution) return false;
    if (filters.year && q.year?.toString() !== filters.year) return false;
    if ((q as any).relevance < filters.minRelevance) return false;
    return true;
  }), [all, filters]);

  const specialties = useMemo(() => [...new Set(all.map((q) => q.specialty).filter(Boolean))] as string[], [all]);
  const institutions = useMemo(() => [...new Set(all.map((q) => q.institution).filter(Boolean))] as string[], [all]);

  function start() {
    if (pool.length === 0) return toast.error("Nenhuma questão com esses filtros.");
    const shuffle = typeof window !== "undefined" && localStorage.getItem("residmed.shuffle") === "1";
    let selected = order === "random" ? shuffleArr(pool) : pool;
    selected = selected.slice(0, Math.min(count, selected.length));
    if (shuffle) {
      selected = selected.map((q) => ({ ...q, alternatives: shuffleArr(q.alternatives) }));
    }
    setQuestions(selected);
    setAnswers({});
    setIdx(0);
    setStage("run");
  }

  async function finish() {
    let s = 0;
    for (const q of questions) if (answers[q.id] === q.correct_letter) s++;
    setScore(s);
    setStage("result");
    if (user) {
      await supabase.from("exam_attempts").insert({
        user_id: user.id,
        score: s,
        total: questions.length,
        answers,
      });
    }
  }

  if (loading || !user) return null;

  if (stage === "setup") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-serif text-3xl">Modo prova</h1>
        <Card className="mt-6 space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Especialidade</Label>
              <select value={filters.specialty} onChange={(e) => setFilters({ ...filters, specialty: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Todas</option>
                {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label>Instituição</Label>
              <select value={filters.institution} onChange={(e) => setFilters({ ...filters, institution: e.target.value })} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Todas</option>
                {institutions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label>Ano</Label>
              <Input type="number" value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })} />
            </div>
            <div>
              <Label>Relevância mín.</Label>
              <Input type="number" min={0} max={5} value={filters.minRelevance} onChange={(e) => setFilters({ ...filters, minRelevance: parseInt(e.target.value || "0") })} />
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min={1} value={count} onChange={(e) => setCount(parseInt(e.target.value || "1"))} />
            </div>
            <div>
              <Label>Ordem</Label>
              <select value={order} onChange={(e) => setOrder(e.target.value as any)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="random">Aleatória</option>
                <option value="sequence">Sequencial</option>
              </select>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{pool.length} questões disponíveis com esses filtros.</p>
          <Button onClick={start} disabled={pool.length === 0}>Iniciar prova</Button>
        </Card>
      </main>
    );
  }

  if (stage === "run") {
    const q = questions[idx];
    const answered = Object.keys(answers).length;
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Questão {idx + 1} de {questions.length}</span>
          <span className="text-muted-foreground">{answered} respondidas</span>
        </div>
        <Progress value={((idx + 1) / questions.length) * 100} />
        <QuestionRunner
          key={q.id}
          q={q}
          selected={answers[q.id]}
          onSelect={(letter) => setAnswers({ ...answers, [q.id]: letter })}
        />
        <div className="mt-4 flex justify-between gap-2">
          <Button variant="outline" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>Anterior</Button>
          {idx < questions.length - 1 ? (
            <Button onClick={() => setIdx(idx + 1)}>Próxima</Button>
          ) : (
            <Button onClick={finish}>Finalizar</Button>
          )}
        </div>
      </main>
    );
  }

  // result
  const pct = Math.round((score / questions.length) * 100);
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Card className="p-8 text-center">
        <h1 className="font-serif text-3xl">Resultado</h1>
        <div className="mt-4 font-serif text-6xl text-primary">{score}/{questions.length}</div>
        <p className="mt-2 text-lg text-muted-foreground">{pct}% de acerto</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => setStage("setup")}>Nova prova</Button>
          <Button variant="outline" onClick={() => navigate({ to: "/" })}>Início</Button>
        </div>
      </Card>

      <h2 className="mt-8 font-serif text-2xl">Revisão</h2>
      <div className="mt-3 space-y-3">
        {questions.map((q, i) => {
          const user = answers[q.id];
          const ok = user === q.correct_letter;
          return (
            <Card key={q.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">Questão {i + 1}</span>
                <Badge variant={ok ? "default" : "destructive"}>{ok ? "Acertou" : "Errou"}</Badge>
              </div>
              <p className="mt-2 text-sm line-clamp-3">{q.statement}</p>
              <p className="mt-2 text-xs">
                Sua resposta: <span className="font-mono">{user ?? "—"}</span> · Gabarito: <span className="font-mono">{q.correct_letter}</span>
              </p>
              {q.explanation && <p className="mt-2 text-xs text-muted-foreground">{q.explanation}</p>}
            </Card>
          );
        })}
      </div>
    </main>
  );
}

function QuestionRunner({ q, selected, onSelect }: { q: Q; selected?: string; onSelect: (l: string) => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (q.image_url) getSignedImageUrl(q.image_url).then(setImageUrl);
    else setImageUrl(null);
  }, [q.image_url]);

  return (
    <Card className="mt-4 p-6">
      <p className="font-serif text-base leading-relaxed whitespace-pre-wrap">{q.statement}</p>
      {imageUrl && <img src={imageUrl} alt="" className="mt-4 max-h-80 rounded-md border" />}
      <div className="mt-6 space-y-2">
        {q.alternatives.map((a) => (
          <button
            key={a.letter}
            onClick={() => onSelect(a.letter)}
            className={`w-full rounded-md border p-3 text-left text-sm transition-colors ${selected === a.letter ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
          >
            <span className="font-mono mr-2">{a.letter})</span>{a.text}
          </button>
        ))}
      </div>
    </Card>
  );
}
