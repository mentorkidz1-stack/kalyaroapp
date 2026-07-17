import type { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import {
  createCoursFieldsSchema,
  updateCoursSchema,
  createChapitreSchema,
  updateChapitreSchema,
  idParamSchema,
  coursChapitreParamSchema,
} from "./courses.schemas.js";
import * as coursesService from "./courses.service.js";
import { AppError } from "../../plugins/error-handler.js";

interface CoursUploadBody {
  titre?: { value: string };
  matiereId?: { value: string };
  pdf?: MultipartFile;
}

export default async function coursesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireRole("ADMIN"));

  fastify.post("/cours", async (request, reply) => {
    const body = request.body as CoursUploadBody;
    if (!body.pdf || typeof body.pdf.toBuffer !== "function") {
      throw new AppError("Fichier PDF requis (champ 'pdf')", 400);
    }
    if (body.pdf.mimetype !== "application/pdf") {
      throw new AppError("Le fichier doit être un PDF", 400);
    }
    const fields = createCoursFieldsSchema.parse({
      titre: body.titre?.value,
      matiereId: body.matiereId?.value,
    });
    const buffer = await body.pdf.toBuffer();
    const cours = await coursesService.saveCoursPdf({
      ...fields,
      createdById: request.user.id,
      filename: body.pdf.filename,
      buffer,
    });
    return reply.code(201).send(cours);
  });

  fastify.get("/cours", async () => coursesService.listCours());

  fastify.get("/cours/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return coursesService.getCours(id);
  });

  fastify.patch("/cours/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = updateCoursSchema.parse(request.body);
    return coursesService.updateCours(id, data);
  });

  fastify.delete("/cours/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await coursesService.deleteCours(id);
    return reply.code(204).send();
  });

  fastify.get("/cours/:id/pdf", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const { stream, titre } = await coursesService.getCoursPdfStream(id);
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `inline; filename="${encodeURIComponent(titre)}.pdf"`);
    return reply.send(stream);
  });

  fastify.post("/cours/:coursId/chapitres", async (request, reply) => {
    const { coursId } = coursChapitreParamSchema.parse(request.params);
    const data = createChapitreSchema.parse(request.body);
    return reply.code(201).send(await coursesService.createChapitre(coursId, data));
  });

  fastify.get("/chapitres/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return coursesService.getChapitre(id);
  });

  fastify.patch("/chapitres/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = updateChapitreSchema.parse(request.body);
    return coursesService.updateChapitre(id, data);
  });

  fastify.delete("/chapitres/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await coursesService.deleteChapitre(id);
    return reply.code(204).send();
  });

  fastify.post("/chapitres/:id/pdf", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const body = request.body as { pdf?: MultipartFile };
    if (!body.pdf || typeof body.pdf.toBuffer !== "function") {
      throw new AppError("Fichier PDF requis (champ 'pdf')", 400);
    }
    if (body.pdf.mimetype !== "application/pdf") {
      throw new AppError("Le fichier doit être un PDF", 400);
    }
    const buffer = await body.pdf.toBuffer();
    const chapitre = await coursesService.saveChapitrePdf(id, body.pdf.filename, buffer);
    return reply.code(201).send(chapitre);
  });
}
