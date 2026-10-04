import type { FastifyInstance } from "fastify";
import {
  epreuveIdParamSchema,
  passageIdParamSchema,
  questionParamSchema,
  repondreQuestionSchema,
  demarrerPassageSchema,
  enregistrerBrouillonSchema,
  rendreExamenSchema,
} from "./passages.schemas.js";
import * as passagesService from "./passages.service.js";

/** Passage d'une épreuve (côté étudiant) : entraînement question par question, ou examen blanc. */
export default async function passagesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireRole("ELEVE", "ETUDIANT"));

  fastify.post("/epreuves/:epreuveId/passages", async (request, reply) => {
    const { epreuveId } = epreuveIdParamSchema.parse(request.params);
    const { mode } = demarrerPassageSchema.parse(request.body ?? {});
    return reply.code(201).send(await passagesService.demarrerPassage(request.user.id, epreuveId, mode));
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

  fastify.put("/passages/:passageId/brouillons/:cle", async (request) => {
    const { passageId, cle } = questionParamSchema.parse(request.params);
    const { texte, deltaSecondes } = enregistrerBrouillonSchema.parse(request.body);
    return passagesService.enregistrerBrouillon(request.user.id, passageId, cle, texte, deltaSecondes);
  });

  fastify.post("/passages/:passageId/rendre", async (request) => {
    const { passageId } = passageIdParamSchema.parse(request.params);
    const { brouillons } = rendreExamenSchema.parse(request.body ?? {});
    return passagesService.rendreExamen(request.user.id, passageId, brouillons);
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
