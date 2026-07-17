import type { FastifyInstance } from "fastify";
import {
  idParamSchema,
  chapitreIdParamSchema,
  notionIdParamSchema,
  prerequisParamSchema,
  createNotionSchema,
  updateNotionSchema,
  createPrerequisSchema,
  updateFicheResumeSchema,
} from "./notions.schemas.js";
import * as notionsService from "./notions.service.js";

export default async function notionsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireRole("ADMIN"));

  fastify.get("/chapitres/:chapitreId/notions", async (request) => {
    const { chapitreId } = chapitreIdParamSchema.parse(request.params);
    return notionsService.listNotionsByChapitre(chapitreId);
  });

  fastify.post("/chapitres/:chapitreId/notions", async (request, reply) => {
    const { chapitreId } = chapitreIdParamSchema.parse(request.params);
    const data = createNotionSchema.parse(request.body);
    return reply.code(201).send(await notionsService.createNotion(chapitreId, data));
  });

  fastify.patch("/notions/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = updateNotionSchema.parse(request.body);
    return notionsService.updateNotion(id, data);
  });

  fastify.delete("/notions/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await notionsService.deleteNotion(id);
    return reply.code(204).send();
  });

  fastify.get("/chapitres/:chapitreId/prerequis", async (request) => {
    const { chapitreId } = chapitreIdParamSchema.parse(request.params);
    return notionsService.listPrerequisByChapitre(chapitreId);
  });

  fastify.post("/prerequis", async (request, reply) => {
    const data = createPrerequisSchema.parse(request.body);
    return reply.code(201).send(await notionsService.createPrerequis(data));
  });

  fastify.patch("/prerequis/:notionId/:prerequisNotionId", async (request) => {
    const { notionId, prerequisNotionId } = prerequisParamSchema.parse(request.params);
    return notionsService.validatePrerequis(notionId, prerequisNotionId);
  });

  fastify.delete("/prerequis/:notionId/:prerequisNotionId", async (request, reply) => {
    const { notionId, prerequisNotionId } = prerequisParamSchema.parse(request.params);
    await notionsService.deletePrerequis(notionId, prerequisNotionId);
    return reply.code(204).send();
  });

  fastify.post("/chapitres/:chapitreId/notions/propose-graphe-ia", async (request, reply) => {
    const { chapitreId } = chapitreIdParamSchema.parse(request.params);
    return reply.code(201).send(await notionsService.proposeGraphForChapitre(chapitreId));
  });

  // Vues transverses (file de validation) — tous chapitres/notions confondus.
  fastify.get("/prerequis-proposes", async () => notionsService.listAretesProposees());
  fastify.get("/fiches-resume", async () => notionsService.listFichesResumeAValider());

  fastify.get("/notions/:notionId/fiches-resume", async (request) => {
    const { notionId } = notionIdParamSchema.parse(request.params);
    return notionsService.listFichesResumeByNotion(notionId);
  });

  fastify.patch("/fiches-resume/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = updateFicheResumeSchema.parse(request.body);
    return notionsService.updateFicheResume(id, data);
  });
}
