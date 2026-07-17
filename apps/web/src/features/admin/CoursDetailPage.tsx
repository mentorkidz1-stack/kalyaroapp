import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { Card, Button, fieldInputClass, Spinner } from "../../design-system";

interface Chapitre {
  id: string;
  titre: string;
  ordre: number;
}
interface CoursDetail {
  id: string;
  titre: string;
  statutExtraction: string;
  chapitres: Chapitre[];
}

export function CoursDetailPage() {
  const { coursId } = useParams<{ coursId: string }>();
  const queryClient = useQueryClient();
  const [titre, setTitre] = useState("");

  const { data: cours, isLoading } = useQuery({
    queryKey: ["admin-cours-detail", coursId],
    queryFn: () => api.get<CoursDetail>(`/api/admin/cours/${coursId}`),
    enabled: !!coursId,
  });

  const createChapitre = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/cours/${coursId}/chapitres`, { titre, ordre: (cours?.chapitres.length ?? 0) + 1 }),
    onSuccess: () => {
      setTitre("");
      queryClient.invalidateQueries({ queryKey: ["admin-cours-detail", coursId] });
    },
  });

  if (isLoading) return <Spinner />;
  if (!cours) return null;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/cours" className="text-xs font-mono text-ink-soft underline">
          ← Cours
        </Link>
        <h1 className="font-display font-extrabold text-xl text-ink mt-1">{cours.titre}</h1>
      </div>

      <Card>
        <div className="font-display font-bold text-base text-ink mb-4">Chapitres</div>
        <div className="space-y-2 mb-4">
          {cours.chapitres
            .slice()
            .sort((a, b) => a.ordre - b.ordre)
            .map((ch) => (
              <Link
                key={ch.id}
                to={`/admin/chapitres/${ch.id}`}
                className="block px-4 py-3 rounded-[14px] border-2 border-line hover:border-primary font-semibold text-sm text-ink"
              >
                {ch.titre}
              </Link>
            ))}
        </div>
        <div className="flex gap-2">
          <input
            className={fieldInputClass}
            placeholder="Titre du nouveau chapitre"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
          />
          <Button
            type="button"
            className="w-auto"
            onClick={() => createChapitre.mutate()}
            disabled={!titre.trim()}
          >
            Ajouter
          </Button>
        </div>
      </Card>
    </div>
  );
}
