import fp from "fastify-plugin";
import cors from "@fastify/cors";

export default fp(async (fastify) => {
  await fastify.register(cors, {
    origin: process.env.VITE_ORIGIN ?? "http://localhost:5173",
  });
});
