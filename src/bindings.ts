export type Bindings = {
  STORE_KV: KVNamespace;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
};

declare global {
  function getMiniflareBindings(): Bindings;
}
