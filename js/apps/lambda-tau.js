// App entry point for lambda-tau (5.1, Frame v2); shared model/views in ../shared/domain/lambda-tau.js.
export * from "../shared/domain/lambda-tau.js";

import { createWidget } from "../shared/base.js";
import { formatSetting } from "../shared/format.js";
import { captionNode } from "../shared/labels.js";
import {
  BRIDGE_CSS,
  bridgeKeys,
  createAxisControls,
  createConverterView,
  createEndpointNote,
  createIdentityView,
  createPayoffView,
  identityAt,
  writeBridgeReadout,
} from "../shared/domain/lambda-tau.js";

export function mountWidget(el, spec = {}) {
  return createWidget(el, spec, {
    name: "lambda-tau",
    frame: "v2",
    className: "prx-kbridge",
    css: BRIDGE_CSS,
    keys: bridgeKeys(),
    build(ctx) {
      const controls = createAxisControls(ctx, { concise: true });
      ctx.primaryControl(controls.lambda.input);

      const payoffSlot = ctx.h("div");
      const payoffIdentity = ctx.h("p", { class: "kb-note", "data-prx-readout": "payoff-identity" });
      ctx.stage.append(payoffSlot, payoffIdentity);

      const dataBox = ctx.dataBox("Data, pair outcomes and six-site check");
      const methodBox = ctx.methodBox("Method and conversion identity");

      const outcomesSlot = ctx.h("div");
      const summarySlot = ctx.h("div");
      dataBox.body.append(outcomesSlot, summarySlot);

      const converterSlot = ctx.h("div");
      const noteSlot = ctx.h("div");
      methodBox.body.append(converterSlot, noteSlot, createEndpointNote(ctx));

      const payoff = createPayoffView(ctx, payoffSlot, { compact: true, outcomesSlot, noteSlot });
      const summary = createIdentityView(ctx, summarySlot);
      const converter = createConverterView(ctx, converterSlot, { includeReadoutShareHook: true });

      ctx.caption.replaceChildren("Six fictional sites: ", captionNode(ctx, "teaching-posterior"), ".");

      return {
        render(state, info) {
          if (info?.reason === "disclosure") return;
          ctx.root.setAttribute("aria-busy", "true");
          try {
            const model = identityAt(state);
            controls.render(model);
            payoff.render(model);
            const { lambda, tau } = model.parameters;
            payoffIdentity.replaceChildren("At λ = ", ctx.num(lambda, formatSetting(lambda)), " and τ = ", ctx.num(tau, formatSetting(tau)),
              ", the expected cost of each action equals τ − (", ctx.num(1, "1"), " − τ) × its expected KRW payoff.");
            summary.render(model);
            converter.render(model);
            writeBridgeReadout(ctx, model, { blocks: true });
          } finally {
            ctx.root.removeAttribute("aria-busy");
          }
        },
      };
    },
  });
}
