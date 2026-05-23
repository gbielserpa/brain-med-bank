import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { parseAlternatives } from "@/lib/parser";
import { uploadQuestionImage } from "@/lib/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Star, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const LETTERS = ["A", "B", "C", "D", "E"];

type Alt = { letter: string; text: string };

type Props = { editId?: string; onSaved?: () => void };

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
  const [specialty, setSpecialty] = useState("");
  const [institution, setInstitution] = useState("");
  const [year, setYear] = useState<string>("");
  const [relevance, setRelevance] = useState(3);
  const [explanation, setExplanation] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);

  // Load when editing
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
      setSpecialty(data.specialty ?? "");
      setInstitution(data.institution ?? "");
      setYear(data.year?.toString() ?? "");
      setRelevance(data.relevance ?? 3);
      setExplanation(data.explanation ?? "");
      setTagsText((data.tags ?? []).join(", "));
    })();
  }, [editId]);

  function reset() {
    setStatement("");
    setAlts(LETTERS.slice(0, count).map((l) => ({ letter: l, text: "" })));
    setCorrect("A");
    setPasted("");
    setImageFile(null);
    setImagePath(null);
    setSpecialty("");
    setInstitution("");
    setYear("");
    setRelevance(3);
    setExplanation("");
    setTagsText("");
  }

  function changeCount(n: 4 | 5) {
    setCount(n);
    setAlts((prev) => {
      const next = LETTERS.slice(0, n).map((l, i) => prev[i] ?? { letter: l, text: "" });
      return next;
    });
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

  async function save(andNew = false) {
    if (!user) return;
    if (!statement.trim()) return toast.error("Enunciado é obrigatório.");
    const validAlts = alts.filter((a) => a.text.trim());
    if (validAlts.length < 4) return toast.error("Preencha ao menos 4 alternativas.");
    if (!validAlts.some((a) => a.letter === correct)) return toast.error("Marque uma alternativa correta válida.");

    setSaving(true);
    try {
      let finalImagePath = imagePath;
      if (imageFile) {
        finalImagePath = await uploadQuestionImage(user.id, imageFile);
      }
      const payload = {
        user_id: user.id,
        statement: statement.trim(),
        image_url: finalImagePath,
        alternatives: validAlts,
        correct_letter: correct,
        specialty: specialty.trim() || null,
        institution: institution.trim() || null,
        year: year ? parseInt(year) : null,
        relevance,
        explanation: explanation.trim() || null,
        tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
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
            <button
              key={n}
              onClick={() => changeCount(n as 4 | 5)}
              className={`rounded px-3 py-1 text-sm ${count === n ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >{n} alternativas</button>
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
                  <Textarea
                    rows={2}
                    value={a.text}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAlts((prev) => prev.map((x, idx) => (idx === i ? { ...x, text: v } : x)));
                    }}
                  />
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
            <Textarea
              rows={8}
              placeholder={"A) Primeira alternativa\nB) Segunda alternativa\nC) ..."}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
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

      <div className="mt-6 space-y-4 border-t pt-6">
        <div>
          <Label>Imagem (opcional)</Label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
            {(imageFile || imagePath) && (
              <Button type="button" variant="ghost" size="icon" onClick={() => { setImageFile(null); setImagePath(null); }}>
                <X className="size-4" />
              </Button>
            )}
          </div>
          {imageFile && <p className="mt-1 text-xs text-muted-foreground">{imageFile.name}</p>}
          {!imageFile && imagePath && <p className="mt-1 text-xs text-muted-foreground">Imagem anexada</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Especialidade</Label>
            <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ex: Clínica Médica" />
          </div>
          <div>
            <Label>Instituição</Label>
            <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Ex: USP" />
          </div>
          <div>
            <Label>Ano</Label>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" />
          </div>
          <div>
            <Label>Relevância</Label>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRelevance(n)}>
                  <Star className={`size-5 ${n <= relevance ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <Label>Tags (separadas por vírgula)</Label>
          <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="hipertensão, emergência" />
        </div>

        <div>
          <Label>Comentário / explicação</Label>
          <Textarea rows={4} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
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
