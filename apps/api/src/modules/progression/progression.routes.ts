import type { FastifyInstance } from "fastify";
import {
  chapitreIdParamSchema,
  notionIdParamSchema,
  diagnosticIdParamSchema,
  matiereIdParamSchema,
  submitQcmAnswerSchema,
  submitFreeAnswerSchema,
  submitDiagnosticInitialSchema,
  submitMetacognitiveAnswerSchema,
  epreuveIdParamSchema,
  submitEpreuveSchema,
  advanceDiagnosticSchema,
} from "./progression.schemas.js";
import * as progressionService from "./progression.service.js";

export default async function progressionRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireRole("ELEVE", "ETUDIANT"));

  fastify.get("/mes-cours", async (request) => {
    return progressionService.getMesCours(request.user.id);
  });

  fastify.get("/streak", async (request) => {
    return progressionService.getStreak(request.user.id);
  });

  fastify.get("/chapitres/:chapitreId/parcours", async (request) => {
    const { chapitreId } = chapitreIdParamSchema.parse(request.params);
    return progressionService.getParcoursChapitre(request.user.id, chapitreId);
  });

  fastify.get("/notions/:notionId/qcm/next", async (request) => {
    const { notionId } = notionIdParamSchema.parse(request.params);
    return progressionService.getNextQcm(request.user.id, notionId);
  });

  fastify.post("/qcm/repondre", async (request) => {
    const { attemptToken, reponseDonnee } = submitQcmAnswerSchema.parse(request.body);
    return progressionService.submitQcmAnswer(request.user.id, attemptToken, reponseDonnee);
  });

  fastify.get("/notions/:notionId/saisie-libre/next", async (request) => {
    const { notionId } = notionIdParamSchema.parse(request.params);
    return progressionService.getNextSaisieLibre(request.user.id, notionId);
  });

  fastify.post("/saisie-libre/repondre", async (request) => {
    const { questionSaisieLibreId, reponseDonnee } = submitFreeAnswerSchema.parse(request.body);
    return progressionService.submitFreeAnswer(request.user.id, questionSaisieLibreId, reponseDonnee);
  });

  fastify.get("/revisions/dues", async (request) => {
    return progressionService.getDueRevisions(request.user.id);
  });

  fastify.get("/matieres/:matiereId/epreuves", async (request) => {
    const { matiereId } = matiereIdParamSchema.parse(request.params);
    return progressionService.listEpreuvesForEleve(request.user.id, matiereId);
  });

  fastify.post("/chapitres/:chapitreId/diagnostic-initial", async (request, reply) => {
    const { chapitreId } = chapitreIdParamSchema.parse(request.params);
    return reply
      .code(201)
      .send(await progressionService.startDiagnosticInitial(request.user.id, chapitreId));
  });

  fastify.post("/diagnostic-initial/:id/soumettre", async (request) => {
    const { id } = diagnosticIdParamSchema.parse(request.params);
    const { reponses } = submitDiagnosticInitialSchema.parse(request.body);
    return progressionService.submitDiagnosticInitial(id, request.user.id, reponses);
  });

  fastify.post("/metacognitif/repondre", async (request, reply) => {
    const data = submitMetacognitiveAnswerSchema.parse(request.body);
    return reply.code(201).send(await progressionService.submitMetacognitiveAnswer(request.user.id, data));
  });

  fastify.post("/epreuves/:id/soumettre", async (request) => {
    const { id } = epreuveIdParamSchema.parse(request.params);
    const { reponseDonnee } = submitEpreuveSchema.parse(request.body);
    return progressionService.submitEpreuve(request.user.id, id, reponseDonnee);
  });

  fastify.post("/diagnostic/:id/avancer", async (request) => {
    const { id } = diagnosticIdParamSchema.parse(request.params);
    const { tentativeId } = advanceDiagnosticSchema.parse(request.body);
    return progressionService.advanceDiagnostic(request.user.id, id, tentativeId);
  });
}
