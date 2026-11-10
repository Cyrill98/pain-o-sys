/** Click-to-chat link with a prefilled message: opens WhatsApp on the admin's phone. */
export function whatsappLink(phoneE164: string, text: string) {
  const digits = phoneE164.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
