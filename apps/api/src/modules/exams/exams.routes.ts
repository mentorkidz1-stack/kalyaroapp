import type { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import {
  idParamSchema,
  matiereIdParamSchema,
  epreuveIdParamSchema,
  createEpreuveSchema,
  createEpreuvePdfFieldsSchema,
  updateEpreuveSchema,
  createCorrigeSchema,
  createCorrigePdfFieldsSchema,
  updateCorrigeSchema,
  questionEpreuveIdParamSchema,
  remplacerQuestionsSchema,
  proposerDecoupageSchema,
  createCorrigeQuestionSchema,
  updateCorrigeQuestionSchema,
} from "./exams.schemas.js";
import * as examsService from "./exams.service.js";
import { AppError } from "../../plugins/error-handler.js";

interface EpreuveUploadBody {
  chapitreId?: { value: string };
  notionPrincipaleId?: { value: string };
  sourceCorrige?: { value: string };
  annee?: { value: string };
  session?: { value: string };
  examen?: { value: string };
  etablissementSource?: { value: string };
  dureeMinutes?: { value: string };
  bareme?: { value: string };
  pdf?: MultipartFile;
}
interface CorrigeUploadBody {
  estPrincipal?: { value: string };
  pdf?: MultipartFile;
}

function isMultipartFile(value: unknown): value is MultipartFile {
  return !!value && typeof (value as MultipartFile).toBuffer === "function";
}

export default async function examsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireRole("ADMIN"));

  fastify.get("/corriges/a-valider", async () => examsService.listCorrigesAValider());

  fastify.get("/matieres/:matiereId/epreuves", async (request) => {
    const { matiereId } = matiereIdParamSchema.parse(request.params);
    return examsService.listEpreuvesByMatiere(matiereId);
  });

  fastify.post("/matieres/:matiereId/epreuves", async (request, reply) => {
    const { matiereId } = matiereIdParamSchema.parse(request.params);
    const body = request.body as EpreuveUploadBody | Record<string, unknown>;

    if (isMultipartFile((body as EpreuveUploadBody).pdf)) {
      const uploadBody = body as EpreuveUploadBody;
      if (uploadBody.pdf!.mimetype !== "application/pdf") {
        throw new AppError("Le fichier doit être un PDF", 400);
      }
      const fields = createEpreuvePdfFieldsSchema.parse({
        chapitreId: uploadBody.chapitreId?.value || undefined,
        notionPrincipaleId: uploadBody.notionPrincipaleId?.value || undefined,
        sourceCorrige: uploadBody.sourceCorrige?.value,
        annee: uploadBody.annee?.value,
        session: uploadBody.session?.value || undefined,
        examen: uploadBody.examen?.value || undefined,
        etablissementSource: uploadBody.etablissementSource?.value || undefined,
        dureeMinutes: uploadBody.dureeMinutes?.value,
        bareme: uploadBody.bareme?.value,
      });
      const buffer = await uploadBody.pdf!.toBuffer();
      const epreuve = await examsService.createEpreuveFromPdf(matiereId, request.user.id, fields, buffer);
      return reply.code(201).send(epreuve);
    }

    const data = createEpreuveSchema.parse(request.body);
    return reply.code(201).send(await examsService.createEpreuve(matiereId, request.user.id, data));
  });

  fastify.patch("/epreuves/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = updateEpreuveSchema.parse(request.body);
    return examsService.updateEpreuve(id, data);
  });

  fastify.delete("/epreuves/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await examsService.deleteEpreuve(id);
    return reply.code(204).send();
  });

  fastify.get("/epreuves/:epreuveId/corriges", async (request) => {
    const { epreuveId } = epreuveIdParamSchema.parse(request.params);
    return examsService.listCorrigesByEpreuve(epreuveId);
  });

  fastify.post("/epreuves/:epreuveId/corriges", async (request, reply) => {
    const { epreuveId } = epreuveIdParamSchema.parse(request.params);
    const body = request.body as CorrigeUploadBody | Record<string, unknown>;

    if (isMultipartFile((body as CorrigeUploadBody).pdf)) {
      const uploadBody = body as CorrigeUploadBody;
      if (uploadBody.pdf!.mimetype !== "application/pdf") {
        throw new AppError("Le fichier doit être un PDF", 400);
      }
      const fields = createCorrigePdfFieldsSchema.parse({ estPrincipal: uploadBody.estPrincipal?.value });
      const buffer = await uploadBody.pdf!.toBuffer();
      const corrige = await examsService.createCorrigeFromPdf(
        epreuveId,
        request.user.id,
        fields.estPrincipal,
        buffer
      );
      return reply.code(201).send(corrige);
    }

    const data = createCorrigeSchema.parse(request.body);
    return reply.code(201).send(await examsService.createCorrige(epreuveId, request.user.id, data));
  });

  fastify.patch("/corriges/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = updateCorrigeSchema.parse(request.body);
    return examsService.updateCorrige(id, data);
  });

  fastify.post("/epreuves/:epreuveId/corriges/generate-ia", async (request, reply) => {
    const { epreuveId } = epreuveIdParamSchema.parse(request.params);
    return reply.code(201).send(await examsService.generateCorrigeIa(epreuveId, request.user.id));
  });

  // ---- Découpage en questions et corrigés par question (chantier 2.1) ----
  fastify.get("/corriges-questions/a-valider", async () => examsService.listCorrigesQuestionsAValider());

  fastify.get("/epreuves/:epreuveId/questions", async (request) => {
    const { epreuveId } = epreuveIdParamSchema.parse(request.params);
    return examsService.listQuestionsEpreuve(epreuveId);
  });

  fastify.put("/epreuves/:epreuveId/questions", async (request) => {
    const { epreuveId } = epreuveIdParamSchema.parse(request.params);
    const { questions } = remplacerQuestionsSchema.parse(request.body);
    return examsService.remplacerQuestionsEpreuve(epreuveId, questions);
  });

  fastify.post("/epreuves/:epreuveId/questions/proposer-ia", async (request) => {
    const { epreuveId } = epreuveIdParamSchema.parse(request.params);
    const { bareme } = proposerDecoupageSchema.parse(request.body ?? {});
    return examsService.proposerDecoupage(epreuveId, bareme);
  });

  fastify.post("/questions-epreuve/:questionId/corriges", async (request, reply) => {
    const { questionId } = questionEpreuveIdParamSchema.parse(request.params);
    const data = createCorrigeQuestionSchema.parse(request.body);
    return reply.code(201).send(await examsService.createCorrigeQuestion(questionId, request.user.id, data));
  });

  fastify.post("/questions-epreuve/:questionId/corriges/generate-ia", async (request, reply) => {
    const { questionId } = questionEpreuveIdParamSchema.parse(request.params);
    return reply.code(201).send(await examsService.generateCorrigeQuestionIa(questionId, request.user.id));
  });

  fastify.patch("/corriges-questions/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = updateCorrigeQuestionSchema.parse(request.body);
    return examsService.updateCorrigeQuestion(id, data);
  });

  fastify.delete("/corriges-questions/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await examsService.deleteCorrigeQuestion(id);
    return reply.code(204).send();
  });
}
