import type { MetadataRoute } from "next";

/** Manifesto do app: permite instalar no celular ("Adicionar à tela de início"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "V'Sensi Gestão",
    short_name: "V'Sensi",
    description: "Sistema de gestão da V'Sensi",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#14171c",
    theme_color: "#0b1e3b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
