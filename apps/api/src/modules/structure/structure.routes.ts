import type { FastifyInstance } from "fastify";
import {
  idParamSchema,
  createClasseSchema,
  updateClasseSchema,
  createMatiereScolaireSchema,
  updateMatiereScolaireSchema,
  createFiliereSchema,
  updateFiliereSchema,
  createNiveauUniversitaireSchema,
  updateNiveauUniversitaireSchema,
  createUEMatiereSchema,
  updateUEMatiereSchema,
} from "./structure.schemas.js";
import * as structureService from "./structure.service.js";

/** Lecture publique — nécessaire pour l'écran d'inscription (choix classe / filière / niveau / UE). */
export async function structurePublicRoutes(fastify: FastifyInstance) {
  fastify.get("/classes", async () => structureService.listClasses());
  fastify.get("/filieres", async () => structureService.listFilieres());
  fastify.get("/filieres/:id/niveaux", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return structureService.listNiveauxByFiliere(id);
  });
  fastify.get("/niveaux/:id/ue-matieres", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return structureService.listUEMatieresByNiveau(id);
  });
  fastify.get("/classes/:id/matieres", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    return structureService.listMatieresScolairesByClasse(id);
  });
}

/** Écriture admin uniquement. */
export async function structureAdminRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireRole("ADMIN"));

  // Classes
  fastify.post("/classes", async (request, reply) => {
    const data = createClasseSchema.parse(request.body);
    return reply.code(201).send(await structureService.createClasse(data));
  });
  fastify.patch("/classes/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = updateClasseSchema.parse(request.body);
    return structureService.updateClasse(id, data);
  });
  fastify.delete("/classes/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await structureService.deleteClasse(id);
    return reply.code(204).send();
  });

  // Matières scolaires
  fastify.post("/matieres-scolaires", async (request, reply) => {
    const data = createMatiereScolaireSchema.parse(request.body);
    return reply.code(201).send(await structureService.createMatiereScolaire(data));
  });
  fastify.patch("/matieres-scolaires/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = updateMatiereScolaireSchema.parse(request.body);
    return structureService.updateMatiereScolaire(id, data);
  });
  fastify.delete("/matieres-scolaires/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await structureService.deleteMatiereScolaire(id);
    return reply.code(204).send();
  });

  // Filières
  fastify.post("/filieres", async (request, reply) => {
    const data = createFiliereSchema.parse(request.body);
    return reply.code(201).send(await structureService.createFiliere(data));
  });
  fastify.patch("/filieres/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = updateFiliereSchema.parse(request.body);
    return structureService.updateFiliere(id, data);
  });
  fastify.delete("/filieres/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await structureService.deleteFiliere(id);
    return reply.code(204).send();
  });

  // Niveaux universitaires
  fastify.post("/niveaux-universitaires", async (request, reply) => {
    const data = createNiveauUniversitaireSchema.parse(request.body);
    return reply.code(201).send(await structureService.createNiveauUniversitaire(data));
  });
  fastify.patch("/niveaux-universitaires/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = updateNiveauUniversitaireSchema.parse(request.body);
    return structureService.updateNiveauUniversitaire(id, data);
  });
  fastify.delete("/niveaux-universitaires/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await structureService.deleteNiveauUniversitaire(id);
    return reply.code(204).send();
  });

  // UE / matières universitaires
  fastify.post("/ue-matieres", async (request, reply) => {
    const data = createUEMatiereSchema.parse(request.body);
    return reply.code(201).send(await structureService.createUEMatiere(data));
  });
  fastify.patch("/ue-matieres/:id", async (request) => {
    const { id } = idParamSchema.parse(request.params);
    const data = updateUEMatiereSchema.parse(request.body);
    return structureService.updateUEMatiere(id, data);
  });
  fastify.delete("/ue-matieres/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    await structureService.deleteUEMatiere(id);
    return reply.code(204).send();
  });
}
