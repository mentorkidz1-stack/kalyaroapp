import type { FastifyInstance } from "fastify";
import { registerSchema, loginSchema, createAdminSchema } from "./auth.schemas.js";
import { registerUser, authenticateUser, createAdmin, toSessionUser } from "./auth.service.js";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../plugins/error-handler.js";

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/register", async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const user = await registerUser(input);
    const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
    return reply.code(201).send({ token, user: toSessionUser(user) });
  });

  fastify.post("/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const user = await authenticateUser(input.email, input.password);
    const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
    return reply.send({ token, user: toSessionUser(user) });
  });

  fastify.get("/me", { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.id } });
    if (!user) throw new AppError("Utilisateur introuvable", 404);
    return reply.send({ user: toSessionUser(user) });
  });

  fastify.post(
    "/admins",
    { preHandler: fastify.requireRole("ADMIN") },
    async (request, reply) => {
      const input = createAdminSchema.parse(request.body);
      const admin = await createAdmin(input);
      return reply.code(201).send({ user: toSessionUser(admin) });
    }
  );
}
