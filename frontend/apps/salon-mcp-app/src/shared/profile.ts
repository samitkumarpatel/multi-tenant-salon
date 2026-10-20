import { button, h, isVideo } from "./dom";
import type { Staff } from "./booking";

/**
 * A stylist's portfolio grid with a lightbox. The app iframe grows to fit its content, so a
 * viewport-centred viewer could open far from where the visitor tapped — the lightbox is
 * anchored at the tap instead.
 */
export class PortfolioGallery {
  mediaIndex: number | undefined;
  /** Document y of the tap that opened the viewer. */
  anchor = 0;

  close() {
    this.mediaIndex = undefined;
  }

  render(member: Staff, rerender: () => void) {
    const media = (member.workMedia ?? []).filter((u): u is string => typeof u === "string" && !!u);
    if (!media.length) return null;
    const grid = h("div", { class: "profile-gallery" }, media.map((url, index) => button(
      isVideo(url)
        ? [h("video", { src: url, muted: true, preload: "metadata" }), h("span", { class: "video-badge" }, "▶")]
        : h("img", { src: url, alt: `${member.name} portfolio ${index + 1}`, loading: "lazy" }),
      (event) => {
        this.mediaIndex = index;
        this.anchor = event instanceof MouseEvent && event.pageY ? Math.max(0, event.pageY - 200) : 0;
        rerender();
      }, "media-thumb", { "aria-label": `Open portfolio item ${index + 1}` })));
    if (this.mediaIndex === undefined || !media[this.mediaIndex]) return grid;

    const url = media[this.mediaIndex]!;
    const close = () => { this.mediaIndex = undefined; rerender(); };
    const step = (delta: number) => { this.mediaIndex = (this.mediaIndex! + delta + media.length) % media.length; rerender(); };
    const lightbox = h("div", {
      class: "lightbox",
      role: "dialog",
      "aria-label": `${member.name} portfolio`,
      style: { paddingTop: `${this.anchor + 48}px` },
      onClick: (event: Event) => { if (event.target === lightbox) close(); },
      onKeydown: (event: KeyboardEvent) => { if (event.key === "Escape") close(); },
    },
    button("×", close, "lightbox-close", { "aria-label": "Close viewer" }),
    isVideo(url)
      ? h("video", { class: "lightbox-media", src: url, controls: true, autoplay: true })
      : h("img", { class: "lightbox-media", src: url, alt: `${member.name} portfolio` }),
    media.length > 1 ? [
      button("‹", () => step(-1), "lightbox-nav lightbox-prev", { "aria-label": "Previous" }),
      button("›", () => step(1), "lightbox-nav lightbox-next", { "aria-label": "Next" }),
    ] : null);
    return [grid, lightbox];
  }
}
