import fp from "fastify-plugin";
import cors from "@fastify/cors";

// VITE_ORIGIN accepte une liste séparée par des virgules — utile pendant la transition
// entre l'URL par défaut de l'hébergeur (ex. *.onrender.com) et un nom de domaine
// personnalisé, les deux devant rester autorisés en même temps.
const origins = (process.env.VITE_ORIGIN ?? "http://localhost:5173").split(",").map((o) => o.trim());

export default fp(async (fastify) => {
  await fastify.register(cors, {
    origin: origins,
  });
});
