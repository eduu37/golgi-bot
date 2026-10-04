import fs from "fs";
import { STATE_PATH } from "./config.js";

export function getLastIDSaved() {
  if (fs.existsSync(STATE_PATH)) {
    const contenido = fs.readFileSync(STATE_PATH, "utf8");
    if (contenido.trim() !== "") {
      try {
        const estado = JSON.parse(contenido);
        return estado.ultimoId;
      } catch (err) {
        console.log("⚠️ El archivo estado.json estaba corrupto. Se ignorará.");
      }
    }
  }
  return null;
}

export function guardarUltimoId(idMasReciente) {
  fs.writeFileSync(STATE_PATH, JSON.stringify({ ultimoId: idMasReciente }));
  console.log("💾 Progreso guardado.");
}
