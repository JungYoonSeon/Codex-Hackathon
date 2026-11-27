/** Bridge retailer-data's additive contract into the evaluation contract. No retailer fetches. */
export function normalizeRetailerEvidence(raw: any): any {
  if (!Array.isArray(raw.evidence)) return raw;
  const path = (field: string) => field.replace(/\[(\d+)\]/g, '.$1');
  const entries = raw.evidence;
  const conflicts = (raw.conflicts ?? []).map((c: any) => path(c.field));
  const evidence: Record<string, any> = {};
  for (const entry of entries) {
    if (typeof entry.field !== 'string') continue;
    const field = path(entry.field);
    const conflict = conflicts.some((c: string) => field === c || field.startsWith(`${c}.`) || c.startsWith(`${field}.`));
    evidence[field] = {
      source: conflict ? 'estimated' : ['retailer_reported', 'independently_checked'].includes(entry.status) ? 'supplier' : entry.status === 'derived' ? 'estimated' : 'user-reported',
      sourceUrl: entry.sourceUrl, checkedAt: entry.retrievedAt,
      note: conflict ? '판매처 정보가 서로 달라 확인이 필요합니다.' : entry.note ?? entry.sourceLabel,
    };
  }
  const originalEvidence = { ...evidence };
  const packages: any[] = [];
  let quantitiesKnown = true;
  for (const [index, box] of (raw.packages ?? []).entries()) {
    const quantity = Number.isInteger(box.quantity) && box.quantity > 0 ? box.quantity : 1;
    if (!Number.isInteger(box.quantity) || box.quantity < 1) quantitiesKnown = false;
    for (let unit = 0; unit < quantity && packages.length < 50; unit++) {
      const next = packages.length;
      packages.push({id:`package-${index}-${unit}`,name:box.description, widthCm:box.widthCm,depthCm:box.lengthCm,heightCm:box.heightCm});
      for (const [target, source] of [['widthCm','widthCm'],['depthCm','lengthCm'],['heightCm','heightCm']]) {
        evidence[`packages.${next}.${target}`] = originalEvidence[`packages.${index}.${source}`] ?? originalEvidence[`packages.${index}`] ?? originalEvidence.packages;
      }
    }
  }
  const count = (raw.packages ?? []).reduce((sum: number, p: any) => sum + (p.quantity ?? 0), 0);
  const complete = quantitiesKnown && count > 0 && count <= 50 && raw.packageCount === count;
  evidence.packagesComplete = evidence.packageCount;
  const materials = Array.isArray(raw.materials) ? raw.materials.map((m: any) => typeof m === 'string' ? m : [m.part,m.material].filter(Boolean).join(': ')) : undefined;
  const careInstructions = Array.isArray(raw.care) ? raw.care.map((c: any) => [c.part,...(c.instructions ?? [])].filter(Boolean).join(': ')).join('\n') : raw.careInstructions;
  evidence.careInstructions = evidence.care;
  // Destination-dependent delivery quotes are not a generic shipping promise or zero fee.
  return {...raw,evidence,packages,packagesComplete:complete?true:undefined,materials,careInstructions};
}
