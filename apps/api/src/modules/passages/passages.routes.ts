import type { FastifyInstance } from "fastify";
import {
  epreuveIdParamSchema,
  passageIdParamSchema,
  questionParamSchema,
  repondreQuestionSchema,
} from "./passages.schemas.js";
import * as passagesService from "./passages.service.js";

/** Passage d'une épreuve question par question (côté étudiant). */
export default async function passagesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireRole("ELEVE", "ETUDIANT"));

  fastify.post("/epreuves/:epreuveId/passages", async (request, reply) => {
    const { epreuveId } = epreuveIdParamSchema.parse(request.params);
    return reply.code(201).send(await passagesService.demarrerPassage(request.user.id, epreuveId));
  });

  fastify.get("/passages/:passageId", async (request) => {
    const { passageId } = passageIdParamSchema.parse(request.params);
    return passagesService.getPassage(request.user.id, passageId);
  });

  fastify.post("/passages/:passageId/questions/:cle/repondre", async (request) => {
    const { passageId, cle } = questionParamSchema.parse(request.params);
    const { reponseDonnee } = repondreQuestionSchema.parse(request.body);
    return passagesService.repondreQuestion(request.user.id, passageId, cle, reponseDonnee);
  });

  fastify.post("/passages/:passageId/terminer", async (request) => {
    const { passageId } = passageIdParamSchema.parse(request.params);
    return passagesService.terminerPassage(request.user.id, passageId);
  });

  fastify.get("/passages/:passageId/rapport", async (request) => {
    const { passageId } = passageIdParamSchema.parse(request.params);
    return passagesService.getRapport(request.user.id, passageId);
  });
}
