import { correctionPin } from "./postrank-v3p2-correction.mjs";
export default {group:"oracle-v3p2-correction",run:correctionPin,default:{abs:0,rel:0},
  tolerance:{beforeRisk:{abs:1e-12,rel:0},afterRisk:{abs:1e-12,rel:0}}};
