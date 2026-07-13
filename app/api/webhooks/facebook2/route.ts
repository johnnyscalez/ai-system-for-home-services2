// Alias of /api/webhooks/facebook under a fresh path.
//
// Why this exists: Meta's webhook dispatcher wedged itself for our app —
// leadgen events sat in "Pending — lead publish in progress" forever while
// the same events delivered instantly to other subscribed apps
// (LeadConnector) on the same page. Subscription teardown/rebuild fixed
// messaging but not the leadgen queue. Pointing the app subscription at a
// brand-new callback URL forces Meta to construct a completely fresh
// delivery route, abandoning the stuck one.
//
// Same secret, same verify token, same processing — literally the same
// handlers re-exported.
export { GET, POST } from "../facebook/route"
