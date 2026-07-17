import "dotenv/config";
import Fastify from "fastify";
import { prisma } from "./db/prisma.js";
import corsPlugin from "./plugins/cors.js";
import authPlugin from "./plugins/auth.js";
import multipartPlugin from "./plugins/multipart.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import authRoutes from "./modules/auth/auth.routes.js";
import { structurePublicRoutes, structureAdminRoutes } from "./modules/structure/structure.routes.js";
import coursesRoutes from "./modules/courses/courses.routes.js";
import notionsRoutes from "./modules/notions/notions.routes.js";
import questionsRoutes from "./modules/questions/questions.routes.js";
import progressionRoutes from "./modules/progression/progression.routes.js";
import examsRoutes from "./modules/exams/exams.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import { evaluationsAdminRoutes, evaluationsEleveRoutes } from "./modules/evaluations/evaluations.routes.js";
import usersRoutes from "./modules/users/users.routes.js";

const app = Fastify({ logger: true });

await app.register(corsPlugin);
await app.register(authPlugin);
await app.register(multipartPlugin);
await app.register(errorHandlerPlugin);

app.get("/health", async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { status: "ok" };
});

await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(structurePublicRoutes, { prefix: "/api/structure" });
await app.register(structureAdminRoutes, { prefix: "/api/admin" });
await app.register(coursesRoutes, { prefix: "/api/admin" });
await app.register(notionsRoutes, { prefix: "/api/admin" });
await app.register(questionsRoutes, { prefix: "/api/admin" });
await app.register(progressionRoutes, { prefix: "/api/eleve" });
await app.register(examsRoutes, { prefix: "/api/admin" });
await app.register(dashboardRoutes, { prefix: "/api/admin" });
await app.register(evaluationsAdminRoutes, { prefix: "/api/admin" });
await app.register(evaluationsEleveRoutes, { prefix: "/api/eleve" });
await app.register(usersRoutes, { prefix: "/api/admin" });

const port = Number(process.env.PORT ?? 4000);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
