import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// SvelteKit 3 refuses `svelte.config.js` (`config_file_unsupported`): its
// configuration is passed to the `sveltekit(...)` plugin in vite.config.ts,
// and kit's options are top-level there, with no `kit` namespace. This object
// is that argument, in its own module as in the fleet's other repos.
/** @type {import('@sveltejs/kit/vite').Config} */
export default {
  preprocess: vitePreprocess(),
  adapter: adapter({ out: "build" }),
  // `alias` is deprecated in kit 3 (a build warning) in favour of package.json
  // subpath imports (`#lib`), and kit 3 no longer provides `$lib` itself. The
  // `$lib` entries keep every existing import working; moving the fleet to
  // `#lib` is a separate codemod (reddoor-maintenance P1-45's plan).
  alias: {
    $lib: "src/lib",
    "$lib/*": "src/lib/*",
  },
};
