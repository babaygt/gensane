# Quick start

Four commands give you a site running on your computer:

```sh
npx @gensane/cli init my-site
cd my-site
npm install
npm run dev
```

1. **`init`** asks a few questions, such as the site's title, your name and its colors, and writes a site that builds at once. Each
   question has a default in brackets, which Enter takes.
2. **`npm install`** installs gensane in the site's folder, so the site keeps building the same way, with the version it was made
   with.
3. **`npm run dev`** shows the site at `http://localhost:4000/` and reloads the page when you save a file. Ctrl+C stops it.

## Write

Open `content/blog/` and change the first post, or start a new one:

```sh
npx gensane new post "My next post"
```

It starts as a draft: `npm run dev` shows it, but it isn't published until you remove `draft: true`. Projects, talks and pages
start the same way: [`new`](../cli/new.md) shows them all.

## Publish

```sh
npm run build
```

writes the whole site into `dist/`. To publish it on every push, [`npx gensane deploy init github`](../cli/deploy.md) (or
`cloudflare`, or `netlify`) adds the file the host needs, and says what to do there.

## Next

[Your first site](tutorial.md) goes through the same steps slowly, and shows what each one does.
