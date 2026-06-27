# Contributing to SaaS Nova Solo

Thank you for your interest in contributing! This document outlines guidelines for contributing.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Respect intellectual property rights

## Development Setup

### Prerequisites
- Node.js 18+
- Git
- Supabase account

### Installation

```bash
git clone https://github.com/seedjobs/SaaS-Nova-Solo.git
cd SaaS-Nova-Solo/frontend
npm install
cp .env.example .env.local
```

### Running Locally

```bash
npm run dev
# Open http://localhost:5173
```

### Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

## Code Style

- Use Prettier for formatting: `npm run format`
- Use ESLint for linting: `npm run lint`
- Follow React best practices and hooks conventions
- Write TypeScript when possible

## Commit Guidelines

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` : New feature
- `fix` : Bug fix
- `docs` : Documentation
- `style` : Code style (no logic change)
- `refactor` : Code refactoring
- `test` : Tests
- `chore` : Build, dependencies

**Example:**
```
feat(finance): add budget forecast chart

- Implement Chart.js integration
- Add budget vs actual comparison
- Tests included

Closes #123
```

## Pull Request Process

1. Fork the repository
2. Create feature branch: `git checkout -b feat/your-feature`
3. Make changes and commit
4. Push to your fork
5. Open PR with clear description
6. Wait for CI checks + code review
7. Merge once approved

## Reporting Issues

### Bugs
- Describe the problem
- Provide steps to reproduce
- Expected vs actual behavior
- Environment (OS, browser, Node version)

### Features
- Clear use case
- Proposed solution
- Alternative approaches

## Questions?

Contact: patrick@pnl-formation.org
