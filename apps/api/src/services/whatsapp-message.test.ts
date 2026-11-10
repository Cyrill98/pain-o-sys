import { describe, expect, it } from 'vitest';
import { buildWhatsappMessage, whatsappUrl, type MessageInput } from './whatsapp-message.js';

const base: MessageInput = {
  lang: 'en',
  name: 'Aina',
  phone: '+60123456780',
  propertyType: 'house',
  address: 'No 1 Jalan X',
  town: 'Shah Alam',
  preferredDates: 'Weekends',
  notes: 'Dog at home',
  detailUrl: 'https://paint.example/en/admin/requests/abc',
  areas: [
    {
      areaType: 'living_room',
      label: null,
      exterior: false,
      sizeSqft: 300,
      condition: 'good',
      furnished: true,
      colorName: 'Sea Salt',
      colorCode: 'SW 6204',
      colorHex: '#D4DCD4',
    },
    {
      areaType: 'fence',
      label: 'Front fence',
      exterior: true,
      sizeSqft: null,
      condition: 'peeling',
      furnished: false,
      colorName: null,
      colorCode: null,
      colorHex: null,
    },
  ],
};

describe('buildWhatsappMessage', () => {
  it('includes the client, areas, colors and the admin link (English)', () => {
    const m = buildWhatsappMessage(base);
    expect(m).toContain('Name: Aina');
    expect(m).toContain('Property: House');
    expect(m).toContain('Address: No 1 Jalan X, Shah Alam');
    expect(m).toContain(
      '1. Living room / main area · 300 sqft · interior · good condition · furnished',
    );
    expect(m).toContain('Color: Sea Salt (SW 6204) #D4DCD4');
    expect(m).toContain('2. Front fence · exterior · peeling or damp');
    expect(m).toContain('Color: no color chosen yet');
    expect(m).toContain('Notes: Dog at home');
    expect(m.trimEnd().endsWith(base.detailUrl)).toBe(true);
  });

  it('writes Malay when the guest used Malay', () => {
    const m = buildWhatsappMessage({ ...base, lang: 'ms' });
    expect(m).toContain('Nama: Aina');
    expect(m).toContain('Jenis hartanah: Rumah');
    expect(m).toContain('Warna: belum pilih warna');
  });

  it('leaves out empty optional fields', () => {
    const m = buildWhatsappMessage({
      ...base,
      address: '',
      town: '',
      preferredDates: '',
      notes: '',
    });
    expect(m).not.toContain('Address:');
    expect(m).not.toContain('Preferred');
    expect(m).not.toContain('Notes:');
  });
});

describe('whatsappUrl', () => {
  it('uses digits only and encodes the text', () => {
    const url = whatsappUrl('+60 12-345 6789', 'Hi & bye\nline 2');
    expect(url).toBe('https://wa.me/60123456789?text=Hi%20%26%20bye%0Aline%202');
  });
});
