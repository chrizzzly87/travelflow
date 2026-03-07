# AI Trip Generation Runtime Flows (Async Worker)

Status: draft  
Date: 2026-03-06

## 1. Create trip (authenticated)

```mermaid
sequenceDiagram
    participant User
    participant UI as "Create Trip UI"
    participant DB as "Supabase RPC/DB"
    participant Queue as "Generation Queue"
    participant Worker as "AI Generation Worker"

    User->>UI: "Submit trip generation"
    UI->>DB: "Persist placeholder trip"
    UI->>DB: "Start attempt log (queued)"
    UI->>DB: "Enqueue generation job"
    UI->>User: "Navigate to /trip/:id (queued/running state)"

    Worker->>Queue: "Claim runnable job"
    Worker->>DB: "Mark attempt running"
    Worker->>Worker: "Call provider/model"

    alt "Generation success"
        Worker->>DB: "Write generated trip + diagnostics"
        Worker->>DB: "Mark attempt/job succeeded"
    else "Generation failure/timeout"
        Worker->>DB: "Mark attempt/job failed + diagnostics"
    end

    UI->>DB: "Poll trip state while queued/running"
    UI->>User: "Render terminal state (succeeded/failed)"
```

## 2. Create trip (signed-out user with claim flow)

```mermaid
sequenceDiagram
    participant Guest as "Guest User"
    participant UI as "Create Trip UI"
    participant DB as "Supabase RPC/DB"
    participant Auth as "Auth"
    participant Worker as "AI Generation Worker"

    Guest->>UI: "Submit draft"
    UI->>DB: "Persist placeholder trip"
    UI->>Guest: "Open trip page with pending state"
    UI->>Guest: "Prompt login/register to start generation"

    Guest->>Auth: "Login or register"
    Auth-->>UI: "Authenticated session"
    UI->>DB: "Claim pending request + start attempt"
    UI->>DB: "Enqueue async generation"

    Worker->>DB: "Claim job and process"
    Worker->>DB: "Write terminal result"

    UI->>DB: "Poll until terminal"
    UI->>Guest: "Show completed trip or failed diagnostics + retry"
```

## 3. Open trip URL decision flow

```mermaid
flowchart LR
    A["Open /trip/:tripId"] --> B{"Authenticated & authorized?"}
    B -->|"No"| C["Redirect to login/share-unavailable path"]
    B -->|"Yes"| D["Load local snapshot + DB snapshot"]

    D --> E{"Generation state"}
    E -->|"succeeded"| F["Render itinerary"]
    E -->|"failed"| G["Render failed banner + diagnostics + retry"]
    E -->|"queued/running"| H["Render progress overlay/banner + poll + worker nudge"]

    H --> I{"Terminal update received?"}
    I -->|"Yes: succeeded"| F
    I -->|"Yes: failed"| G
    I -->|"No, stale attempt and no active job"| J["Mark failed with stall diagnostics"]
    J --> G
```

## 4. Retry flow (same trip)

```mermaid
sequenceDiagram
    participant User
    participant UI as "Trip View / Trip Info"
    participant DB as "Supabase RPC/DB"
    participant Worker

    User->>UI: "Retry generation"
    UI->>DB: "Preflight current attempt/job state"

    alt "In-flight job already active"
        UI->>User: "Reuse running attempt, keep queued/running state"
    else "No active runnable job"
        UI->>DB: "Start new attempt log (same trip ID)"
        UI->>DB: "Enqueue new job"
    end

    Worker->>DB: "Process and write terminal diagnostics"
    UI->>DB: "Poll until terminal"
    UI->>User: "Show succeeded trip or failed diagnostics"
```
