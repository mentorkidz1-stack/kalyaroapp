import type { FastifyInstance } from "fastify";
import { idParamSchema, listUsersQuerySchema, updateUserSchema } from "./users.schemas.js";
import * as usersService from "./users.service.js";
import { AppError } from "../../plugins/error-handler.js";

export default async function usersRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireRole("ADMIN"));

  fastify.get("/users", async (request) => {
    const filters = listUsersQuerySchema.parse(request.query);
    return usersService.listUsers(filters);
  });

  fastify.get("/users/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return usersService.getUser(id);
  });

  fastify.patch("/users/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = updateUserSchema.parse(request.body);
    if (id === request.user.id && data.actif === false) {
      throw new AppError("Tu ne peux pas désactiver ton propre compte", 400);
    }
    return usersService.updateUser(id, data);
  });
}
