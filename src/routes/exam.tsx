import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { getSignedImageUrl } from "@/lib/image";
import { sanitizeHtml } from "@/lib/sanitize";
import { toast } from "sonner";
import { Lightbulb, Highlighter, StickyNote } from "lucide-react";

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
  hint: string | null;
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
  const [discarded, setDiscarded] = useState<Record<string, Set<string>>>({});
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
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
    if (shuffle) selected = selected.map((q) => ({ ...q, alternatives: shuffleArr(q.alternatives) }));
    setQuestions(selected);
    setAnswers({});
    setDiscarded({});
    setVisited(new Set([selected[0]?.id].filter(Boolean) as string[]));
    setSkipped(new Set());
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
        user_id: user.id, score: s, total: questions.length, answers,
      });
    }
  }

  const goNext = useCallback(() => {
    setIdx((i) => {
      const cur = questions[i];
      if (cur && !answers[cur.id]) setSkipped((s) => new Set(s).add(cur.id));
      const next = Math.min(questions.length - 1, i + 1);
      const nq = questions[next];
      if (nq) setVisited((v) => new Set(v).add(nq.id));
      return next;
    });
  }, [questions, answers]);

  const goPrev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);

  function answerQuestion(qid: string, letter: string) {
    setAnswers((prev) => ({ ...prev, [qid]: letter }));
    setSkipped((s) => {
      if (!s.has(qid)) return s;
      const n = new Set(s); n.delete(qid); return n;
    });
  }

  function toggleDiscard(qid: string, letter: string) {
    setDiscarded((prev) => {
      const cur = new Set(prev[qid] ?? []);
      if (cur.has(letter)) cur.delete(letter); else cur.add(letter);
      return { ...prev, [qid]: cur };
    });
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
              <select value={filters.specialty} onChange={(e) => setFilters({ ...filters, specialty: e.target.value })}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Todas</option>
                {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label>Instituição</Label>
              <select value={filters.institution} onChange={(e) => setFilters({ ...filters, institution: e.target.value })}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
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
              <Input type="number" min={0} max={5} value={filters.minRelevance}
                onChange={(e) => setFilters({ ...filters, minRelevance: parseInt(e.target.value || "0") })} />
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min={1} value={count} onChange={(e) => setCount(parseInt(e.target.value || "1"))} />
            </div>
            <div>
              <Label>Ordem</Label>
              <select value={order} onChange={(e) => setOrder(e.target.value as any)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="random">Aleatória</option>
                <option value="sequence">Sequencial</option>
              </select>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{pool.length} questões disponíveis com esses filtros.</p>
          <p className="text-xs text-muted-foreground">
            Atalhos: 1-5 alternativas · Espaço confirma · ←/→ navega · G grifa · X descarta · N nota
          </p>
          <Button onClick={start} disabled={pool.length === 0}>Iniciar prova</Button>
        </Card>
      </main>
    );
  }

  if (stage === "run") {
    const q = questions[idx];
    const answered = Object.keys(answers).length;
    const skippedCurrent = [...skipped].filter((id) => questions.some((qq) => qq.id === id)).length;
    const skippedTotal = visited.size - answered;

    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Questão {idx + 1} de {questions.length}</span>
          <div className="flex items-center gap-3">
            {skippedCurrent > 0 && (
              <span title={`Total puladas na sessão: ${Math.max(skippedTotal, skippedCurrent)}`}
                className="cursor-help text-xs text-amber-600">
                Puladas: {skippedCurrent}
              </span>
            )}
            <span className="text-muted-foreground">{answered} respondidas</span>
          </div>
        </div>
        <Progress value={((idx + 1) / questions.length) * 100} />
        <QuestionRunner
          key={q.id}
          q={q}
          selected={answers[q.id]}
          discarded={discarded[q.id] ?? new Set()}
          onSelect={(letter) => answerQuestion(q.id, letter)}
          onToggleDiscard={(l) => toggleDiscard(q.id, l)}
          onNext={goNext}
          onPrev={goPrev}
          isLast={idx === questions.length - 1}
          onFinish={finish}
        />
        <div className="mt-4 flex justify-between gap-2">
          <Button variant="outline" onClick={goPrev} disabled={idx === 0}>Anterior</Button>
          {idx < questions.length - 1 ? (
            <Button onClick={goNext}>Próxima</Button>
          ) : (
            <Button onClick={finish}>Finalizar</Button>
          )}
        </div>
      </main>
    );
  }

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
          const u = answers[q.id];
          const ok = u === q.correct_letter;
          return (
            <Card key={q.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">Questão {i + 1}</span>
                <Badge variant={ok ? "default" : "destructive"}>{ok ? "Acertou" : "Errou"}</Badge>
              </div>
              <p className="mt-2 text-sm line-clamp-3">{q.statement}</p>
              <p className="mt-2 text-xs">
                Sua resposta: <span className="font-mono">{u ?? "—"}</span> · Gabarito: <span className="font-mono">{q.correct_letter}</span>
              </p>
              {q.explanation && (
                <div className="mt-2 text-xs text-muted-foreground prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.explanation ?? "") }} />
              )}
            </Card>
          );
        })}
      </div>
    </main>
  );
}

function QuestionRunner({
  q, selected, discarded, onSelect, onToggleDiscard, onNext, onPrev, isLast, onFinish,
}: {
  q: Q; selected?: string; discarded: Set<string>;
  onSelect: (l: string) => void; onToggleDiscard: (l: string) => void;
  onNext: () => void; onPrev: () => void; isLast: boolean; onFinish: () => void;
}) {
  const { user } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const statementRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (q.image_url) getSignedImageUrl(q.image_url).then(setImageUrl);
    else setImageUrl(null);
    setShowHint(false);
    setHighlightMode(false);
    setNoteOpen(false);
    setNoteText("");
  }, [q.id, q.image_url]);

  // Highlight selected text via <mark>
  const doHighlight = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!statementRef.current?.contains(range.commonAncestorContainer)) return;
    const mark = document.createElement("mark");
    mark.style.backgroundColor = "hsl(48 96% 76% / 0.55)";
    mark.style.padding = "0 2px";
    mark.style.borderRadius = "2px";
    try { range.surroundContents(mark); sel.removeAllRanges(); } catch {}
  }, []);

  async function saveNote() {
    if (!user || !noteText.trim()) return;
    setSavingNote(true);
    try {
      const { error } = await supabase.from("notes").insert({
        user_id: user.id, question_id: q.id, content: noteText.trim(),
      });
      if (error) throw error;
      toast.success("Nota salva em 'Minhas anotações'.");
      setNoteOpen(false); setNoteText("");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSavingNote(false); }
  }

  // Hotkeys
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;

      const num = parseInt(e.key);
      if (num >= 1 && num <= q.alternatives.length) {
        e.preventDefault();
        onSelect(q.alternatives[num - 1].letter);
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        if (selected) (isLast ? onFinish() : onNext());
        return;
      }
      if (e.key === "ArrowRight") { e.preventDefault(); onNext(); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); onPrev(); return; }
      if (e.key.toLowerCase() === "g") {
        e.preventDefault();
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) doHighlight();
        else setHighlightMode((v) => !v);
        return;
      }
      if (e.key.toLowerCase() === "x" && selected) {
        e.preventDefault();
        onToggleDiscard(selected);
        return;
      }
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setNoteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q.alternatives, selected, isLast, onSelect, onNext, onPrev, onFinish, onToggleDiscard, doHighlight]);

  return (
    <Card className="mt-4 p-6">
      <div className="mb-3 flex items-center justify-end gap-1">
        <button title="Marca-texto (G)" onClick={() => setHighlightMode((v) => !v)}
          className={`rounded p-1.5 text-base transition-colors ${highlightMode ? "bg-amber-100 text-amber-700" : "text-muted-foreground hover:bg-muted"}`}>
          <Highlighter className="size-4" />
        </button>
        <button title="Adicionar nota (N)" onClick={() => setNoteOpen((v) => !v)}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted">
          <StickyNote className="size-4" />
        </button>
      </div>

      <p
        ref={statementRef}
        onMouseUp={() => { if (highlightMode) doHighlight(); }}
        className={`font-serif text-base leading-relaxed whitespace-pre-wrap ${highlightMode ? "cursor-text selection:bg-amber-200" : ""}`}>
        {q.statement}
      </p>

      {imageUrl && <img src={imageUrl} alt="" className="mt-4 max-h-80 rounded-md border" />}

      {/* Hint — always available, smaller */}
      <div className="mt-3">
        {!showHint ? (
          <button onClick={() => setShowHint(true)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Lightbulb className="size-3.5" /> Dica
          </button>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <div className="flex items-center gap-1 font-medium"><Lightbulb className="size-3.5" /> Dica</div>
            <p className="mt-1">{q.hint || "Nenhuma dica disponível para esta questão. (Em breve, sugestões automáticas por IA.)"}</p>
          </div>
        )}
      </div>

      {noteOpen && (
        <div className="mt-4 rounded-md border bg-muted/30 p-3">
          <Label className="text-xs">Nova nota</Label>
          <Textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)}
            placeholder="Escreva uma anotação rápida..." />
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={saveNote} disabled={savingNote || !noteText.trim()}>Salvar nota</Button>
            <Button size="sm" variant="ghost" onClick={() => setNoteOpen(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {q.alternatives.map((a, i) => {
          const isDiscarded = discarded.has(a.letter);
          const isSelected = selected === a.letter;
          return (
            <div key={a.letter} className="flex items-stretch gap-1">
              <button onClick={() => onSelect(a.letter)}
                className={`flex-1 rounded-md border p-3 text-left text-sm transition-colors ${
                  isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                } ${isDiscarded ? "line-through opacity-50" : ""}`}>
                <span className="font-mono mr-2 text-muted-foreground">{i + 1}</span>
                <span className="font-mono mr-2">{a.letter})</span>
                {a.text}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
