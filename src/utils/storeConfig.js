export function getStoreConfig() {
  const whatsappNumber = String(process.env.STORE_WHATSAPP || '').replace(/\D/g, '');
  const validWhatsappNumber = /^[1-9]\d{7,14}$/.test(whatsappNumber) ? whatsappNumber : '';
  return { whatsappEnabled: Boolean(validWhatsappNumber), whatsappNumber: validWhatsappNumber || null };
}
