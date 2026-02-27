export interface WikiArticle {
  pageid: number;
  title: string;
  lat: number;
  lon: number;
  dist?: number;
  description?: string;
  thumbnail?: string;
  extract?: string;
  url?: string;
}

interface WikiPageInfo {
  pageid: number;
  title: string;
  extract?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  description?: string;
  fullurl?: string;
  coordinates?: { lat: number; lon: number }[];
}

const WIKI_API = "https://nl.wikipedia.org/w/api.php";
const WIKI_EN_API = "https://en.wikipedia.org/w/api.php";

export async function fetchArticleDetail(
  pageid: number,
  language: string = "nl"
): Promise<WikiArticle | null> {
  const apiBase = language === "nl" ? WIKI_API : WIKI_EN_API;

  const params = new URLSearchParams({
    action: "query",
    pageids: String(pageid),
    prop: "extracts|pageimages|description|info|coordinates",
    exintro: "true",
    explaintext: "true",
    piprop: "thumbnail",
    pithumbsize: "600",
    inprop: "url",
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${apiBase}?${params}`);
  const data = await res.json();

  const page: WikiPageInfo | undefined =
    data.query?.pages?.[String(pageid)];
  if (!page) return null;

  const coords = page.coordinates?.[0];
  return {
    pageid: page.pageid,
    title: page.title,
    lat: coords?.lat || 0,
    lon: coords?.lon || 0,
    description: page.description,
    thumbnail: page.thumbnail?.source,
    extract: page.extract,
    url: page.fullurl,
  };
}

export async function searchArticles(
  query: string,
  language: string = "nl"
): Promise<WikiArticle[]> {
  const apiBase = language === "nl" ? WIKI_API : WIKI_EN_API;

  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "20",
    prop: "coordinates|extracts|pageimages|description|info",
    exintro: "true",
    explaintext: "true",
    exsentences: "2",
    piprop: "thumbnail",
    pithumbsize: "300",
    inprop: "url",
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${apiBase}?${params}`);
  const data = await res.json();

  const pages: Record<string, WikiPageInfo> = data.query?.pages || {};

  return Object.values(pages)
    .filter((page) => page.coordinates && page.coordinates.length > 0)
    .map((page) => ({
      pageid: page.pageid,
      title: page.title,
      lat: page.coordinates![0].lat,
      lon: page.coordinates![0].lon,
      description: page.description,
      thumbnail: page.thumbnail?.source,
      extract: page.extract,
      url: page.fullurl,
    }));
}
