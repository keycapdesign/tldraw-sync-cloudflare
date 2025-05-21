import { TLAssetStore, uniqueId } from "tldraw";

const WORKER_URL = import.meta.env.VITE_TLDRAW_WORKER_URL;

// How does our server handle assets like images and videos?
export const multiplayerAssetStore: TLAssetStore = {
  // to upload an asset, we...
  async upload(_asset, file, _abortSignal) {
    // ...create a unique name & URL...
    const id = uniqueId();
    const objectName = `${id}-${file.name}`.replace(/[^a-zA-Z0-9.]/g, "-");
    const url = `${WORKER_URL}/uploads/${objectName}`;

    // ...POST it to our worker to upload it...
    const response = await fetch(url, {
      method: "POST",
      body: file,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload asset: ${response.statusText}`);
    }

    // ...and return an object with the src URL to be stored with the asset record.
    return {
      src: url,
      // You can include additional metadata if needed
      // meta: { ... }
    };
  },

  // to retrieve an asset, we can just use the same URL. you could customize this to add extra
  // auth, or to serve optimized versions / sizes of the asset.
  resolve(asset) {
    return asset.props.src;
  },
};
