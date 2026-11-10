// velo/backend/events.js
import wixData from "wix-data";

// velo/backend/lib/media-import-receipt.js
var fail = (code) => {
  throw new Error(code);
};
var object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var hex = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
var nativeImage = (value) => typeof value === "string" && /^wix:image:\/\/v1\/[A-Za-z0-9_~.\-]+\/[^\s?#]+(?:#[^\s]*)?$/u.test(value);
var positive = (value) => Number.isSafeInteger(value) && value > 0;
var MIME_TYPES = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"]);
var RECEIPT_FIELDS = ["operationId", "key", "sourceUrl", "version", "fileUrl"];
function sourceUrl(value) {
  if (typeof value !== "string" || !value || value.length > 2048 || value !== value.trim()) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.hash;
}
async function call(operation, code, ...args) {
  try {
    return await operation(...args);
  } catch {
    fail(code);
  }
}
function identical(value, receipt) {
  return object(value) && RECEIPT_FIELDS.every((name) => value[name] === receipt[name]);
}
function createMediaImportReceiptHandler({ lookupIntent, lookupReceipt, insertReceipt }) {
  for (const fn of [lookupIntent, lookupReceipt, insertReceipt]) {
    if (typeof fn !== "function") fail("MEDIA_RECEIPT_INVALID_DEPENDENCIES");
  }
  return async function handleMediaImportReceipt(event) {
    const context = event?.context;
    if (!object(context) || context.integration !== "hektor" || context.importKind !== "url-v2") {
      return { status: "ignored" };
    }
    const info = event?.fileInfo;
    if (!hex(context.sourceUrlHash) || !hex(context.operationId) || !sourceUrl(context.sourceUrl) || typeof context.version !== "string" || !context.version || context.version.length > 256 || context.version !== context.version.trim() || /[\x00-\x1f\x7f]/u.test(context.version) || !object(info) || !nativeImage(info.fileUrl) || info.opStatus !== "READY" || info.mediaType !== "image" || info.isPrivate !== false || !MIME_TYPES.has(info.mimeType) || !positive(info.width) || !positive(info.height) || !positive(info.sizeInBytes) || info.sourceUrl !== void 0 && info.sourceUrl !== context.sourceUrl) {
      fail("MEDIA_RECEIPT_INVALID_EVENT");
    }
    const receipt = {
      operationId: context.operationId,
      key: context.sourceUrlHash,
      sourceUrl: context.sourceUrl,
      version: context.version,
      fileUrl: info.fileUrl
    };
    const intent = await call(lookupIntent, "MEDIA_RECEIPT_INTENT_READ_FAILED", receipt.key);
    if (!object(intent)) fail("MEDIA_RECEIPT_INTENT_NOT_FOUND");
    if (intent.key !== receipt.key || intent.operationId !== receipt.operationId || intent.sourceUrl !== receipt.sourceUrl || intent.version !== receipt.version || intent.fileUrl !== void 0 && intent.fileUrl !== receipt.fileUrl || intent.sourceMimeType !== void 0 && intent.sourceMimeType !== info.mimeType) {
      fail("MEDIA_RECEIPT_INTENT_CONFLICT");
    }
    const existing = await call(lookupReceipt, "MEDIA_RECEIPT_READ_FAILED", receipt.operationId);
    if (existing !== null) {
      if (!identical(existing, receipt)) fail("MEDIA_RECEIPT_CONFLICT");
      return { status: "reused" };
    }
    try {
      await insertReceipt(receipt);
    } catch {
      const raced = await call(lookupReceipt, "MEDIA_RECEIPT_READ_FAILED", receipt.operationId);
      if (raced === null) fail("MEDIA_RECEIPT_WRITE_FAILED");
      if (!identical(raced, receipt)) fail("MEDIA_RECEIPT_CONFLICT");
      return { status: "reused" };
    }
    return { status: "recorded" };
  };
}

// velo/backend/events.js
var collection = "HektorMediaCache";
var READ = { suppressAuth: true, consistentRead: true };
var WRITE = { suppressAuth: true };
async function lookup(id) {
  const result = await wixData.query(collection).eq("_id", id).limit(1).find(READ);
  return result.items[0] || null;
}
var handler = createMediaImportReceiptHandler({
  async lookupIntent(key) {
    const row = await lookup(`url_${key.slice(0, 28)}`);
    return row ? { ...row, key: row.sourceUrlHash } : null;
  },
  async lookupReceipt(operationId) {
    const row = await lookup(`receipt_${operationId.slice(0, 24)}`);
    return row ? {
      operationId: row.operationId,
      key: row.sourceUrlHash,
      sourceUrl: row.sourceUrl,
      version: row.version,
      fileUrl: row.fileUrl
    } : null;
  },
  async insertReceipt(receipt) {
    const { key, ...fields } = receipt;
    await wixData.insert(collection, {
      ...fields,
      sourceUrlHash: key,
      _id: `receipt_${receipt.operationId.slice(0, 24)}`,
      receivedAt: /* @__PURE__ */ new Date()
    }, WRITE);
  }
});
async function wixMediaManager_onFileUploaded(event) {
  const result = await handler(event);
  if (result.status !== "ignored") console.info("HEKTOR_MEDIA_RECEIPT", JSON.stringify(result));
  return result;
}
export {
  wixMediaManager_onFileUploaded
};
