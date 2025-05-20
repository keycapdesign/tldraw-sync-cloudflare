import { AssetRecordType, TLAsset, TLBookmarkAsset, getHashForString } from 'tldraw'
import { useAuthToken } from './authUtils'

// Create a function that returns the bookmark preview handler with authentication
export function createBookmarkPreviewHandler() {
	// Get the auth token
	const { getAuthHeaders } = useAuthToken()

	// Return the handler function
	return async function getBookmarkPreview({ url }: { url: string }): Promise<TLAsset> {
		// we start with an empty asset record
		const asset: TLBookmarkAsset = {
			id: AssetRecordType.createId(getHashForString(url)),
			typeName: 'asset',
			type: 'bookmark',
			meta: {},
			props: {
				src: url,
				description: '',
				image: '',
				favicon: '',
				title: '',
			},
		}

		try {
			// Get authentication headers
			const authHeaders = await getAuthHeaders()

			// try to fetch the preview data from the server
			const response = await fetch(
				`${import.meta.env.VITE_TLDRAW_WORKER_URL}/unfurl?url=${encodeURIComponent(url)}`,
				{ headers: authHeaders }
			)
			const data = await response.json()

			// fill in our asset with whatever info we found
			asset.props.description = data?.description ?? ''
			asset.props.image = data?.image ?? ''
			asset.props.favicon = data?.favicon ?? ''
			asset.props.title = data?.title ?? ''
		} catch (e) {
			console.error(e)
		}

		return asset
	}
}

// For backward compatibility, export a default handler
export async function getBookmarkPreview({ url }: { url: string }): Promise<TLAsset> {
	// we start with an empty asset record
	const asset: TLBookmarkAsset = {
		id: AssetRecordType.createId(getHashForString(url)),
		typeName: 'asset',
		type: 'bookmark',
		meta: {},
		props: {
			src: url,
			description: '',
			image: '',
			favicon: '',
			title: '',
		},
	}

	try {
		// try to fetch the preview data from the server
		const response = await fetch(
			`${import.meta.env.VITE_TLDRAW_WORKER_URL}/unfurl?url=${encodeURIComponent(url)}`
		)
		const data = await response.json()

		// fill in our asset with whatever info we found
		asset.props.description = data?.description ?? ''
		asset.props.image = data?.image ?? ''
		asset.props.favicon = data?.favicon ?? ''
		asset.props.title = data?.title ?? ''
	} catch (e) {
		console.error(e)
	}

	return asset
}
