/**
 * Fetch additional images for a Wikipedia article from the Wikimedia API.
 */

export interface WikiImage {
  title: string;
  url: string;
  width: number;
  height: number;
  descriptionUrl?: string;
}

export async function fetchArticleImages(
  pageid: number,
  language: string = "nl",
  limit: number = 6
): Promise<WikiImage[]> {
  const apiBase =
    language === "nl"
      ? "https://nl.wikipedia.org/w/api.php"
      : "https://en.wikipedia.org/w/api.php";

  // Step 1: Get all images used on the page
  const params = new URLSearchParams({
    action: "query",
    pageids: String(pageid),
    prop: "images",
    imlimit: "20",
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${apiBase}?${params}`);
  const data = await res.json();
  const page = data.query?.pages?.[String(pageid)];
  if (!page?.images) return [];

  // Filter out icons, logos, and SVGs
  const imageFiles: string[] = page.images
    .map((img: { title: string }) => img.title)
    .filter(
      (title: string) =>
        /\.(jpe?g|png|webp)$/i.test(title) &&
        !/Commons-logo|Wiki.*logo|Flag_of|Icon|Symbol|Pictogram/i.test(title)
    )
    .slice(0, limit);

  if (imageFiles.length === 0) return [];

  // Step 2: Get image info (URLs) for these files
  const infoParams = new URLSearchParams({
    action: "query",
    titles: imageFiles.join("|"),
    prop: "imageinfo",
    iiprop: "url|size",
    iiurlwidth: "800",
    format: "json",
    origin: "*",
  });

  const infoRes = await fetch(`${apiBase}?${infoParams}`);
  const infoData = await infoRes.json();
  const pages = infoData.query?.pages || {};

  const images: WikiImage[] = [];
  for (const p of Object.values(pages) as Array<{
    title: string;
    imageinfo?: Array<{
      thumburl?: string;
      url: string;
      width: number;
      height: number;
      descriptionurl?: string;
    }>;
  }>) {
    if (p.imageinfo?.[0]) {
      const info = p.imageinfo[0];
      images.push({
        title: p.title.replace(/^File:|^Bestand:/, ""),
        url: info.thumburl || info.url,
        width: info.width,
        height: info.height,
        descriptionUrl: info.descriptionurl,
      });
    }
  }

  return images;
}
