// R47 was frozen before this adapter. Exercise the production source-sort
// helpers; inverse positions and mover grouping are display infrastructure.
import { blockOrder, keyOrder, readKrwModel } from '../../js/shared/krw-model.js';

export default {
  group: 'oracle-v3p5-source-sorts',
  // Orders/counts are exact; supplied metadata is copied without arithmetic.
  default: { abs: 0, rel: 0 },
  functions: ['scoreOrder'],
  run(args) {
    if (args.fn !== 'caseKrwSourceSort') throw new Error(`Unknown R47 composition ${args.fn}`);
    if (!['mean', 'estimate', 'krw'].includes(args.sort) || !Number.isInteger(args.index) || args.index < 0 || args.index > 100) {
      throw new Error('Invalid R47 source-sort input');
    }
    const model = readKrwModel(args.criterion), grade = model.grid.grade[args.index];
    // blockOrder itself calls this same production keyOrder. Also exercise
    // its direct exported entry point, without implementing a replacement.
    if (new Set(keyOrder(model, args.sort)).size !== model.n) throw new Error('Production keyOrder did not return a permutation');
    const selectedRows = blockOrder(model, grade, args.sort), baselineRows = blockOrder(model, grade, 'mean');
    const selectedPosition = new Array(model.n), baselinePosition = new Array(model.n);
    selectedRows.forEach((unit, position) => { selectedPosition[unit] = position; });
    baselineRows.forEach((unit, position) => { baselinePosition[unit] = position; });
    const displacement = selectedPosition.map((position, unit) => position - baselinePosition[unit]);
    const movedCount = displacement.filter(delta => delta !== 0).length, maxAbsShift = Math.max(...displacement.map(Math.abs));
    // Preserve selected-row order of EVERY equal absolute maximum, either
    // sign. The first entry is the source's first strict-maximum mover.
    const mostMoved = maxAbsShift === 0 ? [] : selectedRows.filter(unit => Math.abs(displacement[unit]) === maxAbsShift);
    const mostMovedDetails = mostMoved.map(i => ({ i, id: model.ids[i], estimate: model.estimate[i], se: model.se[i], mean: model.mean[i] }));
    return { selectedRows, baselineRows, selectedPosition, baselinePosition, displacement, movedCount, maxAbsShift, mostMoved, mostMovedDetails };
  },
};
