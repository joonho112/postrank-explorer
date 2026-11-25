// Give the current task and its graphic the first screen. Keep the existing input nodes,
// their state, and their keyboard order together when crossing the phone breakpoint.
export function mobileControls(ctx, { primary, secondaryInputs = [], before = [], shortcut }) {
  const media = ctx.win.matchMedia?.("(max-width: 36em)");
  if (!media) return;

  const otherControls = ctx.h("div", { class: "prx-controls" });
  const secondary = ctx.h("div", { class: "prx-toolbar", role: "group", "aria-label": "More controls and presets", tabindex: "-1" }, otherControls);
  const destination = shortcut?.target ?? secondary;
  const jump = ctx.button({ label: shortcut?.label ?? "More controls", onClick: () => {
    destination.focus({ preventScroll: true });
    destination.scrollIntoView({ block: "start", inline: "nearest" });
  } }).root;
  const moved = [];
  function move(node, parent, next = null) {
    const marker = ctx.doc.createComment("wide layout");
    node.before(marker);
    moved.push([node, marker]);
    parent.insertBefore(node, next);
  }

  function arrange() {
    if (media.matches === secondary.isConnected) return;
    const focused = ctx.doc.activeElement;
    if (media.matches) {
      for (const node of [...ctx.controls.children]) {
        if (!primary.includes(node)) move(node, otherControls);
      }
      for (const node of secondaryInputs) move(node, otherControls);
      for (const node of [...ctx.toolbar.children]) {
        if (node !== ctx.controls) move(node, secondary);
      }
      for (const [node, next] of before) move(node, next.parentNode, next);
      ctx.stage.after(secondary);
      primary[0].after(jump);
    } else {
      for (const [node, marker] of moved.splice(0)) marker.replaceWith(node);
      jump.remove();
      secondary.remove();
    }
    if (focused === jump || focused === secondary) ctx.controls.querySelector("button, input, select, summary")?.focus({ preventScroll: true });
    else if (focused?.isConnected && ctx.root.contains(focused) && focused !== ctx.doc.activeElement) focused.focus({ preventScroll: true });
  }
  arrange();
  ctx.listen(media, "change", arrange);
}
