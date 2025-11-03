# Contributing to socket-serve# Contributing to socket-serve



Thank you for considering contributing to socket-serve! 🎉Thank you for your interest in contributing to socket-serve!



## Development Setup## Development Setup



1. **Fork and clone**1. Fork and clone the repository

   ```bash2. Install dependencies: `npm install`

   git clone https://github.com/YOUR_USERNAME/socket-serve.git3. Build the project: `npm run build`

   cd socket-serve4. Run tests: `npm test`

   ```

## Project Structure

2. **Install dependencies**

   ```bash```

   npm installsocket-serve/

   ```├── src/

│   ├── index.ts          # Main export

3. **Start Redis (for testing)**│   ├── types.ts          # Core types

   ```bash│   ├── server/           # Server-side logic

   docker run -d -p 6379:6379 --name redis redis:alpine│   ├── client/           # Client SDK

   ```│   ├── redis/            # Redis state management

│   └── adapters/         # Platform adapters

4. **Build the project**├── examples/             # Example implementations

   ```bash└── tests/                # Test files

   npm run build```

   ```

## Commit Guidelines

5. **Run tests**

   ```bashWe follow conventional commits:

   npm test

   ```- `feat:` new feature

- `fix:` bug fix

## Project Structure- `docs:` documentation changes

- `test:` adding tests

```- `refactor:` code refactoring

socket-serve/- `chore:` maintenance tasks

├── src/

│   ├── index.ts           # Main entry pointExample: `feat: add polling transport support`

│   ├── types.ts           # TypeScript types

│   ├── adapters/          # Platform adapters (Next.js, Express)## Testing

│   ├── server/            # Server-side logic

│   ├── client/            # Browser client SDK- Write tests for all new features

│   └── redis/             # Redis state management- Ensure all tests pass before submitting PR

├── examples/- Run `npm test` to execute test suite

│   ├── nextjs/            # Next.js example

│   └── express/           # Express example## Pull Request Process

└── dist/                  # Compiled output (generated)

```1. Create a feature branch from `main`

2. Make your changes

## Development Workflow3. Add tests if applicable

4. Update documentation

1. **Create a branch**5. Submit PR with clear description

   ```bash

   git checkout -b feature/your-feature-name## Code Style

   ```

- Use TypeScript

2. **Make your changes**- Follow existing code style

   - Edit files in `src/`- Run `npm run lint` before committing

   - Add tests if applicable- Use meaningful variable names

   - Update documentation

## Questions?

3. **Build and test**

   ```bashOpen an issue or reach out to the maintainers.

   npm run build
   npm test
   ```

4. **Test with examples**
   ```bash
   cd examples/nextjs
   npm install
   npm run dev
   ```

5. **Commit with conventional commits**
   ```bash
   git commit -m "feat: add new feature"
   git commit -m "fix: resolve issue with X"
   git commit -m "docs: update README"
   ```

6. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier (run `npm run format`)
- **Linting**: ESLint (run `npm run lint`)
- **Naming**: camelCase for functions, PascalCase for classes

## Testing

- Write tests for new features in `tests/`
- Ensure all tests pass: `npm test`
- Aim for >80% coverage

## Pull Request Guidelines

1. **Keep PRs focused** - One feature/fix per PR
2. **Update documentation** - README, JSDoc comments
3. **Add tests** - For new functionality
4. **Describe changes** - Clear PR description
5. **Link issues** - Reference related issues

## Questions?

- Open an [issue](https://github.com/rohandol112/socket-serve/issues)
- Start a [discussion](https://github.com/rohandol112/socket-serve/discussions)

Thank you for contributing! 🚀
