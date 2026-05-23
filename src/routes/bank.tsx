import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

export const Route = createFileRoute("/bank")({ component: Bank });

function Bank() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [institution, setInstitution] = useState("");
  const [year, setYear] = useState("");
  const [minRelevance, setMinRelevance] = useState(0);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const { data: all = [] } = useQuery({
    queryKey: ["questions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const specialties = useMemo(() => [...new Set(all.map((q: any) => q.specialty).filter(Boolean))], [all]);
  const institutions = useMemo(() => [...new Set(all.map((q: any) => q.institution).filter(Boolean))], [all]);

  const filtered = all.filter((q: any) => {
    if (search && !q.statement.toLowerCase().includes(search.toLowerCase())) return false;
    if (specialty && q.specialty !== specialty) return false;
    if (institution && q.institution !== institution) return false;
    if (year && q.year?.toString() !== year) return false;
    if (q.relevance < minRelevance) return false;
    return true;
  });

  if (loading || !user) return null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl">Banco de questões</h1>
        <Button asChild><Link to="/exam">Iniciar prova</Link></Button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4">
          <div>
            <Label>Busca</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="palavra-chave" />
          </div>
          <div>
            <Label>Especialidade</Label>
            <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="">Todas</option>
              {specialties.map((s: any) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <Label>Instituição</Label>
            <select value={institution} onChange={(e) => setInstitution(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="">Todas</option>
              {institutions.map((s: any) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <Label>Ano</Label>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div>
            <Label>Relevância mínima</Label>
            <div className="mt-2 flex gap-1">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setMinRelevance(n)} className={`rounded px-2 py-1 text-xs ${minRelevance === n ? "bg-primary text-primary-foreground" : "border"}`}>
                  {n === 0 ? "Todas" : `${n}+`}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{filtered.length} questões</p>
          {filtered.map((q: any) => (
            <Link key={q.id} to="/bank/$id" params={{ id: q.id }}>
              <Card className="p-4 transition-colors hover:bg-muted/40">
                <p className="line-clamp-2 text-sm">{q.statement}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {q.specialty && <Badge variant="secondary">{q.specialty}</Badge>}
                  {q.institution && <Badge variant="outline">{q.institution}{q.year ? ` ${q.year}` : ""}</Badge>}
                  <div className="ml-auto flex">
                    {Array.from({ length: q.relevance }).map((_, i) => (
                      <Star key={i} className="size-3.5 fill-primary text-primary" />
                    ))}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma questão encontrada.</p>}
        </div>
      </div>
    </main>
  );
}
