/**
 * Capability detection — turn free-text (budget narratives, opportunity scope, strategic
 * plans) into the specific products/capabilities a buyer is looking for, each tagged to a
 * purchasing category. This is what lets the app say "MNIT wants cloud migration, IAM,
 * Microsoft/AI, cybersecurity" rather than just "IT".
 */

export interface CapabilityDef {
  key: string;
  label: string;
  category: string;
  pattern: RegExp;
}

// Order matters only for readability; matching scans all. Patterns are case-insensitive.
export const CAPABILITY_SIGNALS: CapabilityDef[] = [
  { key: 'cloud', label: 'Cloud / Azure migration', category: 'software', pattern: /cloudramp|\bazure\b|cloud migration|public cloud|cloud infrastructure|intentional cloud/i },
  { key: 'iam', label: 'Identity & access management', category: 'cybersecurity', pattern: /identity and access|access management|\biam\b|mneiam|single sign|multi-?factor/i },
  { key: 'ms_license', label: 'Microsoft Enterprise Agreement / licensing', category: 'software', pattern: /microsoft enterprise agreement|\bg5\b|microsoft software|microsoft licens|office 365|\bm365\b/i },
  { key: 'ai', label: 'AI / automation', category: 'software', pattern: /artificial intelligence|\bai\b|chatbot|machine learning|robotic process|\bautomation\b/i },
  { key: 'cyber', label: 'Cybersecurity / endpoint', category: 'cybersecurity', pattern: /cyber ?security|endpoint|zero trust|security operations|threat detection|\bsoc\b/i },
  { key: 'modernization', label: 'Application / legacy modernization', category: 'software', pattern: /application modernization|legacy system|modernization fund|technology modernization|re-?platform/i },
  { key: 'network', label: 'Network / telecom services', category: 'telecom', pattern: /\bwan\b|\blan\b|\bsan\b|network services|telecommunication|broadband|connectivity/i },
  { key: 'collab', label: 'Collaboration / productivity tools', category: 'software', pattern: /microsoft teams|power platform|collaboration tool|video conferenc|unified communication/i },
  { key: 'web', label: 'Web platform / content management', category: 'software', pattern: /web content management|web platform|content management system|digital services/i },
  { key: 'pmo', label: 'IT project / PMO services', category: 'professional_services', pattern: /project management office|\bpmo\b|etdpmo|project portfolio|system integrat/i },
  { key: 'datacenter', label: 'Data center / infrastructure', category: 'it_hardware', pattern: /data center|\bserver\b|\bstorage\b|hosting infrastructure/i },
  { key: 'analytics', label: 'Data & analytics', category: 'software', pattern: /data analytics|business intelligence|data management|geospatial|\bmngeo\b/i },
  { key: 'erp', label: 'ERP / enterprise systems', category: 'software', pattern: /\berp\b|enterprise resource planning|financial system|\bworkday\b|peoplesoft|\bsap\b/i },
  // cross-domain (non-IT agencies)
  { key: 'public_safety_tech', label: 'Public safety technology', category: 'safety', pattern: /body.?worn camera|body camera|records management system|computer-?aided dispatch|\bcad system|license plate reader|less.?lethal/i },
  { key: 'fleet', label: 'Fleet / vehicles', category: 'fleet', pattern: /fleet|vehicle replacement|squad car|snow ?plow|heavy equipment/i },
  { key: 'medical', label: 'Medical / clinical', category: 'medical', pattern: /medical equipment|clinical|pharmaceutical|laboratory|\bppe\b/i },
];

export interface DetectedCapability {
  key: string;
  label: string;
  category: string;
  snippet: string;
}

/** Detect the capabilities a buyer is signaling demand for, with an evidence snippet. */
export function detectCapabilities(text: string | null | undefined): DetectedCapability[] {
  if (!text) return [];
  const out: DetectedCapability[] = [];
  for (const c of CAPABILITY_SIGNALS) {
    const m = c.pattern.exec(text);
    if (!m) continue;
    const i = m.index;
    out.push({
      key: c.key,
      label: c.label,
      category: c.category,
      snippet: text.slice(Math.max(0, i - 40), i + 140).replace(/\s+/g, ' ').trim(),
    });
  }
  return out;
}
