/**
 * Utility functions for generating placeholder images as SVG data URIs
 * This avoids reliance on external placeholder services like via.placeholder.com
 */

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#14b8a6', // teal
];

/**
 * Generate a placeholder avatar SVG with initials
 * @param initials - The text to display (e.g., "JD" or "AU")
 * @param size - Size of the avatar in pixels (default: 100)
 * @returns Data URI string for the SVG
 */
export const generateAvatarPlaceholder = (initials: string = '?', size: number = 100): string => {
  const colors = COLORS;
  const colorIndex = initials.charCodeAt(0) % colors.length;
  const bgColor = colors[colorIndex];

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${bgColor}"/>
      <text x="50%" y="50%" font-size="${size * 0.4}" font-weight="bold" fill="white"
            text-anchor="middle" dy=".3em" font-family="system-ui, -apple-system, sans-serif">
        ${initials.substring(0, 2).toUpperCase()}
      </text>
    </svg>
  `.trim();

  const encoded = encodeURIComponent(svgContent);
  return `data:image/svg+xml,${encoded}`;
};

/**
 * Generate a generic placeholder image for devices or products
 * @param text - Text to display on the placeholder
 * @param width - Width of the image in pixels (default: 400)
 * @param height - Height of the image in pixels (default: 300)
 * @param bgColor - Background color (default: light gray)
 * @returns Data URI string for the SVG
 */
export const generateImagePlaceholder = (
  text: string = 'Image',
  width: number = 400,
  height: number = 300,
  bgColor: string = '#f3f4f6'
): string => {
  const textColor = '#9ca3af';
  const fontSize = Math.max(width, height) * 0.08;

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="${bgColor}"/>
      <text x="50%" y="50%" font-size="${fontSize}" fill="${textColor}"
            text-anchor="middle" dy=".3em" font-family="system-ui, -apple-system, sans-serif"
            font-weight="500">
        ${text}
      </text>
    </svg>
  `.trim();

  const encoded = encodeURIComponent(svgContent);
  return `data:image/svg+xml,${encoded}`;
};

/**
 * Get a placeholder image URL with fallback
 * If the primary URL is external and might fail, return SVG placeholder
 * @param url - The URL to check
 * @param fallbackText - Text to use if generating fallback placeholder
 * @param width - Width for fallback placeholder
 * @param height - Height for fallback placeholder
 * @returns The URL or generated placeholder
 */
export const getPlaceholderWithFallback = (
  url: string | null | undefined,
  fallbackText: string = 'Image',
  width: number = 400,
  height: number = 300
): string => {
  // If URL exists and is not a placeholder.com URL, return it
  if (url && !url.includes('placeholder.com') && !url.includes('via.placeholder')) {
    return url;
  }

  // Otherwise generate a fallback SVG
  return generateImagePlaceholder(fallbackText, width, height);
};

/**
 * Get an avatar placeholder
 * @param name - The user's name or initials
 * @param size - Size of the avatar
 * @returns Data URI string for the SVG avatar
 */
export const getAvatarFallback = (name: string = '?', size: number = 100): string => {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return generateAvatarPlaceholder(initials || '?', size);
};
