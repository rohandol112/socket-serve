# Contributing to socket-serve

Thank you for your interest in contributing to socket-serve!

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Run tests: `npm test`

## Project Structure

```
socket-serve/
├── src/
│   ├── index.ts          # Main export
│   ├── types.ts          # Core types
│   ├── server/           # Server-side logic
│   ├── client/           # Client SDK
│   ├── redis/            # Redis state management
│   └── adapters/         # Platform adapters
├── examples/             # Example implementations
└── tests/                # Test files
```

## Commit Guidelines

We follow conventional commits:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `test:` adding tests
- `refactor:` code refactoring
- `chore:` maintenance tasks

Example: `feat: add polling transport support`

## Testing

- Write tests for all new features
- Ensure all tests pass before submitting PR
- Run `npm test` to execute test suite

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Add tests if applicable
4. Update documentation
5. Submit PR with clear description

## Code Style

- Use TypeScript
- Follow existing code style
- Run `npm run lint` before committing
- Use meaningful variable names

## Questions?

Open an issue or reach out to the maintainers.
