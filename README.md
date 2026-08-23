# Document Vault — GraphQL API

A schema-first GraphQL API for managing collections and documents, built with Prisma and PostgreSQL.

## One-Command Setup

```bash
docker compose up -d && bun install && bun run gendb && bun run dev
```

For a completely fresh database, migrations must also be applied before starting the application:

```bash
docker compose up -d && bun install && bun run gendb && bun run migrate && bun run dev
```

For an existing clone with committed migrations, use:

```bash
docker compose up -d && bun install && bun run gendb && bunx prisma migrate deploy && bun run dev
```

## GraphQL API

### Collections

#### Create a Collection

```graphql
mutation {
  createCollection(
    name: "Engineering"
    slug: "engineering"
  ) {
    id
    name
    slug
    createdAt
  }
}
```

#### List Collections

```graphql
query {
  collections {
    id
    name
    slug
    createdAt
  }
}
```

#### Fetch a Collection

```graphql
query {
  collection(id: "COLLECTION_ID") {
    id
    name
    slug
    createdAt
  }
}
```

### Documents

#### Create a Document

```graphql
mutation {
  createDocument(
    title: "Prisma Architecture"
    content: "Notes about Prisma and PostgreSQL."
    tags: ["prisma", "postgresql"]
    collectionId: "COLLECTION_ID"
  ) {
    id
    title
    content
    tags
    collectionId
    isArchived
    createdAt
  }
}
```

#### Update a Document

Document fields can be updated independently.

```graphql
mutation {
  updateDocument(
    id: "DOCUMENT_ID"
    title: "Updated Prisma Architecture"
    isArchived: true
  ) {
    id
    title
    content
    tags
    isArchived
  }
}
```

#### Delete a Document

```graphql
mutation {
  deleteDocument(id: "DOCUMENT_ID")
}
```

Returns:

```json
{
  "data": {
    "deleteDocument": true
  }
}
```

#### Move a Document

```graphql
mutation {
  moveDocument(
    id: "DOCUMENT_ID"
    collectionId: "TARGET_COLLECTION_ID"
  ) {
    id
    title
    collectionId
  }
}
```

### Searching Documents

The `documents` query supports substring matching against both:

- `title`
- `content`

Example:

```graphql
query {
  documents(search: "postgres") {
    nodes {
      id
      title
      content
    }
    nextCursor
  }
}
```

Search is case-insensitive. For example, searches for `postgres`, `POSTGRES`, `Postgres`, and `PoStGrEs` match the same documents.

### Filtering Documents

#### Filter by Collection

```graphql
query {
  documents(
    collectionId: "COLLECTION_ID"
  ) {
    nodes {
      id
      title
      collectionId
    }
    nextCursor
  }
}
```

#### Filter by Archived State

Active documents:

```graphql
query {
  documents(
    isArchived: false
  ) {
    nodes {
      id
      title
      isArchived
    }
    nextCursor
  }
}
```

Archived documents:

```graphql
query {
  documents(
    isArchived: true
  ) {
    nodes {
      id
      title
      isArchived
    }
    nextCursor
  }
}
```

#### Combined Search and Filtering

All filters can be combined.

```graphql
query {
  documents(
    collectionId: "COLLECTION_ID"
    search: "graphql"
    isArchived: false
    take: 10
  ) {
    nodes {
      id
      title
      content
      collectionId
      isArchived
    }
    nextCursor
  }
}
```

This effectively applies:

```
collectionId = COLLECTION_ID
AND
isArchived = false
AND
(
    title contains "graphql"
    OR
    content contains "graphql"
)
```

### Cursor-Based Pagination

The `documents` query supports cursor-based pagination through:

- `take`
- `cursor`

The default page size is **10**. The maximum page size is **100**.

#### First Page

```graphql
query {
  documents(take: 2) {
    nodes {
      id
      title
      createdAt
    }
    nextCursor
  }
}
```

Example response:

```json
{
  "data": {
    "documents": {
      "nodes": [
        {
          "id": "document-1",
          "title": "GraphQL Architecture"
        },
        {
          "id": "document-2",
          "title": "PostgreSQL Notes"
        }
      ],
      "nextCursor": "document-2"
    }
  }
}
```

#### Next Page

Use the returned `nextCursor`:

```graphql
query {
  documents(
    take: 2
    cursor: "document-2"
  ) {
    nodes {
      id
      title
      createdAt
    }
    nextCursor
  }
}
```

The previous page's final document is skipped and the next set of documents is returned.

#### Pagination Strategy

Documents are ordered deterministically by:

```
createdAt DESC
id DESC
```

The implementation requests `take + 1` records internally. For example, when the client requests `take = 10`, the database query requests 11 records.

- If 11 records are returned: 10 records → returned to client, 1 extra record → proves another page exists.
- If only 10 or fewer records are returned: `nextCursor = null`.

This avoids an additional `COUNT(*)` query just to determine whether another page exists.

### Nested Collection Documents

A collection can return its documents using the same cursor-based pagination implementation.

```graphql
query {
  collection(id: "COLLECTION_ID") {
    id
    name
    slug

    documents(take: 2) {
      nodes {
        id
        title
        content
        tags
        isArchived
      }
      nextCursor
    }
  }
}
```

The pagination logic is shared between `documents(...)` and `collection(...) { documents(...) }` through `src/graphql/utils/document-pagination.ts`. This avoids maintaining separate pagination implementations.

### Validation and Error Handling

Invalid client input is converted into meaningful GraphQL errors.

#### Empty Document Title

```graphql
mutation {
  createDocument(
    title: "   "
    content: "Valid content"
    collectionId: "COLLECTION_ID"
  ) {
    id
  }
}
```

Returns an error with `code: BAD_USER_INPUT`.

#### Empty Document Content

```graphql
mutation {
  createDocument(
    title: "Valid title"
    content: "   "
    collectionId: "COLLECTION_ID"
  ) {
    id
  }
}
```

Returns `code: BAD_USER_INPUT`.

#### Invalid Pagination

```graphql
query {
  documents(take: 0) {
    nodes {
      id
      title
    }
  }
}
```

Returns `take must be an integer between 1 and 100` with `code: BAD_USER_INPUT`.

#### Missing Collection

Attempting to create a document using a nonexistent collection returns `code: NOT_FOUND`.

#### Missing Document

Updating, deleting, or moving a nonexistent document returns `code: NOT_FOUND`.

#### Duplicate Collection Slug

Creating a collection with an existing slug returns `code: CONFLICT`.

## Database

### Prisma Schema

The domain consists of two models:

```
Collection
├── id
├── name
├── slug
└── createdAt

Document
├── id
├── title
├── content
├── tags
├── collectionId
├── isArchived
└── createdAt
```

A collection has many documents:

```
Collection 1 ──────── * Document
```

Documents reference their collection through `collectionId`. The relationship uses cascading deletion:

```
Collection deleted
        ↓
Associated documents deleted
```

### Database Indexes

The schema includes indexes for common query patterns:

- `collectionId`
- `collectionId` + `isArchived`
- `createdAt`

These support collection filtering, archived filtering, and chronological document ordering.

### Database Migrations

Schema changes must go through Prisma migrations.

Create a new migration during development:

```bash
bun run migrate -- --name <migration-name>
```

Example:

```bash
bun run migrate -- --name add_document_metadata
```

Generate the Prisma Client after schema changes:

```bash
bun run gendb
```

Committed migrations can be applied using:

```bash
bunx prisma migrate deploy
```

No hand-written or manually edited SQL migrations are used.

## Testing

The project contains both unit tests and integration tests.

### Run All Tests

```bash
bun test
```

### Run Unit Tests

```bash
bun test tests/unit
```

Unit tests cover resolver behavior using mocked Prisma operations. The tests cover:

- Collection queries
- Collection creation
- Empty collection names
- Invalid slugs
- Duplicate slugs
- Document creation
- Empty document titles
- Empty document content
- Missing collections
- Document updates
- Document deletion
- Document movement
- Search
- Collection filtering
- Archived filtering
- Cursor pagination
- Invalid pagination values

### Run Integration Tests

Start PostgreSQL first:

```bash
docker compose up -d
```

Then run:

```bash
bun test tests/integration
```

The integration tests connect to the real PostgreSQL instance running through Docker Compose. The integration flow verifies database behavior including:

```
Application
    ↓
Prisma Client
    ↓
PostgreSQL
    ↓
Docker
```

### Type Checking

Run TypeScript strict type checking:

```bash
bun run typecheck
```

The project is configured with strict TypeScript settings and avoids `any`.

### Linting

Run ESLint:

```bash
bun run lint
```

### Sanity Check

The project provides a single command for the main quality checks:

```bash
bun run sanity
```

This runs:

```
lint
  ↓
typecheck
  ↓
tests
```

Equivalent to:

```bash
bun run lint && bun run typecheck && bun run test
```

## Development Commands

| Command | Description |
|---|---|
| `bun run dev` | Start development server with watch mode |
| `bun run start` | Start production server |
| `bun run gendb` | Generate Prisma Client |
| `bun run migrate` | Create/apply development migrations |
| `bun run studio` | Open Prisma Studio |
| `bun run test` | Run all tests |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run lint` | Run ESLint |
| `bun run sanity` | Run lint, typecheck, and tests |

## Design Decisions

### Schema-First GraphQL

The GraphQL API contract is defined in a dedicated `.graphql` schema file. Resolvers are implemented separately from the schema. This makes the API contract explicit and easier to review.

### Resolver-Level Validation

Input validation is performed before database operations. For example:

```
GraphQL request
      ↓
Validate input
      ↓
Validate related entities
      ↓
Prisma operation
```

This allows invalid requests to produce meaningful GraphQL errors instead of leaking database errors to API consumers.

### Reusable Pagination

Cursor pagination is implemented in `src/graphql/utils/document-pagination.ts`. Both top-level `documents` and nested `collection.documents` use this implementation. This avoids duplicated pagination logic and keeps resolver responsibilities focused on building filters.

### Deterministic Ordering

Documents are ordered by `createdAt DESC, id DESC`. The secondary `id` ordering provides deterministic ordering when multiple documents have the same timestamp.

### No Authentication or Authorization

Authentication, RBAC, and permissions were intentionally not implemented because they are explicitly out of scope for this assignment. The same applies to GraphQL Federation, Redis, Caching, and Deployment. The implementation focuses on the requested domain and API functionality.

## Tradeoffs

The implementation intentionally prioritizes correctness and maintainability over additional features.

**Chosen**
- Schema-first GraphQL
- Prisma for database access
- PostgreSQL
- Cursor pagination
- Resolver-level validation
- Reusable pagination logic
- Unit tests
- PostgreSQL integration tests

**Not Added**
- Authentication
- Authorization
- RBAC
- Redis
- Caching
- Federation
- Deployment infrastructure

These features would increase complexity without contributing to the required assignment scope.

## Possible Future Extensions

If the service needed to evolve into a larger production system, possible extensions include:

**Authentication and Authorization**
Add authentication and collection/document ownership. Possible approaches: JWT, Session-based authentication, OAuth.

**Full-Text Search**
The current implementation uses substring matching against title and content. For larger datasets, PostgreSQL full-text search could be introduced to improve search performance and relevance.

**Tag Filtering**
Support queries such as:

```graphql
documents(tags: ["backend", "graphql"])
```

**Document Versioning**
Maintain historical document versions instead of overwriting content during updates.

**Soft Deletion**
Instead of permanently deleting documents, introduce a deletion timestamp: `deletedAt`.

**Object Storage**
If document content eventually includes large files or binary assets, content could be stored in object storage while PostgreSQL stores metadata.

**Observability**
Add structured logging, metrics, tracing, and error monitoring.

## Scope

This implementation intentionally excludes the following features because they are explicitly out of scope:

- Authentication
- RBAC
- Permissions
- GraphQL Federation
- Redis
- Caching
- Deployment

The goal is to provide a clean, tested, maintainable implementation of the requested Document Vault API without unnecessary complexity.

## Author

Jeganath B

*Document Vault — GraphQL API*

## Submission

This repository contains the completed Document Vault GraphQL API take-home assignment.

The implementation was developed incrementally with focused commits covering the database schema, GraphQL operations, pagination, tests, documentation, Docker support, and CI.