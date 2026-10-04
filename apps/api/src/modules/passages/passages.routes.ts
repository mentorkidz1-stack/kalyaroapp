import type { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { AppError } from "../../plugins/error-handler.js";
import {
  epreuveIdParamSchema,
  passageIdParamSchema,
  questionParamSchema,
  repondreQuestionSchema,
  demarrerPassageSchema,
  enregistrerBrouillonSchema,
  rendreExamenSchema,
  copiePapierSchema,
} from "./passages.schemas.js";
import * as passagesService from "./passages.service.js";

const TYPES_PHOTO = ["image/jpeg", "image/png", "image/webp"] as const;
/** Photos par envoi : une réponse d'entraînement tient sur peu de pages, une copie sur plus. */
const MAX_PHOTOS_REPONSE = 3;
const MAX_PHOTOS_ENVOI_COPIE = 6;

function estFichier(v: unknown): v is MultipartFile {
  return !!v && typeof (v as MultipartFile).toBuffer === "function";
}

/** Lit et valide les photos d'un envoi multipart (champ « photos »). */
async function lirePhotos(body: unknown, max: number): Promise<passagesService.PhotoCopie[]> {
  const champ = (body as { photos?: unknown } | null)?.photos;
  const fichiers = (Array.isArray(champ) ? champ : [champ]).filter(estFichier);
  if (fichiers.length === 0) throw new AppError("Ajoute au moins une photo", 400);
  if (fichiers.length > max) throw new AppError(`Maximum ${max} photos par envoi`, 400);
  const photos: passagesService.PhotoCopie[] = [];
  for (const f of fichiers) {
    if (!(TYPES_PHOTO as readonly string[]).includes(f.mimetype)) {
      throw new AppError("Chaque photo doit être une image (jpeg, png ou webp)", 400);
    }
    photos.push({ buffer: await f.toBuffer(), mimeType: f.mimetype as (typeof TYPES_PHOTO)[number] });
  }
  return photos;
}

/** Passage d'une épreuve (côté étudiant) : entraînement question par question, ou examen blanc. */
export default async function passagesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.requireRole("ELEVE", "ETUDIANT"));

  fastify.post("/epreuves/:epreuveId/passages", async (request, reply) => {
    const { epreuveId } = epreuveIdParamSchema.parse(request.params);
    const { mode } = demarrerPassageSchema.parse(request.body ?? {});
    return reply.code(201).send(await passagesService.demarrerPassage(request.user.id, epreuveId, mode));
  });

  fastify.get("/passages/:passageId", async (request) => {
    const { passageId } = passageIdParamSchema.parse(request.params);
    return passagesService.getPassage(request.user.id, passageId);
  });

  fastify.post("/passages/:passageId/questions/:cle/repondre", async (request) => {
    const { passageId, cle } = questionParamSchema.parse(request.params);
    const { reponseDonnee } = repondreQuestionSchema.parse(request.body);
    return passagesService.repondreQuestion(request.user.id, passageId, cle, reponseDonnee);
  });

  fastify.post("/passages/:passageId/questions/:cle/repondre-photo", async (request) => {
    const { passageId, cle } = questionParamSchema.parse(request.params);
    const photos = await lirePhotos(request.body, MAX_PHOTOS_REPONSE);
    return passagesService.repondreQuestionPhoto(request.user.id, passageId, cle, photos);
  });

  // ---- Examen blanc : copie papier photographiée ----
  fastify.put("/passages/:passageId/copie-papier", async (request) => {
    const { passageId } = passageIdParamSchema.parse(request.params);
    const { actif } = copiePapierSchema.parse(request.body);
    return passagesService.choisirCopiePapier(request.user.id, passageId, actif);
  });

  fastify.post("/passages/:passageId/photos", async (request) => {
    const { passageId } = passageIdParamSchema.parse(request.params);
    const photos = await lirePhotos(request.body, MAX_PHOTOS_ENVOI_COPIE);
    return passagesService.ajouterPhotosCopie(request.user.id, passageId, photos);
  });

  fastify.delete("/passages/:passageId/photos", async (request) => {
    const { passageId } = passageIdParamSchema.parse(request.params);
    return passagesService.effacerPhotosCopie(request.user.id, passageId);
  });

  fastify.put("/passages/:passageId/brouillons/:cle", async (request) => {
    const { passageId, cle } = questionParamSchema.parse(request.params);
    const { texte, deltaSecondes } = enregistrerBrouillonSchema.parse(request.body);
    return passagesService.enregistrerBrouillon(request.user.id, passageId, cle, texte, deltaSecondes);
  });

  fastify.post("/passages/:passageId/rendre", async (request) => {
    const { passageId } = passageIdParamSchema.parse(request.params);
    const { brouillons } = rendreExamenSchema.parse(request.body ?? {});
    return passagesService.rendreExamen(request.user.id, passageId, brouillons);
  });

  fastify.post("/passages/:passageId/terminer", async (request) => {
    const { passageId } = passageIdParamSchema.parse(request.params);
    return passagesService.terminerPassage(request.user.id, passageId);
  });

  fastify.get("/passages/:passageId/rapport", async (request) => {
    const { passageId } = passageIdParamSchema.parse(request.params);
    return passagesService.getRapport(request.user.id, passageId);
  });
}
