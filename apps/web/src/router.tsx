import { Navigate, Outlet, createBrowserRouter } from "react-router-dom";
import { useAuthStore } from "./stores/auth";
import { HomePage } from "./features/home/HomePage";
import { ConnexionPage } from "./features/auth/ConnexionPage";
import { MesCoursPage } from "./features/cours/MesCoursPage";
import { ParcoursPage } from "./features/parcours/ParcoursPage";
import { QcmSessionPage } from "./features/qcm/QcmSessionPage";
import { SaisieLibrePage } from "./features/saisie-libre/SaisieLibrePage";
import { EpreuvesListPage } from "./features/epreuves/EpreuvesListPage";
import { EpreuveSessionPage } from "./features/epreuves/EpreuveSessionPage";
import { EvaluationsListPage } from "./features/evaluations/EvaluationsListPage";
import { EvaluationSessionPage } from "./features/evaluations/EvaluationSessionPage";
import { EvaluationResultPage } from "./features/evaluations/EvaluationResultPage";
import { AdminLayout } from "./components/AdminLayout";
import { StudentLayout } from "./components/StudentLayout";
import { DashboardPage } from "./features/admin/DashboardPage";
import { UtilisateursPage } from "./features/admin/UtilisateursPage";
import { StructurePage } from "./features/admin/StructurePage";
import { CoursListPage } from "./features/admin/CoursListPage";
import { CoursDetailPage } from "./features/admin/CoursDetailPage";
import { ChapitreDetailPage } from "./features/admin/ChapitreDetailPage";
import { EpreuvesPage } from "./features/admin/EpreuvesPage";
import { ValidationQueuePage } from "./features/admin/ValidationQueuePage";
import { EvaluationsPage } from "./features/admin/EvaluationsPage";
import { CorrectionQueuePage } from "./features/admin/CorrectionQueuePage";
import { CopieDetailPage } from "./features/admin/CopieDetailPage";

function RequireAuth() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/connexion" replace />;
  return <Outlet />;
}

function RequireAdmin() {
  const role = useAuthStore((s) => s.user?.role);
  if (role !== "ADMIN") return <Navigate to="/cours" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/connexion", element: <ConnexionPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <StudentLayout />,
        children: [
          { path: "cours", element: <MesCoursPage /> },
          { path: "parcours/:chapitreId", element: <ParcoursPage /> },
          { path: "epreuves", element: <EpreuvesListPage /> },
          { path: "evaluations", element: <EvaluationsListPage /> },
        ],
      },
      { path: "parcours/:chapitreId/qcm/:notionId", element: <QcmSessionPage /> },
      { path: "parcours/:chapitreId/saisie-libre/:notionId", element: <SaisieLibrePage /> },
      { path: "epreuves/passage/:epreuveId", element: <EpreuveSessionPage /> },
      { path: "evaluations/passage/:evaluationId", element: <EvaluationSessionPage /> },
      { path: "evaluations/copie/:copieId", element: <EvaluationResultPage /> },
      {
        path: "admin",
        element: <RequireAdmin />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: "utilisateurs", element: <UtilisateursPage /> },
              { path: "structure", element: <StructurePage /> },
              { path: "cours", element: <CoursListPage /> },
              { path: "cours/:coursId", element: <CoursDetailPage /> },
              { path: "chapitres/:chapitreId", element: <ChapitreDetailPage /> },
              { path: "epreuves", element: <EpreuvesPage /> },
              { path: "evaluations", element: <EvaluationsPage /> },
              { path: "copies", element: <CorrectionQueuePage /> },
              { path: "copies/:copieId", element: <CopieDetailPage /> },
              { path: "validation", element: <ValidationQueuePage /> },
            ],
          },
        ],
      },
    ],
  },
]);
