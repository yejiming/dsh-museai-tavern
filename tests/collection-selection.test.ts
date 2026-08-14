import { describe, expect, it } from 'vitest';
import { filterExistingValues, filterItemsById, filterSelectedItems } from '../src/client/utils/collectionSelection';

describe('集合选择过滤', () => {
  it('按当前选择顺序保留可用值以及重复选择', () => {
    expect(filterExistingValues(
      ['reference-b', 'missing', 'reference-b', 'reference-a'],
      ['reference-a', 'reference-b'],
    )).toEqual(['reference-b', 'reference-b', 'reference-a']);
  });

  it('按源对象顺序筛选 id，并忽略缺失或重复 id', () => {
    const items = [
      { id: 'card-a', name: '角色甲' },
      { id: 'card-b', name: '角色乙' },
      { id: 'card-c', name: '角色丙' },
    ];

    expect(filterItemsById(items, ['card-c', 'missing', 'card-a', 'card-a']))
      .toEqual([items[0], items[2]]);
  });

  it('在一次遍历中组合 id 选择和业务条件', () => {
    const versions = [
      { id: 'v1', suggestion: '保留', timestamp: 1 },
      { id: 'v2', suggestion: '', timestamp: 2 },
      { id: 'v3', suggestion: '未选择', timestamp: 3 },
    ];

    expect(filterSelectedItems(
      versions,
      ['v2', 'missing', 'v1', 'v1'],
      (version) => Boolean(version.suggestion.trim()),
    )).toEqual([versions[0]]);
  });
});
