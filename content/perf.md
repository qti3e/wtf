---
title: "Performance is correctness"
desc: "Why slow code isn't just a performance issue—it's a design failure that leads to bugs, security holes, and lost control."
date: jan 2, 2026
---

# Performance is correctness

there's this thing people say that i've always hated:

"that's not a bug, it's a performance issue"

as if those are different categories. as if slowness is some cosmetic flaw
you get to later, after the real work is done.

this is wrong.

slow code is code that has lost control of itself. it carries too much state,
touches too much memory, does more work than the task requires. these aren't
missing micro-optimizations. they're design failures. the kind that also
produce subtle bugs, surprising interactions, security holes.

this is not a coincidence.

when you take performance seriously you end up with systems that are simpler,
more explicit, easier to reason about. the performance work and the
correctness work turn out to be the same work. you're removing the same
complexity either way.

---

there's a related thing people get wrong about developer experience.

they think devex means nice CLIs, pretty error messages, integrated tooling.
and sure, those help. but that's not the foundation.

the foundation is trust.

a system that behaves predictably, performs consistently, fails clearly — that
system is pleasant to use even if the tooling is minimal. a system that is
slow, inconsistent, fragile — that system feels broken no matter how polished
the surface is.

i've lost flow too many times to flaky tools. at some point you stop trusting
them. you start working around them. that's when devex dies — not when the
error message is ugly, but when you can't predict what will happen next.

---

runtimes are a special case of this.

in most software the code is a means to an end. you're building a product,
shipping features, experimenting. speed of iteration matters more than speed
of execution. fair enough.

but a runtime is different. the code IS the product. there's no layer above
it that compensates for bad behavior. latency, memory, startup time,
throughput — these aren't implementation details. they're the user experience
itself.

if you're building a runtime and you're not treating performance as
correctness, you're already shipping bugs. you just haven't named them yet.

---

i'm not saying all software needs to be fast.

but all software needs to be honest about its cost.

if performance degrades silently, the system is doing more than it claims.
holding more state than it admits. depending on behavior the user can't see.

that's a bug. treat it like one.

uncontrolled complexity always surfaces eventually. performance is usually
where it leaks first.
