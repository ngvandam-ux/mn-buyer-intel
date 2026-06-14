/**
 * Purchasing category taxonomy.
 *
 * Each category carries keyword aliases used to (a) auto-tag opportunities during
 * ingestion and (b) match seller capabilities against opportunity text. Keep keywords
 * lowercase; matching normalizes both sides.
 *
 * This is a seed taxonomy covering the common public-sector spend areas the user named
 * (telecom, fleet, training, safety, software, facilities) plus the obvious neighbors.
 * It is data, not code — extend freely.
 */

export interface CategoryDef {
  key: string;
  label: string;
  keywords: string[];
}

export const CATEGORY_TAXONOMY: CategoryDef[] = [
  {
    key: 'telecom',
    label: 'Telecommunications & Networking',
    keywords: [
      'telecom',
      'telecommunication',
      'fiber',
      'fibre',
      'broadband',
      'voip',
      'voice over ip',
      'network',
      'networking',
      'wireless',
      'cellular',
      'lte',
      '5g',
      'cabling',
      'structured cabling',
      'data circuit',
      'wan',
      'lan',
      'internet service',
    ],
  },
  {
    key: 'fleet',
    label: 'Fleet & Vehicles',
    keywords: [
      'fleet',
      'vehicle',
      'vehicles',
      'truck',
      'trucks',
      'automobile',
      'squad car',
      'patrol vehicle',
      'bus',
      'buses',
      'snowplow',
      'plow',
      'heavy equipment',
      'tires',
      'fuel',
      'ev charging',
      'electric vehicle',
    ],
  },
  {
    key: 'training',
    label: 'Training & Professional Development',
    keywords: [
      'training',
      'professional development',
      'instruction',
      'curriculum',
      'certification program',
      'workforce development',
      'e-learning',
      'elearning',
      'course',
      'workshop',
      'seminar',
    ],
  },
  {
    key: 'safety',
    label: 'Public Safety & Emergency',
    keywords: [
      'safety',
      'public safety',
      'emergency',
      'first responder',
      'fire',
      'ems',
      'ambulance',
      'body camera',
      'body-worn camera',
      'ballistic',
      'protective equipment',
      'ppe',
      'turnout gear',
      'radio',
      'dispatch',
      '911',
      'records management system',
      'rms',
    ],
  },
  {
    key: 'software',
    label: 'Software & SaaS',
    keywords: [
      'software',
      'saas',
      'application',
      'platform',
      'license',
      'licensing',
      'erp',
      'crm',
      'system implementation',
      'cloud',
      'subscription',
      'enterprise software',
      'data management',
      'analytics platform',
    ],
  },
  {
    key: 'it_hardware',
    label: 'IT Hardware & Infrastructure',
    keywords: [
      'computer',
      'computers',
      'laptop',
      'laptops',
      'desktop',
      'server',
      'servers',
      'storage',
      'data center',
      'workstation',
      'monitor',
      'printer',
      'hardware',
      'peripheral',
    ],
  },
  {
    key: 'cybersecurity',
    label: 'Cybersecurity',
    keywords: [
      'cybersecurity',
      'cyber security',
      'information security',
      'infosec',
      'endpoint protection',
      'firewall',
      'penetration test',
      'siem',
      'identity management',
      'zero trust',
      'security operations',
    ],
  },
  {
    key: 'facilities',
    label: 'Facilities & Maintenance',
    keywords: [
      'facility',
      'facilities',
      'maintenance',
      'hvac',
      'plumbing',
      'electrical',
      'roofing',
      'janitorial',
      'custodial',
      'grounds',
      'building automation',
      'elevator',
      'flooring',
      'painting',
    ],
  },
  {
    key: 'construction',
    label: 'Construction & Public Works',
    keywords: [
      'construction',
      'public works',
      'road',
      'highway',
      'bridge',
      'paving',
      'asphalt',
      'concrete',
      'grading',
      'utility construction',
      'water main',
      'sewer',
      'stormwater',
      'site work',
      'demolition',
      'general contractor',
    ],
  },
  {
    key: 'professional_services',
    label: 'Professional & Consulting Services',
    keywords: [
      'consulting',
      'consultant',
      'professional services',
      'advisory',
      'engineering services',
      'architectural',
      'legal services',
      'accounting',
      'audit',
      'staffing',
      'project management',
    ],
  },
  {
    key: 'medical',
    label: 'Medical & Health',
    keywords: [
      'medical',
      'health',
      'healthcare',
      'clinical',
      'pharmaceutical',
      'laboratory',
      'lab supplies',
      'behavioral health',
      'nursing',
      'dental',
      'medical equipment',
    ],
  },
  {
    key: 'office_supplies',
    label: 'Office Supplies & Furniture',
    keywords: [
      'office supplies',
      'furniture',
      'furnishings',
      'desks',
      'chairs',
      'workstations',
      'paper',
      'toner',
      'stationery',
    ],
  },
  {
    key: 'janitorial_supplies',
    label: 'Janitorial & Sanitation Supplies',
    keywords: [
      'janitorial supplies',
      'cleaning supplies',
      'sanitation',
      'disinfectant',
      'paper products',
      'trash',
      'waste',
      'recycling',
    ],
  },
  {
    key: 'food_services',
    label: 'Food & Nutrition Services',
    keywords: [
      'food service',
      'food services',
      'nutrition',
      'cafeteria',
      'catering',
      'school meals',
      'commodity foods',
      'concession',
    ],
  },
  {
    key: 'utilities_energy',
    label: 'Utilities & Energy',
    keywords: [
      'utility',
      'utilities',
      'energy',
      'electricity',
      'natural gas',
      'solar',
      'renewable',
      'power',
      'street lighting',
      'energy efficiency',
    ],
  },
  {
    key: 'transportation_transit',
    label: 'Transportation & Transit',
    keywords: [
      'transit',
      'transportation',
      'paratransit',
      'transit service',
      'rail',
      'light rail',
      'signal',
      'traffic',
      'its',
      'intelligent transportation',
    ],
  },
  {
    key: 'environmental',
    label: 'Environmental Services',
    keywords: [
      'environmental',
      'remediation',
      'hazardous',
      'water treatment',
      'wastewater',
      'air quality',
      'wetland',
      'conservation',
      'erosion control',
    ],
  },
  {
    key: 'security_services',
    label: 'Security Services & Systems',
    keywords: [
      'security guard',
      'security services',
      'access control',
      'surveillance',
      'video surveillance',
      'cctv',
      'alarm',
      'physical security',
    ],
  },
];

export const CATEGORY_KEYS = CATEGORY_TAXONOMY.map((c) => c.key);

const CATEGORY_BY_KEY = new Map(CATEGORY_TAXONOMY.map((c) => [c.key, c]));

export function getCategory(key: string): CategoryDef | undefined {
  return CATEGORY_BY_KEY.get(key);
}

export function categoryLabel(key: string): string {
  return CATEGORY_BY_KEY.get(key)?.label ?? key;
}

/**
 * Detect which categories a piece of text belongs to, by keyword hit. Returns category
 * keys ordered by number of distinct keyword matches (strongest first). Used to auto-tag
 * opportunities during ingestion and to match seller categories.
 *
 * Imported lazily inside the function to avoid a load-order cycle with `text.ts`.
 */
export function detectCategories(text: string | null | undefined): string[] {
  if (!text) return [];
  // local import to keep this module dependency-light at the top level
  const hits: Array<{ key: string; n: number }> = [];
  for (const cat of CATEGORY_TAXONOMY) {
    const matched = phraseHitsCount(text, cat.keywords);
    if (matched > 0) hits.push({ key: cat.key, n: matched });
  }
  return hits.sort((a, b) => b.n - a.n).map((h) => h.key);
}

// Minimal inline phrase matcher (kept here to avoid an import cycle). Mirrors text.ts
// semantics: single-word needle → whole-token match; multi-word needle → substring.
function phraseHitsCount(haystack: string, needles: string[]): number {
  const normHay = haystack
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normHay) return 0;
  const tokens = new Set(normHay.split(' '));
  let n = 0;
  for (const raw of needles) {
    const needle = raw
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!needle) continue;
    if (needle.includes(' ')) {
      if (normHay.includes(needle)) n += 1;
    } else if (tokens.has(needle)) {
      n += 1;
    }
  }
  return n;
}
