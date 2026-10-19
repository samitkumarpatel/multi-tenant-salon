import { avatar, button, firstName, h, isVideo } from "./dom";
import { enumLabel } from "./format";
import type { Service, Staff } from "./booking";
import { serviceSummary } from "./booking";

/**
 * A stylist's profile as a modal dialog: bio, specialisations, services and a portfolio
 * gallery with a lightbox. Holds only its own open/media state; the app decides what
 * "Book with …" does. The app iframe grows to fit its content, so a viewport-centred modal
 * could open far from where the visitor tapped — the dialog is anchored at the tap instead.
 */
export class StaffProfile {
  member: Staff | undefined;
  mediaIndex: number | undefined;
  /** Document y of the tap that opened the profile. */
  anchor = 0;

  open(member: Staff, event?: Event) {
    this.member = member;
    this.mediaIndex = undefined;
    this.anchor = event instanceof MouseEvent && event.pageY ? Math.max(0, event.pageY - 140) : 0;
  }

  close() {
    this.member = undefined;
    this.mediaIndex = undefined;
  }

  render(opts: { services: Service[]; bookingEnabled: boolean; rerender: () => void; onBook?: (member: Staff) => void }) {
    const member = this.member;
    if (!member) return null;
    const close = () => { this.close(); opts.rerender(); };
    const media = (member.workMedia ?? []).filter((u): u is string => typeof u === "string" && !!u);
    const services = opts.services.filter((s) => (member.serviceIds ?? []).includes(s.id)
      || (s.staffIds ?? []).includes(member.id));
    const first = firstName(member.name);

    const dialog = h("section", { class: "profile-dialog", role: "dialog", "aria-modal": "true", "aria-label": `${member.name} profile`, style: { marginTop: `${this.anchor}px` } },
      h("div", { class: "profile-header" },
        avatar(member.name, member.avatarUrl, "profile-avatar"),
        h("div", { class: "row-body" },
          h("span", { class: "profile-name" }, member.name),
          member.role ? h("span", { class: "row-meta" }, enumLabel(member.role)) : null),
        button("Close", close, "btn small")),
      h("div", { class: "profile-content" },
        member.specializations?.length
          ? h("div", { class: "chip-row" }, member.specializations.map((s) => h("span", { class: "tag" }, s)))
          : null,
        member.bio ? [h("h3", { class: "section-title" }, `About ${first}`), h("p", { class: "row-description" }, member.bio)] : null,
        services.length ? [
          h("h3", { class: "section-title" }, `${first}'s services`),
          h("ul", { class: "mini-list" }, services.map((s) => h("li", null, h("span", null, s.name), h("span", { class: "muted" }, serviceSummary(s))))),
        ] : null,
        media.length ? [
          h("h3", { class: "section-title" }, `${first}'s work · ${media.length}`),
          h("div", { class: "profile-gallery" }, media.map((url, index) => button(
            isVideo(url)
              ? [h("video", { src: url, muted: true, preload: "metadata" }), h("span", { class: "video-badge" }, "▶")]
              : h("img", { src: url, alt: `${member.name} portfolio ${index + 1}`, loading: "lazy" }),
            () => { this.mediaIndex = index; opts.rerender(); }, "media-thumb", { "aria-label": `Open portfolio item ${index + 1}` }))),
        ] : null,
        !member.bio && !media.length ? h("p", { class: "muted" }, "This stylist hasn't added a bio or portfolio yet.") : null),
      opts.bookingEnabled && member.availableForBooking !== false && opts.onBook
        ? h("footer", { class: "profile-footer" }, button(`Book with ${first}`, () => opts.onBook!(member), "btn primary wide"))
        : null);

    const overlay = h("div", {
      class: "profile-overlay",
      onClick: (event: Event) => { if (event.target === overlay) close(); },
      onKeydown: (event: KeyboardEvent) => { if (event.key === "Escape") close(); },
    }, dialog);

    if (this.mediaIndex !== undefined && media[this.mediaIndex]) {
      const url = media[this.mediaIndex]!;
      const step = (delta: number) => { this.mediaIndex = (this.mediaIndex! + delta + media.length) % media.length; opts.rerender(); };
      const lightbox = h("div", {
        class: "lightbox",
        style: { paddingTop: `${this.anchor + 48}px` },
        onClick: (event: Event) => { if (event.target === lightbox) { this.mediaIndex = undefined; opts.rerender(); } },
      },
      button("×", () => { this.mediaIndex = undefined; opts.rerender(); }, "lightbox-close", { "aria-label": "Close viewer" }),
      isVideo(url)
        ? h("video", { class: "lightbox-media", src: url, controls: true, autoplay: true })
        : h("img", { class: "lightbox-media", src: url, alt: `${member.name} portfolio` }),
      media.length > 1 ? [
        button("‹", () => step(-1), "lightbox-nav lightbox-prev", { "aria-label": "Previous" }),
        button("›", () => step(1), "lightbox-nav lightbox-next", { "aria-label": "Next" }),
      ] : null);
      overlay.append(lightbox);
    }
    return overlay;
  }
}
