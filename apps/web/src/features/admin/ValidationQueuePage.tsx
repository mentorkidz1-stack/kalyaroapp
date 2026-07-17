import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { formatMathText } from "../../lib/format-math";
import { Card, Button, Badge, Spinner } from "../../design-system";

interface QcmAValider {
  id: string;
  enonce: string;
  notions: { notion: { nom: string } }[];
  chapitre: { titre: string };
}
interface SaisieLibreAValider {
  id: string;
  enonce: string;
  notions: { notion: { nom: string } }[];
  chapitre: { titre: string };
}
interface FicheAValider {
  id: string;
  contenu: string;
  notion: { nom: string };
}
interface AreteProposee {
  notionId: string;
  prerequisNotionId: string;
  notion: { nom: string };
  prerequisNotion: { nom: string };
}
interface CorrigeAValider {
  id: string;
  contenu: string;
  epreuve: { enonce: string };
}

export function ValidationQueuePage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display font-extrabold text-xl text-ink">File de validation IA</h1>
      <QcmQueue />
      <SaisieLibreQueue />
      <FichesQueue />
      <AretesQueue />
      <CorrigesQueue />
    </div>
  );
}

function QueueCard({
  title,
  loading,
  empty,
  children,
}: {
  title: string;
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="font-display font-bold text-base text-ink mb-3">{title}</div>
      {loading && <Spinner />}
      {!loading && empty && <p className="text-sm text-ink-soft">Rien à valider pour l'instant.</p>}
      <div className="space-y-2">{children}</div>
    </Card>
  );
}

function QcmQueue() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["validation-qcm"],
    queryFn: () => api.get<QcmAValider[]>("/api/admin/questions-qcm/a-valider"),
  });
  const publier = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/questions-qcm/${id}`, { statut: "PUBLIE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["validation-qcm"] }),
  });

  return (
    <QueueCard title="QCM générés par IA" loading={isLoading} empty={(data?.length ?? 0) === 0}>
      {data?.map((q) => (
        <div key={q.id} className="border border-line rounded-[14px] p-3">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="ai">IA</Badge>
            {q.notions.map((n) => (
              <span key={n.notion.nom} className="text-[11px] font-mono text-ink-soft">
                {n.notion.nom}
              </span>
            ))}
            <span className="text-[11px] text-ink-soft">· {q.chapitre.titre}</span>
          </div>
          <p className="text-sm font-semibold text-ink mb-2">{formatMathText(q.enonce)}</p>
          <Button type="button" variant="ghost" className="w-auto" onClick={() => publier.mutate(q.id)}>
            Publier
          </Button>
        </div>
      ))}
    </QueueCard>
  );
}

function SaisieLibreQueue() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["validation-saisie-libre"],
    queryFn: () => api.get<SaisieLibreAValider[]>("/api/admin/questions-saisie-libre/a-valider"),
  });
  const publier = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/questions-saisie-libre/${id}`, { statut: "PUBLIE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["validation-saisie-libre"] }),
  });

  return (
    <QueueCard title="Questions à saisie libre" loading={isLoading} empty={(data?.length ?? 0) === 0}>
      {data?.map((q) => (
        <div key={q.id} className="border border-line rounded-[14px] p-3">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="ai">IA</Badge>
            {q.notions.map((n) => (
              <span key={n.notion.nom} className="text-[11px] font-mono text-ink-soft">
                {n.notion.nom}
              </span>
            ))}
          </div>
          <p className="text-sm font-semibold text-ink mb-2">{formatMathText(q.enonce)}</p>
          <Button type="button" variant="ghost" className="w-auto" onClick={() => publier.mutate(q.id)}>
            Publier
          </Button>
        </div>
      ))}
    </QueueCard>
  );
}

function FichesQueue() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["validation-fiches"],
    queryFn: () => api.get<FicheAValider[]>("/api/admin/fiches-resume"),
  });
  const publier = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/fiches-resume/${id}`, { statut: "PUBLIE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["validation-fiches"] }),
  });

  return (
    <QueueCard title="Fiches résumé générées à la volée" loading={isLoading} empty={(data?.length ?? 0) === 0}>
      {data?.map((f) => (
        <div key={f.id} className="border border-line rounded-[14px] p-3">
          <div className="text-[11px] font-mono text-ink-soft mb-1">{f.notion.nom}</div>
          <p className="text-sm text-ink whitespace-pre-wrap mb-2">{formatMathText(f.contenu)}</p>
          <Button type="button" variant="ghost" className="w-auto" onClick={() => publier.mutate(f.id)}>
            Publier
          </Button>
        </div>
      ))}
    </QueueCard>
  );
}

function AretesQueue() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["validation-aretes"],
    queryFn: () => api.get<AreteProposee[]>("/api/admin/prerequis-proposes"),
  });
  const valider = useMutation({
    mutationFn: (e: AreteProposee) =>
      api.patch(`/api/admin/prerequis/${e.notionId}/${e.prerequisNotionId}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["validation-aretes"] }),
  });
  const rejeter = useMutation({
    mutationFn: (e: AreteProposee) => api.delete(`/api/admin/prerequis/${e.notionId}/${e.prerequisNotionId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["validation-aretes"] }),
  });

  return (
    <QueueCard title="Arêtes du graphe proposées par IA" loading={isLoading} empty={(data?.length ?? 0) === 0}>
      {data?.map((e) => (
        <div
          key={`${e.notionId}-${e.prerequisNotionId}`}
          className="flex items-center justify-between border border-line rounded-[14px] p-3"
        >
          <span className="text-sm font-semibold text-ink">
            {e.notion.nom} <span className="text-ink-soft font-normal">dépend de</span> {e.prerequisNotion.nom}
          </span>
          <div className="flex gap-3">
            <button type="button" className="text-primary-deep text-xs font-mono" onClick={() => valider.mutate(e)}>
              Valider
            </button>
            <button
              type="button"
              className="text-alert text-xs font-mono"
              onClick={() => {
                if (window.confirm(`Rejeter l'arête "${e.notion.nom} dépend de ${e.prerequisNotion.nom}" ?`)) {
                  rejeter.mutate(e);
                }
              }}
            >
              Rejeter
            </button>
          </div>
        </div>
      ))}
    </QueueCard>
  );
}

function CorrigesQueue() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["validation-corriges"],
    queryFn: () => api.get<CorrigeAValider[]>("/api/admin/corriges/a-valider"),
  });
  const valider = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/corriges/${id}`, { statutValidation: "VALIDE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["validation-corriges"] }),
  });

  return (
    <QueueCard title="Corrigés-types générés par IA" loading={isLoading} empty={(data?.length ?? 0) === 0}>
      {data?.map((c) => (
        <div key={c.id} className="border border-line rounded-[14px] p-3">
          <div className="text-[11px] text-ink-soft mb-1">{formatMathText(c.epreuve.enonce)}</div>
          <p className="text-sm text-ink whitespace-pre-wrap mb-2">{formatMathText(c.contenu)}</p>
          <Button type="button" variant="ghost" className="w-auto" onClick={() => valider.mutate(c.id)}>
            Valider
          </Button>
        </div>
      ))}
    </QueueCard>
  );
}
