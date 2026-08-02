# Tagmate Database Architecture

## 1. System Overview

```mermaid
flowchart TD
    A[User opens Tagmate] --> B[Supabase Authentication]

    B --> C[Public User Profile]

    C --> D[Posts and Feed]
    C --> E[Direct Messages]
    C --> F[Neighbourhood Chat]

    D --> G[Comments]
    D --> H[Likes]
    D --> I[Poll Votes]
    D --> J[Event RSVPs]
    D --> K[Saved and Hidden Posts]
    D --> L[Reports]

    G --> M[Notifications]
    H --> M
    I --> M
    J --> M

    D --> N[Post Images]
    N --> O[Supabase Storage]

    D --> P[Location Information]
    P --> Q[PostGIS Search]

    C --> R[Row-Level Security]
    R --> S[Authorized Data Access]
```

## 2. Database Entity Relationships

```mermaid
erDiagram
    AUTH_USERS ||--o| USERS : "has profile"

    USERS ||--o{ TAGS : creates
    USERS ||--o{ POST_COMMENTS : writes
    USERS ||--o{ POST_LIKES : likes
    USERS ||--o{ POST_POLL_VOTES : votes
    USERS ||--o{ POST_RSVPS : attends
    USERS ||--o{ POST_REPORTS : reports
    USERS ||--o{ USER_SAVED_POSTS : saves
    USERS ||--o{ USER_HIDDEN_POSTS : hides
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ DIRECT_MESSAGES : participates
    USERS ||--o{ HOOD_MESSAGES : writes

    TAGS ||--o{ POST_COMMENTS : has
    TAGS ||--o{ POST_LIKES : has
    TAGS ||--o{ POST_POLL_VOTES : has
    TAGS ||--o{ POST_RSVPS : has
    TAGS ||--o{ POST_REPORTS : receives
    TAGS ||--o{ USER_SAVED_POSTS : saved
    TAGS ||--o{ USER_HIDDEN_POSTS : hidden
    TAGS ||--o{ NOTIFICATIONS : referenced
    TAGS ||--o{ DIRECT_MESSAGES : context

    POST_COMMENTS ||--o{ POST_COMMENTS : replies

    AUTH_USERS {
        uuid id PK
        text email
    }

    USERS {
        text uid PK
        uuid auth_user_id FK
        text name
        boolean is_guest
        boolean is_test
        integer reputation
    }

    TAGS {
        uuid id PK
        text user_id FK
        text highlight
        text tag
        float lat
        float lng
        geography location
        text hood_id
        timestamptz created_at
    }

    POST_COMMENTS {
        uuid id PK
        uuid post_id FK
        uuid parent_id FK
        text author_uid FK
        text text
    }

    POST_LIKES {
        uuid id PK
        uuid post_id FK
        text user_id FK
    }

    POST_POLL_VOTES {
        uuid id PK
        uuid post_id FK
        text user_id FK
        integer option_index
    }

    POST_RSVPS {
        uuid id PK
        uuid post_id FK
        text user_id FK
    }

    POST_REPORTS {
        uuid id PK
        uuid post_id FK
        text reporter_id FK
    }

    USER_SAVED_POSTS {
        uuid id PK
        text user_id FK
        uuid post_id FK
    }

    USER_HIDDEN_POSTS {
        uuid id PK
        text user_id FK
        uuid post_id FK
    }

    NOTIFICATIONS {
        uuid id PK
        text user_id FK
        uuid post_id FK
        text type
        boolean read
    }

    DIRECT_MESSAGES {
        uuid id PK
        text thread_id
        text from_uid FK
        text to_uid FK
        uuid post_id FK
        text text
        boolean read
    }

    HOOD_MESSAGES {
        uuid id PK
        text hood_id
        uuid user_id FK
        text text
    }
```

## Notes

- `public.tags` is the main posts table.
- `public.users` stores application profiles.
- `auth.users` stores Supabase authentication accounts.
- Post media is stored in the `tag-images` Storage bucket.
- PostGIS supports geographic post searches.
- Row-Level Security protects application data.