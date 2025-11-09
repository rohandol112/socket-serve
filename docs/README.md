# socket-serve Documentation

This directory contains the Mintlify documentation for socket-serve.

## Local Development

Install Mintlify CLI:

```bash
npm install -g mint
```

Start the development server:

```bash
cd docs
mint dev
```

Visit http://localhost:3000

## Structure

```
docs/
├── mint.json                 # Mintlify configuration
├── introduction.mdx          # Homepage
├── quickstart.mdx            # Getting started guide
├── installation.mdx          # Installation instructions
├── concepts/                 # Core concepts
│   ├── architecture.mdx
│   ├── transports.mdx
│   ├── state-management.mdx
│   └── rooms.mdx
├── guides/                   # How-to guides
│   ├── nextjs-setup.mdx
│   ├── express-setup.mdx
│   ├── redis-setup.mdx
│   └── deployment.mdx
├── api-reference/            # API documentation
│   ├── introduction.mdx
│   ├── server/
│   ├── client/
│   └── types.mdx
├── examples/                 # Example applications
│   ├── introduction.mdx
│   ├── chat-app.mdx
│   └── ...
└── advanced/                 # Advanced topics
    ├── custom-adapters.mdx
    ├── scaling.mdx
    ├── security.mdx
    └── troubleshooting.mdx
```

## Deployment

Documentation is automatically deployed to Mintlify when changes are pushed to the main branch.

### Setup Mintlify Deployment

1. Go to [dashboard.mintlify.com](https://dashboard.mintlify.com)
2. Sign in with GitHub
3. Install the Mintlify GitHub App
4. Connect your repository
5. Set the documentation path to `docs`
6. Deploy!

Your docs will be available at: `https://socket-serve.mintlify.app`

## Writing Documentation

### Creating New Pages

1. Create a new `.mdx` file in the appropriate directory
2. Add frontmatter:
   ```mdx
   ---
   title: 'Page Title'
   description: 'Page description for SEO'
   ---
   ```
3. Add the page to `mint.json` navigation
4. Write content using Markdown and Mintlify components

### Available Components

- `<Card>` - Card links
- `<CardGroup>` - Group multiple cards
- `<CodeGroup>` - Multiple code snippets with tabs
- `<Accordion>` - Collapsible content
- `<AccordionGroup>` - Group multiple accordions
- `<Note>`, `<Warning>`, `<Tip>` - Callout boxes
- `<Frame>` - Image frames
- `<Tabs>`, `<Tab>` - Tabbed content

### Code Blocks

```typescript filename="example.ts"
import { createSocketServer } from 'socket-serve';

const server = createSocketServer({
  redisUrl: process.env.REDIS_URL!
});
```

### Mintlify CLI Commands

```bash
# Start dev server
mint dev

# Build for production
mint build

# Validate docs
mint check
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on contributing to the documentation.
