import type { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import {
  idParamSchema,
  matiereIdParamSchema,
  photoParamSchema,
  createEvaluationFieldsSchema,
  updateEvaluationSchema,
  corrigerCopieSchema,
  genererFeedbackIaSchema,
  soumettreCopieSchema,
  MAX_PHOTOS,
  ALLOWED_IMAGE_MIMETYPES,
} from "./evaluations.schemas.js";
import * as evaluationsService from "./evaluations.service.js";
import { AppError } from "../../plugins/error-handler.js";

interface EvaluationUploadBody {
  titre?: { value: string };
  chapitreId?: { value: string };
  enonce?: { value: string };
  dureeMinutes?: { value: string };
  bareme?: { value: string };
  pdf?: MultipartFile;
}

interface SoumettreCopieBody {
  reponseDonnee?: { value: string };
  photos?: MultipartFile | MultipartFile[];
}

function normalizeFiles(files: MultipartFile | MultipartFile[] | undefined): MultipartFile[] {
  if (!files) return [];
  return Array.isArray(files) ? files : [files];
}

export async function evaluationsAdminRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireRole("ADMIN"));

  fastify.post("/matieres/:matiereId/evaluations", async (request, reply) => {
    const { matiereId } = matiereIdParamSchema.parse(request.params);
    const body = request.body as EvaluationUploadBody;
    const fields = createEvaluationFieldsSchema.parse({
      titre: body.titre?.value,
      chapitreId: body.chapitreId?.value || undefined,
      enonce: body.enonce?.value,
      dureeMinutes: body.dureeMinutes?.value,
      bareme: body.bareme?.value,
    });
    if (body.pdf && body.pdf.mimetype !== "application/pdf") {
      throw new AppError("Le fichier doit être un PDF", 400);
    }
    const pdf = body.pdf ? { filename: body.pdf.filename, buffer: await body.pdf.toBuffer() } : undefined;
    const evaluation = await evaluationsService.createEvaluation(matiereId, request.user.id, fields, pdf);
    return reply.code(201).send(evaluation);
  });

  fastify.get("/matieres/:matiereId/evaluations", async (request) => {
    const { matiereId } = matiereIdParamSchema.parse(request.params);
    return evaluationsService.listEvaluationsByMatiere(matiereId);
  });

  fastify.get("/evaluations/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return evaluationsService.getEvaluation(id);
  });

  fastify.patch("/evaluations/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = updateEvaluationSchema.parse(request.body);
    return evaluationsService.updateEvaluation(id, data);
  });

  fastify.delete("/evaluations/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await evaluationsService.deleteEvaluation(id);
    return reply.code(204).send();
  });

  fastify.get("/evaluations/:id/pdf", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const { stream, titre } = await evaluationsService.getEvaluationPdfStream(id);
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `inline; filename="${encodeURIComponent(titre)}.pdf"`);
    return reply.send(stream);
  });

  fastify.get("/copies/a-corriger", async () => evaluationsService.listCopiesACorriger());
  fastify.get("/copies/corrigees", async () => evaluationsService.listCopiesCorrigees());

  fastify.get("/copies/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return evaluationsService.getCopieAdmin(id);
  });

  fastify.post("/copies/:id/corriger", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = corrigerCopieSchema.parse(request.body);
    return evaluationsService.corrigerCopie(id, request.user.id, data);
  });

  fastify.post("/copies/:id/generer-feedback-ia", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = genererFeedbackIaSchema.parse(request.body);
    return evaluationsService.genererFeedbackIa(id, data);
  });

  fastify.get("/copies/:id/photo/:index", async (request, reply) => {
    const { id, index } = photoParamSchema.parse(request.params);
    const { stream, contentType } = await evaluationsService.getCopiePhotoStreamAdmin(id, index);
    reply.header("Content-Type", contentType);
    return reply.send(stream);
  });
}

export async function evaluationsEleveRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireRole("ELEVE", "ETUDIANT"));

  fastify.get("/matieres/:matiereId/evaluations", async (request) => {
    const { matiereId } = matiereIdParamSchema.parse(request.params);
    return evaluationsService.listEvaluationsForEleve(request.user.id, matiereId);
  });

  fastify.post("/evaluations/:id/demarrer", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    return reply.code(201).send(await evaluationsService.demarrerCopie(request.user.id, id));
  });

  fastify.get("/copies/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return evaluationsService.getCopieForEleve(request.user.id, id);
  });

  fastify.post("/copies/:id/soumettre", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const body = request.body as SoumettreCopieBody;
    const { reponseDonnee } = soumettreCopieSchema.parse({ reponseDonnee: body.reponseDonnee?.value ?? "" });

    const photoFiles = normalizeFiles(body.photos);
    if (photoFiles.length > MAX_PHOTOS) {
      throw new AppError(`Maximum ${MAX_PHOTOS} photos par copie`, 400);
    }
    for (const photo of photoFiles) {
      if (!ALLOWED_IMAGE_MIMETYPES.includes(photo.mimetype)) {
        throw new AppError("Chaque photo doit être une image (jpeg, png, webp)", 400);
      }
    }
    const photos = await Promise.all(
      photoFiles.map(async (f) => ({ filename: f.filename, buffer: await f.toBuffer() }))
    );

    return evaluationsService.soumettreCopie(request.user.id, id, reponseDonnee, photos);
  });

  fastify.get("/copies/:id/photo/:index", async (request, reply) => {
    const { id, index } = photoParamSchema.parse(request.params);
    const { stream, contentType } = await evaluationsService.getCopiePhotoStreamForEleve(request.user.id, id, index);
    reply.header("Content-Type", contentType);
    return reply.send(stream);
  });

  fastify.get("/evaluations/:id/pdf", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const { stream, titre } = await evaluationsService.getEvaluationPdfStreamForEleve(request.user.id, id);
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `inline; filename="${encodeURIComponent(titre)}.pdf"`);
    return reply.send(stream);
  });
}
