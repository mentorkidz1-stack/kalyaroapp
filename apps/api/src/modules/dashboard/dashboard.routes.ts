import type { FastifyInstance } from "fastify";
import * as dashboardService from "./dashboard.service.js";

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireRole("ADMIN"));

  fastify.get("/dashboard", async () => dashboardService.getDashboard());
}
