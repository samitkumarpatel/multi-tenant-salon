import { STAFF_PORTAL_API, apiFetch, uploadToPresignedUrl } from "~/lib/api";
import type { PresignedUpload } from "~/lib/types";

/** A work-gallery URL that points at a video rather than an image. */
export const isVideoUrl = (u?: string | null) =>
  !!u && /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(u);

/**
 * Uploads one work-sample file (image or short video) via the staff portal's
 * pre-signed URL flow and returns the stored public URL.
 */
export async function uploadWorkFile(staffId: number, file: File): Promise<string> {
  const upload = await apiFetch<PresignedUpload>(`${STAFF_PORTAL_API}/${staffId}/photo-upload-url`, {
    method: "POST",
    body: JSON.stringify({ contentType: file.type }),
  });
  await uploadToPresignedUrl(upload.presignedUrl, file);
  return upload.publicUrl;
}

/** Renders a work-gallery entry as a `<video>` or `<img>` depending on its URL. */
export function WorkMedia({ url, className }: { url: string; className: string }) {
  return isVideoUrl(url) ? (
    <video src={url} controls preload="metadata" className={`${className} bg-black`} />
  ) : (
    <img src={url} alt="Work sample" className={className} loading="lazy" />
  );
}
