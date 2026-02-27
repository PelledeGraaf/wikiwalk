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

interface WikiGeoSearchResult {
  pageid: number;
  ns: number;
  title: string;
  lat: number;
  lon: number;
  dist: number;
  primary: string;
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

export async function fetchNearbyArticles(
  lat: number,
  lon: number,
  radius: number = 10000,
  limit: number = 50,
  language: string = "nl"
): Promise<WikiArticle[]> {
  const apiBase = language === "nl" ? WIKI_API : WIKI_EN_API;

  const params = new URLSearchParams({
    action: "query",
    list: "geosearch",
    gscoord: `${lat}|${lon}`,
    gsradius: String(Math.min(radius, 10000)),
    gslimit: String(Math.min(limit, 500)),
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${apiBase}?${params}`);
  const data = await res.json();

  if (!data.query?.geosearch) return [];

  const articles: WikiGeoSearchResult[] = data.query.geosearch;
  const pageIds = articles.map((a) => a.pageid).join("|");

  // Fetch additional details (extracts, thumbnails)
  const detailParams = new URLSearchParams({
    action: "query",
    pageids: pageIds,
    prop: "extracts|pageimages|description|info|coordinates",
    exintro: "true",
    explaintext: "true",
    exsentences: "3",
    piprop: "thumbnail",
    pithumbsize: "300",
    inprop: "url",
    format: "json",
    origin: "*",
  });

  const detailRes = await fetch(`${apiBase}?${detailParams}`);
  const detailData = await detailRes.json();

  const pages: Record<string, WikiPageInfo> = detailData.query?.pages || {};

  return articles.map((article) => {
    const page = pages[String(article.pageid)];
    return {
      pageid: article.pageid,
      title: article.title,
      lat: article.lat,
      lon: article.lon,
      dist: article.dist,
      description: page?.description,
      thumbnail: page?.thumbnail?.source,
      extract: page?.extract,
      url: page?.fullurl,
    };
  });
}

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
