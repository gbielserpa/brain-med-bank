import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { parseAlternatives } from "@/lib/parser";
import { uploadQuestionImage, getSignedImageUrl } from "@/lib/image";
import { sanitizeHtml } from "@/lib/sanitize";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Star, X, Bold, Italic, List, ImagePlus, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const LETTERS = ["A", "B", "C", "D", "E"];

type Alt = { letter: string; text: string };
type Props = { editId?: string; onSaved?: () => void };

const SPECIALTIES = ["CM", "CG", "PED", "PREV", "GO (Gineco)", "GO (Obstetrícia)"];
const YEARS = ["2020 ou anterior", "2021", "2022", "2023", "2024", "2025", "2026"];

function yearToInt(y: string): number | null {
  if (!y) return null;
  if (y === "2020 ou anterior") return 2020;
  const n = parseInt(y);
  return Number.isFinite(n) ? n : null;
}
function intToYearOption(n: number | null | undefined): string {
  if (!n) return "";
  if (n <= 2020) return "2020 ou anterior";
  return String(n);
}

// Validates that each alternative starts with uppercase after "A) "
function checkFormatting(alts: Alt[]): string[] {
  const issues: string[] = [];
  alts.forEach((a) => {
    const t = a.text.trim();
    if (!t) return;
    const first = t[0];
    if (first && first.toLowerCase() === first && first.toUpperCase() !== first) {
      issues.push(`Alternativa ${a.letter}: começa com letra minúscula ("${first}").`);
    }
  });
  return issues;
}

export function QuestionEditor({ editId, onSaved }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [count, setCount] = useState<4 | 5>(5);
  const [statement, setStatement] = useState("");
  const [alts, setAlts] = useState<Alt[]>(LETTERS.slice(0, 5).map((l) => ({ letter: l, text: "" })));
  const [correct, setCorrect] = useState<string>("A");
  const [pasted, setPasted] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);

  // Specialty
  const [specialtyChoice, setSpecialtyChoice] = useState<string>(""); // one of SPECIALTIES or "Outros"
  const [specialtyOther, setSpecialtyOther] = useState<string>("");

  // Year
  const [yearChoice, setYearChoice] = useState<string>("");

  const [institution, setInstitution] = useState("");

  // Relevance optional
  const [showRelevance, setShowRelevance] = useState(false);
  const [relevance, setRelevance] = useState<number | null>(null);

  // Hint
  const [hint, setHint] = useState("");

  // Tags as chips
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [editingTagIdx, setEditingTagIdx] = useState<number | null>(null);

  // Explanation as HTML
  const explanationRef = useRef<HTMLDivElement>(null);
  const [explanationHtml, setExplanationHtml] = useState<string>("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data, error } = await supabase.from("questions").select("*").eq("id", editId).single();
      if (error || !data) return;
      setStatement(data.statement);
      const a = (data.alternatives as Alt[]) ?? [];
      setCount((a.length === 4 ? 4 : 5) as 4 | 5);
      setAlts(LETTERS.slice(0, a.length).map((l, i) => a[i] ?? { letter: l, text: "" }));
      setCorrect(data.correct_letter);
      setImagePath(data.image_url ?? null);

      const sp = data.specialty ?? "";
      if (SPECIALTIES.includes(sp)) { setSpecialtyChoice(sp); setSpecialtyOther(""); }
      else if (sp) { setSpecialtyChoice("Outros"); setSpecialtyOther(sp); }

      setYearChoice(intToYearOption(data.year));
      setInstitution(data.institution ?? "");
      if (data.relevance != null) { setRelevance(data.relevance); setShowRelevance(true); }
      setHint((data as any).hint ?? "");
      setTags(data.tags ?? []);
      const html = data.explanation ?? "";
      setExplanationHtml(html);
      if (explanationRef.current) explanationRef.current.innerHTML = sanitizeHtml(html);
    })();
  }, [editId]);

  function reset() {
    setStatement("");
    setAlts(LETTERS.slice(0, count).map((l) => ({ letter: l, text: "" })));
    setCorrect("A");
    setPasted("");
    setImageFile(null);
    setImagePath(null);
    setSpecialtyChoice("");
    setSpecialtyOther("");
    setYearChoice("");
    setInstitution("");
    setShowRelevance(false);
    setRelevance(null);
    setHint("");
    setTags([]);
    setTagInput("");
    setExplanationHtml("");
    if (explanationRef.current) explanationRef.current.innerHTML = "";
  }

  function changeCount(n: 4 | 5) {
    setCount(n);
    setAlts((prev) => LETTERS.slice(0, n).map((l, i) => prev[i] ?? { letter: l, text: "" }));
    if (correct === "E" && n === 4) setCorrect("A");
  }

  function applyPasted() {
    const parsed = parseAlternatives(pasted);
    if (parsed.length < 2) {
      toast.error("Não foi possível reconhecer alternativas. Use o formato 'A) texto'.");
      return;
    }
    const n = (parsed.length === 4 ? 4 : 5) as 4 | 5;
    setCount(n);
    setAlts(LETTERS.slice(0, n).map((l, i) => parsed[i] ?? { letter: l, text: "" }));
    if (!parsed.some((p) => p.letter === correct)) setCorrect(parsed[0].letter);
    toast.success(`${parsed.length} alternativas reconhecidas.`);
  }

  // Tag handlers
  function commitTag() {
    const v = tagInput.trim().replace(/^#+/, "");
    if (!v) return;
    if (editingTagIdx != null) {
      setTags((prev) => prev.map((t, i) => (i === editingTagIdx ? v : t)));
      setEditingTagIdx(null);
    } else if (!tags.includes(v)) {
      setTags((prev) => [...prev, v]);
    }
    setTagInput("");
  }
  function onTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitTag();
    } else if (e.key === "Backspace" && !tagInput && tags.length && editingTagIdx == null) {
      setTagInput(tags[tags.length - 1]);
      setTags((prev) => prev.slice(0, -1));
    }
  }
  function editTag(idx: number) {
    setEditingTagIdx(idx);
    setTagInput(tags[idx]);
  }
  function removeTag(idx: number) {
    setTags((prev) => prev.filter((_, i) => i !== idx));
  }

  // Rich text helpers
  function exec(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    if (explanationRef.current) setExplanationHtml(explanationRef.current.innerHTML);
  }
  async function insertExplanationImage(file: File) {
    if (!user) return;
    try {
      const path = await uploadQuestionImage(user.id, file);
      const url = await getSignedImageUrl(path);
      if (!url) throw new Error("Falha ao gerar URL");
      const safeUrl = url.replace(/["<>]/g, "");
      const safePath = path.replace(/["<>]/g, "");
      exec("insertHTML", `<img src="${safeUrl}" alt="" data-path="${safePath}" style="max-width:100%;border-radius:6px;margin:8px 0" />`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao inserir imagem");
    }
  }

  async function save(andNew = false) {
    if (!user) return;
    if (!statement.trim()) return toast.error("Enunciado é obrigatório.");
    const validAlts = alts.filter((a) => a.text.trim());
    if (validAlts.length < 4) return toast.error("Preencha ao menos 4 alternativas.");
    if (!validAlts.some((a) => a.letter === correct)) return toast.error("Marque uma alternativa correta válida.");

    const specialty =
      specialtyChoice === "Outros" ? specialtyOther.trim() : specialtyChoice;
    if (!specialty) return toast.error("Especialidade é obrigatória.");
    if (specialtyChoice === "Outros" && !specialtyOther.trim())
      return toast.error("Informe a especialidade em 'Outros'.");
    if (!yearChoice) return toast.error("Ano é obrigatório.");

    // Formatting rules
    const issues = checkFormatting(validAlts);
    if (issues.length) {
      toast.warning("Regras de Formatação", { description: issues.join("\n") });
    }

    setSaving(true);
    try {
      let finalImagePath = imagePath;
      if (imageFile) finalImagePath = await uploadQuestionImage(user.id, imageFile);

      const payload: any = {
        user_id: user.id,
        statement: statement.trim(),
        image_url: finalImagePath,
        alternatives: validAlts,
        correct_letter: correct,
        specialty,
        institution: institution.trim() || null,
        year: yearToInt(yearChoice),
        relevance: showRelevance && relevance != null ? relevance : 3,
        explanation: sanitizeHtml(explanationHtml.trim()) || null,
        hint: hint.trim() || null,
        tags,
      };

      if (editId) {
        const { error } = await supabase.from("questions").update(payload).eq("id", editId);
        if (error) throw error;
        toast.success("Questão atualizada.");
      } else {
        const { error } = await supabase.from("questions").insert(payload);
        if (error) throw error;
        toast.success("Questão salva.");
      }
      qc.invalidateQueries({ queryKey: ["questions"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onSaved?.();
      if (andNew) reset();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl">{editId ? "Editar questão" : "Nova questão"}</h2>
        <div className="flex gap-1 rounded-md border p-1">
          {[4, 5].map((n) => (
            <button key={n} onClick={() => changeCount(n as 4 | 5)}
              className={`rounded px-3 py-1 text-sm ${count === n ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {n} alternativas
            </button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="fields" className="mt-6">
        <TabsList>
          <TabsTrigger value="fields">Campos separados</TabsTrigger>
          <TabsTrigger value="paste">Colar bloco</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="mt-4 space-y-4">
          <div>
            <Label>Enunciado</Label>
            <Textarea rows={5} value={statement} onChange={(e) => setStatement(e.target.value)} />
          </div>
          <RadioGroup value={correct} onValueChange={setCorrect}>
            <div className="space-y-2">
              {alts.map((a, i) => (
                <div key={a.letter} className="flex items-start gap-2">
                  <RadioGroupItem value={a.letter} id={`alt-${a.letter}`} className="mt-3" />
                  <Label htmlFor={`alt-${a.letter}`} className="mt-3 w-6 font-mono">{a.letter}</Label>
                  <Textarea rows={2} value={a.text}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAlts((prev) => prev.map((x, idx) => (idx === i ? { ...x, text: v } : x)));
                    }} />
                </div>
              ))}
            </div>
          </RadioGroup>
        </TabsContent>

        <TabsContent value="paste" className="mt-4 space-y-4">
          <div>
            <Label>Enunciado</Label>
            <Textarea rows={4} value={statement} onChange={(e) => setStatement(e.target.value)} />
          </div>
          <div>
            <Label>Alternativas (cole o texto corrido)</Label>
            <Textarea rows={8} placeholder={"A) Primeira alternativa\nB) Segunda alternativa\nC) ..."}
              value={pasted} onChange={(e) => setPasted(e.target.value)} />
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={applyPasted}>
              Reconhecer alternativas
            </Button>
          </div>
          {alts.some((a) => a.text) && (
            <div>
              <Label>Preview — marque a correta</Label>
              <RadioGroup value={correct} onValueChange={setCorrect}>
                <div className="mt-2 space-y-2">
                  {alts.map((a) => (
                    <label key={a.letter} className="flex items-start gap-2 rounded-md border p-3 hover:bg-muted/40">
                      <RadioGroupItem value={a.letter} id={`palt-${a.letter}`} className="mt-1" />
                      <span className="font-mono w-6">{a.letter}</span>
                      <span className="text-sm">{a.text}</span>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="mt-6 space-y-5 border-t pt-6">
        <div>
          <Label>Imagem (opcional)</Label>
          <div className="mt-1 flex items-center gap-2">
            <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
            {(imageFile || imagePath) && (
              <Button type="button" variant="ghost" size="icon" onClick={() => { setImageFile(null); setImagePath(null); }}>
                <X className="size-4" />
              </Button>
            )}
          </div>
          {imageFile && <p className="mt-1 text-xs text-muted-foreground">{imageFile.name}</p>}
          {!imageFile && imagePath && <p className="mt-1 text-xs text-muted-foreground">Imagem anexada</p>}
        </div>

        {/* Specialty */}
        <div>
          <Label>Especialidade <span className="text-destructive">*</span></Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...SPECIALTIES, "Outros"].map((s) => (
              <button type="button" key={s} onClick={() => setSpecialtyChoice(s)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  specialtyChoice === s ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/40"
                }`}>
                {s}
              </button>
            ))}
          </div>
          {specialtyChoice === "Outros" && (
            <Input className="mt-2" placeholder="Digite a especialidade"
              value={specialtyOther} onChange={(e) => setSpecialtyOther(e.target.value)} />
          )}
        </div>

        {/* Year */}
        <div>
          <Label>Ano <span className="text-destructive">*</span></Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {YEARS.map((y) => (
              <button type="button" key={y} onClick={() => setYearChoice(y)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  yearChoice === y ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/40"
                }`}>
                {y}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Instituição (opcional)</Label>
          <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Ex: USP" />
        </div>

        {/* Relevance optional */}
        <div>
          {!showRelevance ? (
            <button type="button" onClick={() => { setShowRelevance(true); setRelevance(3); }}
              className="text-xs text-muted-foreground underline hover:text-foreground">
              + Adicionar relevância
            </button>
          ) : (
            <div className="rounded-md border border-dashed p-3">
              <div className="flex items-center justify-between">
                <Label>Relevância</Label>
                <button type="button" onClick={() => { setShowRelevance(false); setRelevance(null); }}
                  className="text-xs text-muted-foreground hover:text-foreground">remover</button>
              </div>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRelevance(n)}>
                    <Star className={`size-5 ${relevance != null && n <= relevance ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Hint */}
        <div>
          <Label className="flex items-center gap-2">
            <Lightbulb className="size-4 text-amber-500" /> Dica (opcional)
          </Label>
          <Textarea rows={2} value={hint} onChange={(e) => setHint(e.target.value)}
            placeholder="Uma pequena ajuda exibida durante a resolução." />
        </div>

        {/* Tags */}
        <div>
          <Label>Tags</Label>
          <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md border p-2">
            {tags.map((t, idx) => (
              editingTagIdx === idx ? null : (
                <button key={idx} type="button" onClick={() => editTag(idx)}
                  className="group inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/20">
                  #{t}
                  <X className="size-3 opacity-50 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); removeTag(idx); }} />
                </button>
              )
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={onTagKeyDown}
              onBlur={commitTag}
              placeholder={tags.length ? "" : "Digite e pressione Enter..."}
              className="flex-1 min-w-[120px] bg-transparent text-sm outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Pressione Enter para adicionar. Clique numa tag para editar.</p>
        </div>

        {/* Explanation rich text */}
        <div>
          <Label>Comentário / explicação</Label>
          <div className="mt-1 rounded-md border">
            <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-1">
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => exec("bold")}><Bold className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => exec("italic")}><Italic className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => exec("insertUnorderedList")}><List className="size-4" /></Button>
              <label className="inline-flex size-7 cursor-pointer items-center justify-center rounded hover:bg-muted">
                <ImagePlus className="size-4" />
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) insertExplanationImage(f); e.currentTarget.value = ""; }} />
              </label>
            </div>
            <div
              ref={explanationRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setExplanationHtml((e.target as HTMLDivElement).innerHTML)}
              className="min-h-[120px] p-3 text-sm prose prose-sm max-w-none focus:outline-none [&_img]:rounded-md"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => save(false)} disabled={saving}>
          {editId ? "Salvar alterações" : "Salvar"}
        </Button>
        {!editId && (
          <Button variant="outline" onClick={() => save(true)} disabled={saving}>
            Salvar e criar nova
          </Button>
        )}
        <Button variant="ghost" onClick={reset} disabled={saving}>Limpar</Button>
      </div>
    </Card>
  );
}
