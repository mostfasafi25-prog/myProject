/** ملف يُعتبر «كبيراً» ويُضغط بقوة أكبر */
const LARGE_FILE_BYTES = 350 * 1024;
const VERY_LARGE_FILE_BYTES = 1.2 * 1024 * 1024;
/** طول data URL بعد الضغط — إن تجاوز نعيد تمريراً أشد */
const TARGET_MAX_DATA_URL_CHARS = 280_000;

/**
 * ضغط مناسب لرفع الصور في الموقع (متعدد المراحل حسب حجم الملف ونتيجة الضغط).
 * يُفضّل استخدامه بدل compressImageFileToDataUrl لكل اختيار ملف من المستخدم.
 */
export async function compressImageFileForUpload(file) {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("not_image");
  }
  const sz = file.size || 0;
  let maxEdge = 720;
  let quality = 0.82;
  if (sz > VERY_LARGE_FILE_BYTES) {
    maxEdge = 480;
    quality = 0.72;
  } else if (sz > LARGE_FILE_BYTES) {
    maxEdge = 600;
    quality = 0.78;
  }
  let dataUrl = await compressImageFileToDataUrl(file, maxEdge, quality);
  if (dataUrl.length > TARGET_MAX_DATA_URL_CHARS) {
    dataUrl = await compressImageFileToDataUrl(file, 480, 0.72);
  }
  if (dataUrl.length > TARGET_MAX_DATA_URL_CHARS) {
    dataUrl = await compressImageFileToDataUrl(file, 400, 0.68);
  }
  if (dataUrl.length > TARGET_MAX_DATA_URL_CHARS) {
    dataUrl = await compressImageFileToDataUrl(file, 320, 0.62);
  }
  if (dataUrl.length > TARGET_MAX_DATA_URL_CHARS) {
    dataUrl = await compressImageFileToDataUrl(file, 256, 0.58);
  }
  return dataUrl;
}

/**
 * يصغّر الصورة ويحوّلها إلى JPEG لتقليل الحجم (مهم لـ localStorage وسرعة العرض).
 */
export function compressImageFileToDataUrl(file, maxEdge = 480, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("not_image"));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (!w || !h) {
        reject(new Error("bad_size"));
        return;
      }
      const scale = Math.min(1, maxEdge / Math.max(w, h));
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("no_canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("load_fail"));
    };
    img.src = url;
  });
}

/** لا يُخزَّن data:/blob: في localStorage — استخدم رابط https (صور الأصناف وغيرها). */
export function productImageForLocalStorage(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (s.startsWith("data:") || s.startsWith("blob:")) return "";
  return s;
}
