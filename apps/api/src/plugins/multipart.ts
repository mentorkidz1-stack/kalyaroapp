import fp from "fastify-plugin";
import multipart from "@fastify/multipart";

export default fp(async (fastify) => {
  await fastify.register(multipart, {
    attachFieldsToBody: true,
    limits: {
      fileSize: 20 * 1024 * 1024, // 20 Mo, suffisant pour un support de cours PDF
      files: 6, // jusqu'à 5 photos de réponse + marge (le contrôle exact du plafond se fait côté service)
    },
  });
});
