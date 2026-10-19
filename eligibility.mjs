export const SPACE = Object.freeze({ width: 60, depth: 45, height: 45 });

export const CRITERIA = [
  { key: 'independentUnlocks', label: '鑰匙・密碼・指紋各自獨立開門' },
  { key: 'programmablePin', label: '可自行設定密碼' },
  { key: 'twoLevels', label: '至少一片層板、兩層收納' },
  { key: 'steelBolts', label: '全鋼實心鎖栓' },
  { key: 'wifiAbsent', label: '型號本身沒有 Wi-Fi' },
  { key: 'taiwanWarranty', label: '台灣通路與台灣保固' },
];

export function assess(product) {
  const sourceIds = new Set((product.sources ?? []).map(source => source.id));
  const checks = CRITERIA.map(criterion => {
    const proof = product.requirements?.[criterion.key];
    const evidenced = proof?.sources?.length > 0 && proof.sources.every(id => sourceIds.has(id));
    return { ...criterion, value: proof?.value === false ? false : proof?.value === true && evidenced ? true : null };
  });
  const dimensions = product.dimensions ?? {};
  const validSize = size => Object.keys(SPACE).every(axis => Number.isFinite(size?.[axis]) && size[axis] > 0);
  const exceeds = size => Object.keys(SPACE).some(axis => size[axis] > SPACE[axis]);
  const oversized = (validSize(dimensions) && exceeds(dimensions)) || (validSize(product.requiredSpace) && exceeds(product.requiredSpace));
  const spaceConsistent = validSize(product.requiredSpace) && sourceIds.has(product.requiredSpace.source) && Object.keys(SPACE).every(axis => product.requiredSpace[axis] >= dimensions[axis]);
  const fitVerified = validSize(dimensions) && dimensions.totalVerified === true && sourceIds.has(dimensions.source) && spaceConsistent;
  checks.unshift({ key: 'fit', label: '含突出物與必要餘量，能放入櫃內', value: oversized ? false : fitVerified ? true : null });
  checks.push({ key: 'reviews', label: '完成同型號負評查核', value: product.review?.status === 'negative' ? false : ['limited', 'reviewed'].includes(product.review?.status) ? true : null });
  const status = checks.some(check => check.value === false) ? 'excluded' : checks.every(check => check.value === true) ? 'recommended' : 'pending';
  return { status, checks };
}
