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
    console.log("✅ whatsapp-web.js Utils.js patch applied successfully!");
  } else {
    console.log("ℹ️ whatsapp-web.js Utils.js is already patched.");
  }
} else {
  console.log("⚠️ whatsapp-web.js Utils.js not found in node_modules, skipping patch.");
}

const messagePath = path.join(
  __dirname,
  "..",
  "node_modules",
  "whatsapp-web.js",
  "src",
  "structures",
  "Message.js"
);

if (fs.existsSync(messagePath)) {
  let content = fs.readFileSync(messagePath, "utf8");
  if (content.includes("}, this.id._serialized);")) {
    content = content.replace(
      /const result = await this\.client\.pupPage\.evaluate\(async \(msgId\) => \{[\s\S]*?\}, this\.id\._serialized\);/,
      `const result = await this.client.pupPage.evaluate(async (msgId, rawId) => {
            let searchId = typeof msgId === 'string' ? msgId : (msgId?._serialized || msgId?.['$1'] || null);
            if (!searchId && rawId) {
                searchId = typeof rawId === 'string' ? rawId : (rawId._serialized || rawId['$1'] || rawId.id);
            }

            let msg = searchId ? window.require('WAWebCollections').Msg.get(searchId) : null;
            if (!msg && searchId) {
                try {
                    msg = (await window.require('WAWebCollections').Msg.getMessagesById([searchId]))?.messages?.[0];
                } catch (e) {}
            }
            if (!msg && rawId) {
                const targetId = typeof rawId === 'string' ? rawId : (rawId.id || rawId._serialized || rawId['$1']);
                const all = window.require('WAWebCollections').Msg.getModelsArray();
                msg = all.find(m => {
                    if (!m.id) return false;
                    return m.id._serialized === targetId || m.id['$1'] === targetId || m.id.id === targetId || m.id === targetId;
                });
            }

            if (
                !msg ||
                !msg.mediaData ||
                msg.mediaData.mediaStage === 'REUPLOADING'
            ) {
                return null;
            }
            if (msg.mediaData.mediaStage != 'RESOLVED') {
                try {
                    await msg.downloadMedia({
                        downloadEvenIfExpensive: true,
                        rmrReason: 1,
                    });
                } catch (e) {}
            }

            if (
                msg.mediaData.mediaStage &&
                (msg.mediaData.mediaStage.includes('ERROR') || msg.mediaData.mediaStage === 'FETCHING')
            ) {
                return undefined;
            }

            try {
                const mockQpl = {
                    addAnnotations: function () {
                        return this;
                    },
                    addPoint: function () {
                        return this;
                    },
                };
                const decryptedMedia = await window
                    .require('WAWebDownloadManager')
                    .downloadManager.downloadAndMaybeDecrypt({
                        directPath: msg.directPath,
                        encFilehash: msg.encFilehash,
                        filehash: msg.filehash,
                        mediaKey: msg.mediaKey,
                        mediaKeyTimestamp: msg.mediaKeyTimestamp,
                        type: msg.type,
                        signal: new AbortController().signal,
                        downloadQpl: mockQpl,
                    });

                const data =
                    await window.WWebJS.arrayBufferToBase64Async(
                        decryptedMedia,
                    );

                return {
                    data,
                    mimetype: msg.mimetype,
                    filename: msg.filename,
                    filesize: msg.size,
                };
            } catch (e) {
                return undefined;
            }
        }, this.id?._serialized || this.id?.['$1'] || this.id, this.id);`
    );
    fs.writeFileSync(messagePath, content, "utf8");
    console.log("✅ whatsapp-web.js Message.js patch applied successfully!");
  } else {
    console.log("ℹ️ whatsapp-web.js Message.js is already patched.");
  }
}

// 3. Patch app-builder-lib resEdit.js to prevent Windows EBUSY file-lock race condition
const resEditPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "app-builder-lib",
  "out",
  "util",
  "resEdit.js"
);

if (fs.existsSync(resEditPath)) {
  let content = fs.readFileSync(resEditPath, "utf8");
  if (!content.includes("for (let attempt = 1; attempt <= 10; attempt++)")) {
    content = content.replace(
      /await \(0, promises_1\.writeFile\)\(opts\.file, Buffer\.from\(executable\.generate\(\)\)\);/,
      `const exeBuf = Buffer.from(executable.generate());
    let written = false;
    for (let attempt = 1; attempt <= 10; attempt++) {
        try {
            await (0, promises_1.writeFile)(opts.file, exeBuf);
            written = true;
            break;
        } catch (err) {
            if ((err.code === "EBUSY" || err.code === "EPERM") && attempt < 10) {
                await new Promise((r) => setTimeout(r, 1000));
            } else {
                throw err;
            }
        }
    }`
    );
    fs.writeFileSync(resEditPath, content, "utf8");
    console.log("✅ app-builder-lib resEdit.js patch applied successfully!");
  }
}

