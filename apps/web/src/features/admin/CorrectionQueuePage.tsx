import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api-client";
import { Card, Badge, Spinner } from "../../design-system";

interface Copie {
  id: string;
  statut: "SOUMIS" | "CORRIGE";
  soumisAt: string | null;
  corrigeAt: string | null;
  horsDelai: boolean;
  noteObtenue: number | null;
  evaluation: { titre: string; bareme: number };
  eleve: { nom: string };
}

export function CorrectionQueuePage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display font-extrabold text-xl text-ink">Correction des copies</h1>
      <CopiesList title="À corriger" queryKey="copies-a-corriger" endpoint="/api/admin/copies/a-corriger" />
      <CopiesList title="Corrigées" queryKey="copies-corrigees" endpoint="/api/admin/copies/corrigees" />
    </div>
  );
}

function CopiesList({ title, queryKey, endpoint }: { title: string; queryKey: string; endpoint: string }) {
  const { data, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: () => api.get<Copie[]>(endpoint),
  });

  return (
    <Card>
      <div className="font-display font-bold text-base text-ink mb-3">{title}</div>
      {isLoading && <Spinner />}
      {!isLoading && (data?.length ?? 0) === 0 && <p className="text-sm text-ink-soft">Rien ici pour l'instant.</p>}
      <div className="space-y-2">
        {data?.map((c) => (
          <Link
            key={c.id}
            to={`/admin/copies/${c.id}`}
            className="flex items-center justify-between px-4 py-3 rounded-[14px] border-2 border-line hover:border-primary"
          >
            <div>
              <span className="font-semibold text-sm text-ink">{c.evaluation.titre}</span>
              <span className="text-xs text-ink-soft ml-2">{c.eleve.nom}</span>
              {c.horsDelai && (
                <span className="ml-2">
                  <Badge variant="warn">Hors délai</Badge>
                </span>
              )}
            </div>
            {c.statut === "CORRIGE" ? (
              <span className="text-sm font-bold text-primary-deep">
                {c.noteObtenue} / {c.evaluation.bareme}
              </span>
            ) : (
              <span className="text-xs font-mono text-ink-soft">À corriger</span>
            )}
          </Link>
        ))}
      </div>
    </Card>
  );
}
