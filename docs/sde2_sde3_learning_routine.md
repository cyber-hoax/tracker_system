# SDE-2 / SDE-3 Preparation Routine

## 1. Overall Strategy

The routine is designed around the following constraints:

- Work: **9:00 AM – 7:00 PM** on Monday, Tuesday, Wednesday, and Friday.
- Thursday: **Work from home**, with work wrapping around **5:00 PM**.
- Saturday and Sunday: **Off**.
- Dinner: normally **9:30 PM – 10:00 PM**, but can be later occasionally.
- Walking: **20 minutes after dinner**.
- Reading: **30 minutes daily**.
- Sleep target: around **11:45 PM – 12:15 AM**, with sufficient total sleep protected.
- The user is **not naturally a morning person**, so the plan does not depend on early-morning study sessions.

The core structure is:

> **Small morning routine + primary learning at night + deep-work Thursday + long focused weekend blocks.**

The goal is to prepare for **SDE-2 / SDE-3** while developing:

1. DSA
2. LLD
3. HLD / System Design
4. Distributed Systems depth
5. AI fundamentals and internals
6. Project / production-level interview depth
7. Consistent reading, exercise, and sleep

---

# 2. Target Outcome

## DSA

Target approximately:

**250–300 high-quality problems** over roughly 5–6 months.

Suggested difficulty distribution:

| Difficulty | Target |
|---|---:|
| Easy | 30–40 |
| Medium | 190–220 |
| Hard | 30–40 |
| **Total** | **250–300** |

The objective is not to memorize 300 questions. The objective is to understand reusable patterns and solve unfamiliar Medium problems independently.

A good readiness benchmark is:

> Can I solve a new Medium problem in approximately 20–30 minutes without immediately recognizing the exact problem?

For every important DSA problem, practice explaining:

```text
Brute force
    ↓
Why it is too slow
    ↓
Observation
    ↓
Optimal approach
    ↓
Time complexity
    ↓
Space complexity
    ↓
Edge cases
```

---

# 3. DSA Topic Distribution

| Topic | Approx. Problems |
|---|---:|
| Arrays / Strings / Hashing | 35 |
| Two Pointers / Sliding Window | 20 |
| Binary Search | 15 |
| Linked List | 15 |
| Stack / Queue | 15 |
| Trees / BST | 30 |
| Heap / Priority Queue | 15 |
| Graph / BFS / DFS / Union Find | 35 |
| Greedy | 15 |
| Backtracking | 10 |
| Dynamic Programming | 35 |
| Intervals / Prefix Sum / Sweep Line | 15 |
| Trie / Bit Manipulation / Misc | 15 |
| **Total** | **~280** |

Focus on patterns such as:

```text
Sliding Window
    ├── Fixed window
    ├── Variable window
    ├── At most K
    ├── Exactly K
    └── Frequency map

Binary Search
    ├── Sorted array
    ├── Lower bound
    ├── Answer-space binary search
    └── Rotated array

Tree
    ├── DFS
    ├── BFS
    ├── Bottom-up
    ├── Path problems
    └── BST

Graph
    ├── BFS / DFS
    ├── Topological sort
    ├── Union Find
    ├── Shortest path
    └── MST
```

---

# 4. LLD Goals

LLD should be treated as a practical engineering skill, not only an interview theory subject.

Target approximately:

- **10–15 complete LLD designs**
- **5–8 implemented machine-coding projects**

Practice systems such as:

```text
Parking Lot
Splitwise
Vending Machine
Library Management
Elevator
Logger
Rate Limiter
LRU Cache
Pub/Sub
Movie Booking
Notification System
Task Scheduler
```

Core concepts:

```text
Interfaces
Composition
Inheritance
SOLID
Strategy Pattern
Factory Pattern
Observer Pattern
State Pattern
Decorator Pattern
Dependency Injection
Concurrency
Thread Safety
Extensibility
```

The goal is to be able to explain why a design is extensible, how responsibilities are separated, and what changes would require minimal modification.

---

# 5. HLD / System Design Goals

HLD should progress beyond the basic:

```text
Client
  ↓
API
  ↓
Service
  ↓
Database
```

Study:

```text
Load Balancing
Caching
CDN
Database Indexing
SQL vs NoSQL
Partitioning
Sharding
Replication
Consistency
Availability
Kafka
Queues
Streams
Rate Limiting
Distributed Locks
Service Discovery
Idempotency
Retries
Circuit Breakers
Backpressure
CAP
Observability
Failure Recovery
```

Most importantly, learn to answer:

> Why this design instead of another design?

For SDE-3-level preparation, go deeper into:

```text
Failure modes
Capacity planning
Operational complexity
Data consistency
Migration
Backward compatibility
Multi-region architecture
Observability
Incident handling
Cost
```

Target approximately:

**20–25 complete system-design exercises**.

---

# 6. AI Learning Track

The goal is not just learning AI APIs, SDKs, LangChain, or RAG tutorials.

The objective is to understand **how AI works under the hood** and then build production-oriented systems around it.

## Stage 1 — ML Fundamentals

```text
Training
Inference
Loss functions
Gradient descent
Backpropagation
Parameters
Weights
Bias
Overfitting
Embeddings
```

## Stage 2 — Neural Networks and Transformers

```text
Neural Networks
CNN
RNN
Attention
Transformers
```

## Stage 3 — LLM Internals

Understand:

```text
Tokenization
Embedding layer
Positional encoding
Self-attention
Multi-head attention
Q / K / V
Feed-forward layers
Residual connections
LayerNorm
Logits
Softmax
Temperature
Sampling
Context window
KV cache
```

At a high level, understand this flow:

```text
"Hello world"
       ↓
Tokens
       ↓
Embeddings
       ↓
Transformer layers
       ↓
Logits
       ↓
Next-token probabilities
       ↓
Sampling
       ↓
Next token
```

## Stage 4 — Training

```text
Pretraining
Next-token prediction
Cross entropy
Batching
Adam
Learning rate
Distributed training
Data parallelism
Model parallelism
Checkpointing
```

## Stage 5 — Practical LLM Systems

```text
RAG
Vector search
Chunking
Embeddings
Reranking
Function calling
Agents
Tool use
Evaluation
Guardrails
Inference optimization
Quantization
LoRA / PEFT
```

## AI Projects

Build while learning:

```text
Project 1 → Neural network from scratch
Project 2 → Tiny transformer
Project 3 → Tokenizer + inference
Project 4 → Embedding search
Project 5 → RAG system
Project 6 → Tool-using agent
```

The intended outcome is:

> Understand what happens inside the model and be capable of building production systems around AI.

---

# 7. Morning Routine

Because the user is not naturally a morning person, morning time is **maintenance time, not technical study time**.

## Target

```text
7:30 AM   Wake up
7:30–7:40 AM   Water + wash + sunlight
7:40–7:55 AM   Light movement / stretching
7:55–8:15 AM   Shower + get ready
```

Rules:

- Do not schedule DSA in the morning.
- Do not schedule HLD in the morning.
- Do not schedule AI in the morning.
- Use the morning to make the day predictable.
- Maintain a consistent wake time rather than forcing a 5 AM schedule.

---

# 8. Monday / Tuesday / Wednesday / Friday Routine

## 7:00–7:30 PM

Work ends → decompression.

Use this time for:

```text
Travel / decompression
Tea / snack
Short walk
Personal reset
```

Do not immediately start studying.

## 7:30–9:00 PM — DSA

```text
7:30–7:40   Review yesterday's problem
7:40–8:30   New DSA problem
8:30–9:00   Second problem / redo / notes
```

Primary goal:

> **One serious problem + review**, rather than two rushed problems.

## 9:00–9:30 PM — Break

No technical studying.

## 9:30–10:00 PM — Dinner

Dinner can occasionally be later. When dinner shifts, shift the walk and second study block accordingly rather than compressing everything.

## 10:00–10:20 PM — Walk

Use the 20-minute walk as a transition from dinner to the second study session.

## 10:20–11:20 PM — Secondary Subject

| Day | Subject |
|---|---|
| Monday | LLD |
| Tuesday | HLD |
| Wednesday | AI |
| Friday | HLD / LLD alternating |

## 11:20–11:50 PM — Book

Fixed 30-minute reading block.

Do not automatically convert this into another technical-study block.

## 11:50 PM–12:15 AM — Shutdown

```text
Prepare tomorrow
Set priorities
Light reading / music
No work
```

Target sleep around **11:45 PM–12:15 AM**, while protecting sufficient total sleep.

---

# 9. Thursday — Deep Work Day

Thursday is the highest-value weekday because work finishes around 5 PM.

Do not automatically study for five hours just because the time is available. Use focused blocks with breaks.

```text
5:00–5:30 PM     Finish work / reset
5:30–7:00 PM     DSA
7:00–7:30 PM     Break
7:30–9:00 PM     HLD or LLD
9:00–9:30 PM     Break
9:30–10:00 PM    Dinner
10:00–10:20 PM   Walk
10:20–11:20 PM   AI
11:20–11:50 PM   Book
12:00 AM         Sleep
```

Thursday is the preferred day for:

- Long DSA sessions
- Complete LLD designs
- Complete system-design exercises
- AI implementation work
- Project architecture deep dives

---

# 10. Saturday Routine

Saturday is a long-focus learning day, but not a five-hour nonstop study marathon.

Target approximately **4–5 hours of focused learning**.

```text
9:00–9:30 AM      Wake / breakfast / movement

10:00 AM–12:00 PM DSA
12:00–12:30 PM    Break

12:30–2:00 PM     LLD
2:00–4:00 PM      Personal time

4:00–5:30 PM      AI

Evening           Free
9:30–10:00 PM     Dinner
10:00–10:20 PM    Walk
11:30 PM–12:00 AM Book
```

Saturday focus:

- 2 hours DSA
- 1.5 hours LLD
- 1.5 hours AI

---

# 11. Sunday Routine

Sunday is more design-heavy and should also contain mock practice and weekly review.

```text
9:00–9:30 AM      Wake / breakfast

10:00 AM–12:00 PM DSA mock / contest-style practice

12:00–1:00 PM     Break

1:00–2:30 PM      HLD

2:30–4:00 PM      Lunch / rest

4:00–5:30 PM      HLD or project architecture

5:30 PM onward    Free time
```

Sunday focus:

- Timed DSA
- System design mock
- HLD practice
- Project architecture
- Weekly review
- Recovery and personal time

---

# 12. Weekly Allocation

| Area | Weekly Target |
|---|---:|
| DSA | **9–10 hours** |
| HLD | **4–5 hours** |
| LLD | **3–4 hours** |
| AI Fundamentals | **3–4 hours** |
| Reading | **3.5 hours** |
| Walking / Exercise | Daily |
| Free Time | Protected |

This is already an aggressive schedule. Do not continuously increase the number of study hours.

---

# 13. Six-Month Progression

## Months 1–2 — DSA Heavy

Approximate focus:

```text
DSA        60%
LLD        15%
HLD        15%
AI         10%
```

Target:

**100–120 DSA problems**

Primary topics:

```text
Arrays
Strings
Hashing
Two Pointers
Sliding Window
Binary Search
Linked Lists
Stack / Queue
Trees
Heap
Graphs
```

---

## Months 3–4 — Balanced Engineering Prep

Approximate focus:

```text
DSA        40%
LLD        25%
HLD        25%
AI         10%
```

Target another:

**80–100 DSA problems**

Start serious work on:

```text
LLD implementations
Distributed systems
Kafka
Redis
Database scaling
Caching
Concurrency
System design
```

---

## Months 5–6 — Interview Readiness

Approximate focus:

```text
DSA        ~25–30%
LLD        ~20%
HLD        ~30–35%
AI         ~20%
```

At this point, stop aggressively collecting new DSA questions.

Shift toward:

```text
Timed DSA
Mock interviews
HLD mocks
LLD mocks
Project deep dives
AI implementation
System-design tradeoffs
Production failure scenarios
```

---

# 14. Project / Production Depth

For SDE-2/SDE-3 preparation, use real project experience as a parallel interview track.

Be prepared to explain:

```text
Why the architecture looks the way it does
Why a particular database was selected
Why Kafka / queueing was required
How scaling works
How concurrency is handled
What happens during failure
How retries work
How idempotency is maintained
How deployments are performed
How observability is implemented
How incidents are diagnosed
What tradeoffs were accepted
What you would redesign today
```

Connect HLD and distributed-systems concepts to actual production experience instead of learning system design only as interview diagrams.

---

# 15. Weekly Review Template

Use this every Sunday.

## DSA

```text
Problems solved:

Patterns learned:

Weak patterns:

Problems requiring revisit:

Timed performance:
```

## LLD

```text
Design completed:

Patterns used:

Implementation completed:

Weak areas:
```

## HLD

```text
Systems designed:

Tradeoffs understood:

Weak areas:

Failure scenarios reviewed:
```

## AI

```text
Topic learned:

Implementation completed:

Concepts I can explain from first principles:

Concepts still unclear:
```

## Personal

```text
Average sleep:

Exercise / walks:

Reading completed:

Study hours:

Energy level:
```

---

# 16. Non-Negotiables

1. **Protect sleep.** Do not routinely sacrifice sleep for study hours.
2. **Do not force a 5 AM routine.** The plan is designed around being a non-morning person.
3. **DSA should be consistent, not excessive.** Aim for 250–300 quality problems rather than collecting huge numbers.
4. **Use Thursday and weekends for deep work.**
5. **Keep the 20-minute walk.**
6. **Keep the 30-minute reading habit.**
7. **Protect free time.** Long-term consistency matters more than maximizing daily study hours.
8. **Learn AI from fundamentals.** Avoid becoming dependent on API wrappers without understanding model internals.
9. **Connect HLD/LLD to production experience.**
10. **Shift from learning to mocks during the final phase.**

---

# 17. Final Weekly Calendar

| Time | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|---|
| 7:30–8:15 AM | Morning routine | Morning routine | Morning routine | Morning routine | Morning routine | Wake/breakfast | Wake/breakfast |
| Work | 9–7 | 9–7 | 9–7 | 9–5 | 9–7 | Off | Off |
| 5:30–7:00 PM | Work | Work | Work | **DSA** | Work | — | — |
| 7:30–9:00 PM | **DSA** | **DSA** | **DSA** | **HLD/LLD** | **DSA** | **DSA 10–12** | — |
| 9:30–10:00 PM | Dinner | Dinner | Dinner | Dinner | Dinner | Dinner | Dinner |
| 10:00–10:20 PM | Walk | Walk | Walk | Walk | Walk | Walk | Walk |
| 10:20–11:20 PM | **LLD** | **HLD** | **AI** | **AI** | **HLD/LLD** | — | — |
| 11:20–11:50 PM | Book | Book | Book | Book | Book | Book | Book |
| Weekend daytime | — | — | — | — | — | **LLD + AI** | **DSA mock + HLD** |

---

# 18. Core Principle

The routine is intentionally built around sustainability rather than maximum hours.

The preferred pattern is:

```text
Morning:
Maintain routine

Weekdays:
DSA + one engineering subject

Thursday:
Deep work

Saturday:
DSA + LLD + AI

Sunday:
Mocks + HLD + review

Every day:
20-minute walk + 30-minute reading + protected sleep
```

The target is to accumulate roughly **20+ focused learning hours per week** while maintaining sleep, exercise, reading, and personal time.

The end state after approximately 5–6 months is:

```text
250–300 quality DSA problems
10–15 LLD designs
5–8 implemented LLD / machine-coding projects
20–25 HLD/system designs
Strong distributed-systems fundamentals
AI fundamentals + transformer internals
Multiple AI implementations
Strong project / production-depth explanations
Mock-interview readiness
```
