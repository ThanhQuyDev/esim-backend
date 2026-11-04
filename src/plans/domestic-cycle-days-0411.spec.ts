import { cycleDaysFromCell } from './domestic-offer';

describe('Chu kỳ tính theo ngày (vande-0411 #045)', () => {
  it.each([
    [30, 30],
    [180, 180],
    [360, 360],
    [7, 7],
    [1, 30],
    [3, 90],
    [6, 180],
    [12, 360],
    [null, 30],
    ['', 30],
  ])('should read %s as %s days', (cell, days) => {
    expect(cycleDaysFromCell(cell)).toBe(days);
  });
});
