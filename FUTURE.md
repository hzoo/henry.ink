# Future

Are.na URL discovery currently uses anonymous v2 general search and public block
connections. Move to v3 when v2 is retired or when a single server-side Premium
credential is justified. V3 search requires Premium access; do not silently add
that requirement or fall back to the private GraphQL API. Keep URL-based saves
as the product; do not restore keyword matching or a local channel index.

Sources: [Are.na API documentation](https://www.are.na/developers/explore),
[v3 search](https://www.are.na/developers/explore/search/search).
