import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api-client";
import { Card, KpiTile, Spinner, Table, Th, Td, Badge } from "../../design-system";

interface DashboardData {
  totalEleves: number;
  totalCours: number;
  totalChapitres: number;
  contentAValider: number;
  detailAValider: {
    qcm: number;
    saisieLibre: number;
    fichesResume: number;
    corriges: number;
    aretes: number;
  };
  notionsFragiles: { notionId: string; nom: string; nbElevesFragiles: number }[];
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api.get<DashboardData>("/api/admin/dashboard"),
  });

  if (isLoading) return <Spinner />;
  if (!data) return null;

  return (
    <div>
      <h1 className="font-display font-extrabold text-xl text-ink mb-5">Tableau de bord</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-[14px] mb-6">
        <KpiTile value={data.totalEleves} label="Élèves & étudiants" />
        <KpiTile value={data.totalCours} label="Cours" />
        <KpiTile value={data.totalChapitres} label="Chapitres" />
        <KpiTile value={data.contentAValider} label="Contenu à valider" />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Card>
          <div className="font-display font-bold text-base text-ink mb-3">File de validation</div>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="warn">{data.detailAValider.qcm} QCM</Badge>
            <Badge variant="warn">{data.detailAValider.saisieLibre} saisie libre</Badge>
            <Badge variant="warn">{data.detailAValider.fichesResume} fiches résumé</Badge>
            <Badge variant="warn">{data.detailAValider.corriges} corrigés</Badge>
            <Badge variant="warn">{data.detailAValider.aretes} arêtes proposées</Badge>
          </div>
          <Link to="/admin/validation" className="text-sm font-bold text-primary-deep underline">
            Voir la file de validation →
          </Link>
        </Card>

        <Card>
          <div className="font-display font-bold text-base text-ink mb-3">Notions fragiles</div>
          {data.notionsFragiles.length === 0 ? (
            <p className="text-sm text-ink-soft">Aucune notion fragile détectée pour l'instant.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Notion</Th>
                  <Th>Élèves en difficulté</Th>
                </tr>
              </thead>
              <tbody>
                {data.notionsFragiles.map((n) => (
                  <tr key={n.notionId}>
                    <Td>{n.nom}</Td>
                    <Td>{n.nbElevesFragiles}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
