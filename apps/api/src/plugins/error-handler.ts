import fp from "fastify-plugin";
import type { FastifyError } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AiGenerationError } from "@kalyaro/ai-service";

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export default fp(async (fastify) => {
  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Requête invalide",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    if (error instanceof AiGenerationError) {
      return reply.code(502).send({ error: `Échec de génération IA : ${error.message}` });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return reply.code(409).send({ error: "Cette ressource existe déjà" });
      }
      if (error.code === "P2025") {
        return reply.code(404).send({ error: "Ressource introuvable" });
      }
      if (error.code === "P2003") {
        return reply
          .code(409)
          .send({ error: "Cette ressource est encore référencée ailleurs et ne peut pas être supprimée" });
      }
    }
    // Erreurs Fastify natives (payload invalide, content-length, etc.) portent déjà un
    // statusCode < 500 exploitable — ne pas les masquer derrière un 500 générique.
    if (typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    fastify.log.error(error);
    return reply.code(500).send({ error: "Erreur interne du serveur" });
  });
});
