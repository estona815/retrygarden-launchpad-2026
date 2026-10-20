# RetryGarden

A local, deterministic teaching tool for retry policies, lost acknowledgements,
finite server capacity and duplicate effects. Original implementation for
LaunchPad Hacks, begun October 20, 2026. Individual event registration is complete. Final project submission was completed on October 20, 2026.

## Run

Requires Python 3 for the local static server; no installation, API key or network
service is needed. From this source folder:

```sh
python3 -m http.server 8878 --bind 127.0.0.1
```

Open `http://127.0.0.1:8878/`. The server serves local files only. The simulator
does not send network requests, collect telemetry or persist imported data.

## Walkthrough

1. Run the default 8-client lost-acknowledgement scenario. Compare attempts,
   effects, acknowledged and pending clients for both policies.
2. Inspect a `Response lost` row: the effect already happened even though the
   client did not receive its acknowledgement.
3. Enable **Deduplicate operations** and run again. Each operation can now apply
   at most once. Duplicate effects and missing acknowledgement are different.
4. Select **Capacity squeeze**, change capacity and seed, and rerun. Jitter is
   a randomized policy, not a guaranteed improvement for every seed or metric.
5. Export the actual JSON trace. It includes the exact settings, assumptions,
   per-tick load, every attempt and each client's terminal state for both runs.
   Changing an input without running does not alter this last-run export.

## Model

Discrete integer ticks and zero service latency. All clients initially attempt
at tick 0. Stable ascending client ID breaks simultaneous arrival ties. Capacity
limits accepted requests in each tick, including deduplicated requests.
`Capacity squeeze` has no outage; both other scenarios reject requests at ticks
0 and 1. In `Lost acknowledgement`, the first accepted response for C01, C04,
C07, etc. is lost exactly once, **after** any server effect. Later accepted
attempts acknowledge normally. No attempt runs after acknowledgement.

Fixed delay retries after an editable positive number of ticks. Bounded jitter
waits uniformly on integer ticks from 1 through `min(cap, 2^attempt)`, using a
seeded 32-bit LCG. This positive minimum intentionally differs from continuous
full jitter starting at zero. Identical settings reproduce the trace; changing
settings can change random draw consumption and client ordering. This is a
teaching comparison, not statistically controlled production benchmarking.

Deduplication keeps a stable operation key for the entire run. It suppresses
duplicate application effects, not retries or request processing. The model
does not cover key expiry, crashes, partial writes, queues, latency distributions,
HTTP semantics, authentication or a real server. The 80-tick horizon is finite.
Pending means not acknowledged, including attempt-exhausted clients; exported
records distinguish `exhausted` from horizon-`pending`. Effects are applications,
not payments, orders or measured production incidents.

## Validation

Run `node --test simulator.test.mjs` using Node.js 18+. On October 20, nine
tests passed, including 200 bounded settings evaluated with both policies.
An analytical 80-client horizon case distinguishes 76 still-scheduled clients
from attempt-exhausted clients; the UI reports these separately.
Actual browser checks exercised deduplication, scenario changes, trace selection
and a JSON download; downloaded settings and duplicate-effect accounting were
checked. Desktop and a 390 CSS-pixel iframe were visually reviewed by the producer.
A separate source/model/packet reviewer verified these seven files and the source
archive, reran all nine tests, and compared 3,200 full traces and final client
states against an independently implemented event-queue reference model using
BigInt random-number arithmetic. A final-attempt lost-response counterexample
also passed. That review did not repeat live browser or assistive-technology
testing. No measured user impact or organizer approval is claimed. Individual
event registration is complete; final project submission was completed on October 20, 2026.

## Attribution

OpenAI Codex assisted with concept, original implementation, documentation and
tests under participant kwonj0815's instructions. A built-in image tool produced
a separate design reference; that reference is not a functional screenshot.
The runtime uses native browser APIs, system fonts and original CSS/SVG. No
external libraries, datasets, stock imagery or paid inference are incorporated.
