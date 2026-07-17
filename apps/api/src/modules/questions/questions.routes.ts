import type { FastifyInstance } from "fastify";
import {
  idParamSchema,
  chapitreIdParamSchema,
  createQcmSchema,
  updateQcmSchema,
  generateQcmIaSchema,
  createSaisieLibreSchema,
  updateSaisieLibreSchema,
  generateSaisieLibreIaSchema,
} from "./questions.schemas.js";
import * as questionsService from "./questions.service.js";

export default async function questionsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireRole("ADMIN"));

  // Vues transverses (file de validation) — déclarées avant les routes paramétrées.
  fastify.get("/questions-qcm/a-valider", async () => questionsService.listQcmAValider());
  fastify.get("/questions-saisie-libre/a-valider", async () => questionsService.listSaisieLibreAValider());

  // ---- QCM ----
  fastify.get("/chapitres/:chapitreId/questions-qcm", async (request) => {
    const { chapitreId } = chapitreIdParamSchema.parse(request.params);
    return questionsService.listQcmByChapitre(chapitreId);
  });

  fastify.post("/chapitres/:chapitreId/questions-qcm", async (request, reply) => {
    const { chapitreId } = chapitreIdParamSchema.parse(request.params);
    const data = createQcmSchema.parse(request.body);
    return reply.code(201).send(await questionsService.createQcm(chapitreId, request.user.id, data));
  });

  fastify.patch("/questions-qcm/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = updateQcmSchema.parse(request.body);
    return questionsService.updateQcm(id, data);
  });

  fastify.delete("/questions-qcm/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await questionsService.deleteQcm(id);
    return reply.code(204).send();
  });

  fastify.post("/chapitres/:chapitreId/questions-qcm/generate-ia", async (request, reply) => {
    const { chapitreId } = chapitreIdParamSchema.parse(request.params);
    const { nombreQuestions } = generateQcmIaSchema.parse(request.body ?? {});
    return reply
      .code(201)
      .send(await questionsService.generateQcmForChapitre(chapitreId, request.user.id, nombreQuestions));
  });

  // ---- Saisie libre ----
  fastify.get("/chapitres/:chapitreId/questions-saisie-libre", async (request) => {
    const { chapitreId } = chapitreIdParamSchema.parse(request.params);
    return questionsService.listSaisieLibreByChapitre(chapitreId);
  });

  fastify.post("/chapitres/:chapitreId/questions-saisie-libre", async (request, reply) => {
    const { chapitreId } = chapitreIdParamSchema.parse(request.params);
    const data = createSaisieLibreSchema.parse(request.body);
    return reply
      .code(201)
      .send(await questionsService.createSaisieLibre(chapitreId, request.user.id, data));
  });

  fastify.patch("/questions-saisie-libre/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = updateSaisieLibreSchema.parse(request.body);
    return questionsService.updateSaisieLibre(id, data);
  });

  fastify.delete("/questions-saisie-libre/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await questionsService.deleteSaisieLibre(id);
    return reply.code(204).send();
  });

  fastify.post("/chapitres/:chapitreId/questions-saisie-libre/generate-ia", async (request, reply) => {
    const { chapitreId } = chapitreIdParamSchema.parse(request.params);
    const { nombreQuestions } = generateSaisieLibreIaSchema.parse(request.body ?? {});
    return reply
      .code(201)
      .send(await questionsService.generateSaisieLibreForChapitre(chapitreId, request.user.id, nombreQuestions));
  });
}
