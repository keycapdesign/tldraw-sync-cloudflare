import {
  AssetRecordType,
  TLAsset,
  TLBookmarkAsset,
  getHashForString,
} from "tldraw";
// We will no longer use useAuthToken directly in createBookmarkPreviewHandler
// import { useAuthToken } from './authUtils'

// Modify createBookmarkPreviewHandler to accept a getToken function
export function createBookmarkPreviewHandler(
  getToken: () => Promise<string | null>,
) {
  // Return the actual handler function that tldraw will call
  return async function getBookmarkPreviewWithToken({
    url,
  }: {
    url: string;
  }): Promise<TLAsset> {
    const asset: TLBookmarkAsset = {
      id: AssetRecordType.createId(getHashForString(url)),
      typeName: "asset",
      type: "bookmark",
      meta: {},
      props: {
        src: url,
        description: "",
        image: "",
        favicon: "",
        title: "",
      },
    };

    try {
      const token = getToken ? await getToken() : null;
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Create the URL with the auth token as a query parameter
      const apiUrl = new URL(`${import.meta.env.VITE_TLDRAW_WORKER_URL}/unfurl`);
      apiUrl.searchParams.set('url', url);

      // Add auth token as a query parameter for WebSocket compatibility
      if (token) {
        apiUrl.searchParams.set('auth', token);
      }

      const response = await fetch(apiUrl.toString(), { headers });

      // It's good practice to check if the response was ok before trying to parse JSON
      if (!response.ok) {
        console.error(
          `Error fetching bookmark preview: ${response.status} ${response.statusText}`,
        );
        // You might want to return the asset with minimal info or throw an error
        // For now, just logging and continuing to parse (which might fail if no JSON body)
      }

      const data = await response.json();

      asset.props.description = data?.description ?? "";
      asset.props.image = data?.image ?? "";
      asset.props.favicon = data?.favicon ?? "";
      asset.props.title = data?.title ?? "";
    } catch (e) {
      console.error("Failed to get bookmark preview:", e);
      // Populate with fallback title on error
      asset.props.title = `Error fetching preview for ${url}`;
    }

    return asset;
  };
}

// The original getBookmarkPreview can remain as a fallback or for unauthenticated scenarios
// if you choose, but the createBookmarkPreviewHandler is what App.tsx should use
// when intending to use auth. For now, let's assume App.tsx will always provide getToken.
// If createBookmarkPreviewHandler is always used, this default export might become obsolete
// or could be a version that doesn't use auth.
export async function getBookmarkPreview({
  url,
}: {
  url: string;
}): Promise<TLAsset> {
  const asset: TLBookmarkAsset = {
    id: AssetRecordType.createId(getHashForString(url)),
    typeName: "asset",
    type: "bookmark",
    meta: {},
    props: {
      src: url,
      description: "",
      image: "",
      favicon: "",
      title: "",
    },
  };

  try {
    // Create the URL with the url as a query parameter
    const apiUrl = new URL(`${import.meta.env.VITE_TLDRAW_WORKER_URL}/unfurl`);
    apiUrl.searchParams.set('url', url);

    const response = await fetch(apiUrl.toString());
    if (!response.ok) {
      console.error(
        `Error fetching (default) bookmark preview: ${response.status} ${response.statusText}`,
      );
    }
    const data = await response.json();

    asset.props.description = data?.description ?? "";
    asset.props.image = data?.image ?? "";
    asset.props.favicon = data?.favicon ?? "";
    asset.props.title = data?.title ?? "";
  } catch (e) {
    console.error("Failed to get (default) bookmark preview:", e);
    asset.props.title = `Error fetching preview for ${url}`;
  }
  return asset;
}
