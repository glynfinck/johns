// `server-only` refuses to load outside Next's server build. The db project
// calls route handlers and the engine directly, under Node, where there is no
// client bundle to protect, so it stands in for it with nothing.
export {};
