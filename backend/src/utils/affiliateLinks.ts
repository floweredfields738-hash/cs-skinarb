// Affiliate link configuration
// Add your referral codes here to earn commission from marketplace referrals

const AFFILIATE_CODES: Record<string, string> = {
  skinport: process.env.SKINPORT_AFFILIATE || '',     // Skinport referral code
  csfloat: process.env.CSFLOAT_AFFILIATE || '',       // CSFloat referral code
  dmarket: process.env.DMARKET_AFFILIATE || '',       // DMarket referral code
  bitskins: process.env.BITSKINS_AFFILIATE || '',     // BitSkins referral code
};

// Append affiliate parameter to marketplace URLs
export function addAffiliate(url: string): string {
  if (!url) return url;

  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    if (host.includes('skinport') && AFFILIATE_CODES.skinport) {
      u.searchParams.set('r', AFFILIATE_CODES.skinport);
    } else if (host.includes('csfloat') && AFFILIATE_CODES.csfloat) {
      u.searchParams.set('ref', AFFILIATE_CODES.csfloat);
    } else if (host.includes('dmarket') && AFFILIATE_CODES.dmarket) {
      u.searchParams.set('ref', AFFILIATE_CODES.dmarket);
    } else if (host.includes('bitskins') && AFFILIATE_CODES.bitskins) {
      u.searchParams.set('ref', AFFILIATE_CODES.bitskins);
    }

    return u.toString();
  } catch {
    return url;
  }
}

export function hasAffiliates(): boolean {
  return Object.values(AFFILIATE_CODES).some(v => v.length > 0);
}
