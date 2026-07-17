import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
// Mode hors ligne explicitement exclu de cette version : le plugin PWA n'est
// utilisé ici que pour l'installabilité (manifest + icônes), pas pour un cache
// offline complexe (voir CONTEXTE ET VISION DU PROJET).
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            workbox: {
                globPatterns: ["index.html"],
            },
            manifest: {
                name: "Kalyaro",
                short_name: "Kalyaro",
                description: "Apprentissage adaptatif pour le Bénin — scolaire et universitaire",
                theme_color: "#1B7A5C",
                background_color: "#F3F5EF",
                display: "standalone",
                start_url: "/",
                icons: [
                    { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
                    { src: "/icons/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
                ],
            },
        }),
    ],
    server: { port: 5173 },
});
