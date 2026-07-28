import { bucketStorage } from '../../server/storage'

export async function onRequestGet(context: any) {
  const { request, env, params } = context
  const key = params.route?.join('/')
  
  if (!key) {
    return new Response('Not Found', { status: 404 })
  }

  const bucket = env.BUCKET
  if (!bucket) {
    return new Response('Bucket not configured', { status: 500 })
  }

  const object = await bucket.get(key)
  if (object === null) {
    return new Response('Not Found', { status: 404 })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)

  return new Response(object.body, {
    headers,
  })
}
