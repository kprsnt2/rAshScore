/**
 * rAsh Score — Brand Logos Helper
 */

/**
 * Returns a fallback URL or an external logo service URL (like logo.dev or clearbit)
 * for a given brand name.
 */
export function getBrandLogoUrl(brand: string, size: number = 128): string {
  // Using Clearbit Logo API as a simple fallback
  // In production, you might want to map brands to their actual domains
  // or use a paid service like logo.dev
  
  // Create a pseudo-domain based on the brand name
  const safeName = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
  const domain = `${safeName}.com`;
  
  return `https://logo.clearbit.com/${domain}?size=${size}`;
}
