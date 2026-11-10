import type { AreaCondition, AreaType, Language, PropertyType } from '@app/shared';

/** The WhatsApp message a guest sends to the admin, in the guest's language. */

const L = {
  en: {
    intro: "Hi! I'd like a painting quote.",
    name: 'Name',
    phone: 'Phone',
    property: 'Property',
    address: 'Address',
    dates: 'Preferred site-visit dates',
    areas: 'Areas to paint',
    color: 'Color',
    noColor: 'no color chosen yet',
    notes: 'Notes',
    link: 'Photos and color previews',
    exterior: 'exterior',
    interior: 'interior',
    furnished: 'furnished',
    sqft: 'sqft',
    property_: {
      house: 'House',
      apartment: 'Apartment / Condo',
      office: 'Office',
      shop: 'Shop',
      industrial: 'Factory / Warehouse',
      other: 'Other',
    },
    area_: {
      living_room: 'Living room / main area',
      bedroom: 'Bedroom',
      kitchen: 'Kitchen',
      bathroom: 'Bathroom',
      hallway: 'Hallway / staircase',
      ceiling: 'Ceiling',
      exterior_wall: 'Exterior walls',
      fence: 'Fence / gate',
      doors_trim: 'Doors and trim',
      other: 'Other area',
    },
    condition_: { good: 'good condition', patching: 'needs patching', peeling: 'peeling or damp' },
  },
  ms: {
    intro: 'Hai! Saya ingin meminta sebut harga mengecat.',
    name: 'Nama',
    phone: 'Telefon',
    property: 'Jenis hartanah',
    address: 'Alamat',
    dates: 'Tarikh lawatan tapak yang dipilih',
    areas: 'Kawasan untuk dicat',
    color: 'Warna',
    noColor: 'belum pilih warna',
    notes: 'Catatan',
    link: 'Gambar dan pratonton warna',
    exterior: 'luar',
    interior: 'dalam',
    furnished: 'berperabot',
    sqft: 'kps',
    property_: {
      house: 'Rumah',
      apartment: 'Apartment / Kondominium',
      office: 'Pejabat',
      shop: 'Kedai',
      industrial: 'Kilang / Gudang',
      other: 'Lain-lain',
    },
    area_: {
      living_room: 'Ruang tamu / ruang utama',
      bedroom: 'Bilik tidur',
      kitchen: 'Dapur',
      bathroom: 'Bilik air',
      hallway: 'Lorong / tangga',
      ceiling: 'Siling',
      exterior_wall: 'Dinding luar',
      fence: 'Pagar / pintu pagar',
      doors_trim: 'Pintu dan bingkai',
      other: 'Kawasan lain',
    },
    condition_: {
      good: 'keadaan baik',
      patching: 'perlu tampalan',
      peeling: 'mengelupas atau lembap',
    },
  },
} as const satisfies Record<Language, unknown>;

export interface MessageArea {
  areaType: AreaType;
  label: string | null;
  exterior: boolean;
  sizeSqft: number | null;
  condition: AreaCondition;
  furnished: boolean;
  colorName: string | null;
  colorCode: string | null;
  colorHex: string | null;
}

export interface MessageInput {
  lang: Language;
  name: string;
  phone: string;
  propertyType: PropertyType;
  address: string;
  town: string;
  preferredDates: string;
  notes: string;
  areas: MessageArea[];
  /** Admin-only page with the photos and previews. */
  detailUrl: string;
}

export function buildWhatsappMessage(m: MessageInput): string {
  const t = L[m.lang];
  const lines: string[] = [t.intro, ''];
  lines.push(`${t.name}: ${m.name}`);
  lines.push(`${t.phone}: ${m.phone}`);
  lines.push(`${t.property}: ${t.property_[m.propertyType]}`);
  const where = [m.address, m.town].filter(Boolean).join(', ');
  if (where) lines.push(`${t.address}: ${where}`);
  if (m.preferredDates) lines.push(`${t.dates}: ${m.preferredDates}`);

  lines.push('', `${t.areas}:`);
  m.areas.forEach((a, i) => {
    const parts = [
      a.label || t.area_[a.areaType],
      a.sizeSqft ? `${a.sizeSqft} ${t.sqft}` : null,
      a.exterior ? t.exterior : t.interior,
      t.condition_[a.condition],
      a.furnished ? t.furnished : null,
    ].filter(Boolean);
    lines.push(`${i + 1}. ${parts.join(' · ')}`);
    const color = a.colorName
      ? [a.colorName, a.colorCode ? `(${a.colorCode})` : '', a.colorHex ?? '']
          .filter(Boolean)
          .join(' ')
      : t.noColor;
    lines.push(`   ${t.color}: ${color}`);
  });

  if (m.notes) lines.push('', `${t.notes}: ${m.notes}`);
  lines.push('', `${t.link}: ${m.detailUrl}`);
  return lines.join('\n');
}

/** Click-to-chat link with a prefilled message. */
export function whatsappUrl(phoneE164: string, text: string) {
  return `https://wa.me/${phoneE164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}
