import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const utilsPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "whatsapp-web.js",
  "src",
  "util",
  "Injected",
  "Utils.js"
);

if (fs.existsSync(utilsPath)) {
  let content = fs.readFileSync(utilsPath, "utf8");
  let modified = false;

  // 1. Patch groupMetadata.update (LID migration issue)
  if (
    content.includes("await groupMetadata.update(chatWid);") &&
    !content.includes("catch (errLastMsg)")
  ) {
    // If not already try-caught
  }

  // Check if try-catch is already present around groupMetadata.update
  if (
    content.includes("model.isGroup = true;\n            const chatWid = window")
  ) {
    content = content.replace(
      /if \(chat\.groupMetadata\) \{\s*model\.isGroup = true;\s*const chatWid = window[\s\S]*?model\.isReadOnly = chat\.groupMetadata\.announce;\s*\}/,
      `if (chat.groupMetadata) {
            model.isGroup = true;
            try {
                const chatWid = window
                    .require('WAWebWidFactory')
                    .createWid(chat.id._serialized);
                const groupMetadata =
                    window.require('WAWebCollections').GroupMetadata ||
                    window.require('WAWebCollections').WAWebGroupMetadataCollection;
                await groupMetadata.update(chatWid);
                const { toPn } = window.require('WAWebLidMigrationUtils');
                const serializedMetadata = chat.groupMetadata.serialize();
                for (const p of serializedMetadata.participants || []) {
                    p.id = toPn(p.id) ?? p.id;
                }
                model.groupMetadata = serializedMetadata;
                model.isReadOnly = chat.groupMetadata.announce;
            } catch (err) {
                try {
                    model.groupMetadata = chat.groupMetadata.serialize ? chat.groupMetadata.serialize() : chat.groupMetadata;
                } catch (e) {
                    model.groupMetadata = null;
                }
            }
        }`
    );
    modified = true;
  }

  // 2. Patch lastMessage IDBObjectStore DataError
  if (content.includes("chat.lastReceivedKey._serialized")) {
    content = content.replace(
      /model\.lastMessage = null;\s*if \(model\.msgs && model\.msgs\.length\) \{\s*const lastMessage = chat\.lastReceivedKey[\s\S]*?window\.WWebJS\.getMessageModel\(lastMessage\)\);\s*\}/,
      `model.lastMessage = null;
        try {
            if (model.msgs && model.msgs.length) {
                const key = chat.lastReceivedKey?._serialized || (typeof chat.lastReceivedKey === 'string' ? chat.lastReceivedKey : null);
                if (key) {
                    const lastMessage =
                        window.require('WAWebCollections').Msg.get(key) ||
                        (await window.require('WAWebCollections').Msg.getMessagesById([key]))?.messages?.[0];
                    if (lastMessage) {
                        model.lastMessage = window.WWebJS.getMessageModel(lastMessage);
                    }
                }
            }
        } catch (errLastMsg) {}`
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(utilsPath, content, "utf8");
    console.log("✅ whatsapp-web.js patch applied successfully!");
  } else {
    console.log("ℹ️ whatsapp-web.js is already patched.");
  }
} else {
  console.log("⚠️ whatsapp-web.js not found in node_modules, skipping patch.");
}
