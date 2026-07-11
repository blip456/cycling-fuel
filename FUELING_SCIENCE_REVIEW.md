# CycleFuel — Fueling Science Review & Improvement Proposals

*Written for an amateur cyclist who is still finding their personal limits and what works for them. No pro-peloton dogma — just the science, an honest validation of the app, and where it could serve you better.*

---

## TL;DR

The science baked into CycleFuel is **mostly accurate and, in places, better than most fueling apps** — it correctly scales carbs by *both* duration and intensity, and its glucose/fructose transporter model is sound. The standout feature for someone in your position is the **feedback learning loop**: it's exactly the right tool for "finding what works for me."

Three things hold it back for an amateur:

1. **One real bug:** on any ride where you'll refill bottles (long or hot rides), the on-bike drinking schedule under-doses your fluid — it only paces the volume of your *starting* bottles, not the full amount you need.
2. **A genuine scientific gap:** electrolytes / sodium are completely absent, even though they matter for hydration and cramping on exactly the long/hot rides where the app already warns you.
3. **A tone problem:** several practical rules of thumb (the 30-minute "warm-up before food," the rigid 50-minute food spacing) are presented as harder science than they actually are. For a curious beginner that can read as "there's one correct number," when the real skill you're building is *learning your own numbers*.

Everything below expands on these.

---

## Part 1 — The science, pitched at where you are

### Why you fuel at all

Your muscles run on a blend of fat and carbohydrate. The fitter and easier you ride, the more fat you burn; the harder you go, the more you lean on carbohydrate. The problem is storage: you carry a lot of fat but only a limited amount of carbohydrate — roughly **300–500 g of glycogen in muscle** plus **~80–100 g in the liver** (the liver's job is to keep your blood sugar up). At a steady-to-hard effort that's about **90–120 minutes** of fuel before you're scraping the bottom of the tank. That empty-tank feeling — legs fine one minute, hollow and shaky the next — is "bonking," and it's a blood-sugar and glycogen problem, not a willpower problem.

Eating carbohydrate *while* you ride does two things: it keeps your blood sugar stable, and it spares your limited glycogen so it lasts longer. That's the whole game. **For rides under ~75–90 minutes you don't strictly need to fuel** (you have enough on board) — which is why the app sensibly drops to "water only" under an hour.

### How much — and why the number climbs with duration

This is the framework the app uses, and it's the mainstream one (associated with the work of Asker Jeukendrup and echoed in ACSM guidance):

| Ride duration | Typical carb target | Notes |
|---|---|---|
| < 45–60 min | ~0 g/hr | Water is fine. |
| 1–2 hr | ~30 g/hr | A little goes a long way. |
| 2–3 hr | ~60 g/hr | The workhorse range for most amateurs. |
| 2.5 hr+ / hard | up to 90 g/hr | Needs mixed carbs (see below). |
| Racing / very long | 90–120 g/hr | Only with deliberate "gut training." |

The app is smarter than a plain duration table because it also asks **how hard** you're riding. A 3-hour café spin genuinely needs less than a 3-hour chaingang, and the app's "easy / steady / hard" selector reflects that. That's a legitimately good design choice and matches the science.

**For you specifically:** you almost certainly live in the **30–60 g/hr** world, occasionally 90 on a big day. You do *not* need 120 — that's a racing number that requires months of gut adaptation, and chasing it early just buys you a sour stomach.

### How absorption works — the transporter story (this is the interesting bit)

Here's the mechanism the app's warnings are built on, and it's worth understanding because it explains why "more carbs" isn't simply "better."

Carbohydrate doesn't get absorbed through your gut wall by magic — it goes through specific protein "doorways":

- **Glucose** (and maltodextrin, which is just chained glucose) rides through a transporter called **SGLT1**. That doorway has a maximum throughput of roughly **1 gram per minute ≈ 60 g/hr**. Push more glucose than that and it just sits in your gut, pulling water in with it — that's the sloshy, bloated, need-a-bathroom feeling.
- **Fructose** uses a *completely separate* doorway called **GLUT5**. Because it's a different door, it doesn't compete with glucose.

So the trick to getting more than ~60 g/hr in without wrecking your stomach is to use **both doorways at once** — a drink or gel that mixes glucose and fructose. That's what "**2:1**" and "**1:1**" mean on a product label: the ratio of glucose to fructose.

- **Single source (glucose only):** capped at ~60 g/hr. Fine for most amateur rides.
- **2:1 glucose:fructose:** the classic high-carb blend, good up to ~90 g/hr.
- **1:1 glucose:fructose:** favored at the very top end (~120 g/hr), because by then the glucose door is already maxed and it's *fructose* absorption that becomes the bottleneck, so you want relatively more of it.

The app states all of this correctly, and it warns you if your target doesn't match your drink (e.g. trying to hit 90 g/hr on a glucose-only mix). That warning is scientifically legitimate.

### Hydration — where the app is thinner

You lose fluid as sweat, and sweat rate varies enormously between people and conditions — anywhere from **0.5 to over 2 L per hour**. The app's temperature-based baseline (400 / 500 / 650 ml per hour for cold / moderate / hot) is a *reasonable conservative starting point*, but it can't know your personal sweat rate, your body size, the humidity, or how hard you're pushing. The honest guidance for an amateur is: **use the baseline as a start, then drink to thirst, and learn your own rate** (weigh yourself before and after a couple of rides — every kg lost ≈ 1 L of fluid you didn't replace).

**The bigger gap: sodium.** Sweat isn't just water — it carries sodium (roughly **0.5–1.5 g per litre**, more if you're a "salty sweater" with white crust on your kit). On long or hot rides, replacing only water and no sodium can leave you feeling flat, crampy, or — in extreme, rare cases over many hours — dangerously dilute your blood sodium (hyponatremia). Sodium also *helps* you absorb both fluid and glucose (the SGLT1 glucose doorway is sodium-powered). **The app currently says nothing about electrolytes at all**, which is a notable omission given it already flags hot-weather rides.

### Before the ride

Topping up the tank beforehand means you start full. The app suggests **~2 g of carbohydrate per kg of body weight, 3–4 hours before** a ride over 90 minutes (so ~140 g for a 70 kg rider — oats, rice, banana, toast). That's a sensible middle-of-the-road number; the research range is 1–4 g/kg depending on how much time you have. Good, practical advice.

### "Gut training" — the concept that matters most for you

Your gut is trainable. The transporters and your tolerance for eating-while-working both **adapt to practice**. Riders who comfortably take 90+ g/hr got there by gradually eating more on training rides over weeks, not by flipping a switch on race day. This is *the* concept for someone "finding their limits": your limit today isn't fixed, and the way you raise it is deliberate, logged practice — start at a rate that feels easy, nudge it up when it feels good, back off when your stomach complains.

This is exactly what CycleFuel's feedback loop *could* be coaching you through — and mostly the reason this app is a good fit for you.

---

## Part 2 — Validating the app through your lens

### What it gets right

- **Carb targets scale by duration *and* intensity.** More nuanced than most apps and scientifically defensible. `recommendedCarbsPerHour()` never auto-suggests 120 g/hr — correct, because that's an opt-in racing number.
- **The transporter model and ratio warnings are accurate.** The help text on SGLT1 / GLUT5 / glucose:fructose is genuinely good science education.
- **The feedback learning loop is the best feature for you.** Log "too much / just right / too little" and gut comfort after a ride, and it nudges future suggestions — and importantly it's **conservative**: it moves at most one step at a time and *caps you at 60 g/hr if you report repeated gut trouble*. That's the right, safe behavior for someone still calibrating.
- **It's honest about what you'll actually drink.** The "total carbs" it reports is what the schedule *delivers*, not a fantasy target, and it correctly assumes bottle refills are water (not magically re-mixed) — a subtle bug that was clearly fixed at some point.
- **"Sips, not millilitres"** (1 sip ≈ 50 ml) is a smart, practical touch — you can't measure 161 ml on a bike, but you can count to three.
- **It works offline as a PWA and keeps your data local.** Right call for something you'll open at the roadside.

### What's off

**1. Real bug — the drinking schedule under-doses fluid on refill rides.**
In `fuel-calculator.ts`, the on-bike sip schedule paces you to `Math.min(totalFluidMl, totalBottleMl)` — i.e. it caps the total sips at *what your starting bottles hold*, not what the ride needs. Concretely: a 3-hour ride with one 500 ml bottle has a fluid target of ~1.5 L, but the schedule only ever tells you to drink **10 sips (500 ml) across the whole 3 hours** — about a third of what you need. The summary card *does* correctly flag the shortfall and the need for refills, so the headline numbers are honest, but the **schedule you'd actually follow on the bike is wrong** precisely on the long/hot rides where hydration matters most. A beginner trusting the schedule literally would under-drink. (The code comment even says it means to "pace to the weather-based need" — the code does the opposite.)

**2. Scientific gap — no electrolytes / sodium anywhere.**
Covered above. This is the most valuable *missing* piece of science, and it's conspicuous because the app already knows when a ride is hot and long.

**3. Over-stated certainty on the solid-food rules.**
The 30-minute "warm-up before you're allowed to eat" and the rigid **50-minute spacing between food items** are presented as firm physiology ("solid food takes 45–60 min to leave the stomach; eat sooner and they compete"). In reality gastric emptying is continuous and depends on the food, the amount, and your intensity — plenty of riders eat more often than every 50 minutes without trouble, and there's little evidence you *must* wait 30 minutes before your first bite. These are fine *defaults*, but stated this confidently they can mislead a curious beginner into thinking there's one correct cadence, when the actual skill is finding your own.

**4. The carb steps are coarse (30 / 45 / 60 / 90 / 120).**
The jump from **60 to 90 g/hr is a 50% increase** with nothing in between. For someone deliberately nudging their limit upward, that's a big leap — 70 and 80 are exactly the increments you'd want while training your gut. The feedback loop can only step between these fixed values, so it can't fine-tune.

**5. All "food" is treated identically.**
A banana, an energy bar, and a gel are modeled the same way — a lump of carbs on the 50-minute schedule. But a gel empties from your stomach far faster than a bar, and behaves more like a drink. Lumping them together limits how useful the schedule can be.

**6. Minor:**
- Weather only exists for rides within the forecast horizon (~16 days) and the date picker blocks past dates, so a plan made far ahead silently has no weather.
- Bottle sizes are fixed to 500 / 750 / 1000 ml — no soft-flask or hydration-pack sizes.
- No caffeine guidance (a legitimate, well-evidenced endurance aid) — reasonable to leave out, but worth a mention.

---

## Part 3 — Proposed improvements, prioritized

Ordered by value **to an amateur who's finding their limits**, not by engineering effort.

### High value

1. **Fix the fluid schedule so it paces the full target and shows refills as events.** Distribute sips against `totalFluidMl` (the ride's actual need), and when that exceeds bottle capacity, insert explicit "refill bottle" rows in the schedule. This turns the long-ride plan from misleading into trustworthy.

2. **Add sodium / electrolytes as a first-class concept.** Even a light touch: let a drink product carry a "mg sodium per serving," show an estimated sodium target on hot/long rides (a simple sweat-rate × duration × ~0.7 g/L model), and add a one-card explainer. This is the single biggest science upgrade.

3. **Reframe the feedback loop as an explicit "gut training" progression.** You already store per-ride carb/gut feedback. Surface it as a trend: *"You've handled 60 g/hr comfortably on your last 3 steady rides — want to try 70 next time?"* That directly serves "finding my limits" and turns a passive tuner into a coach. (Pairs naturally with finer carb steps below.)

4. **Finer carb granularity (add 70 and 80 g/hr, or make it a slider).** Lets both you and the feedback loop nudge intake in realistic increments instead of leaping 60 → 90.

### Medium value

5. **Soften the "hard rule" language into "typical / adjustable" guidance, and let advanced users relax the 50-minute food spacing.** Keep the good defaults, but frame them as starting points and note that individual tolerance varies. More honest, and more in the spirit of self-discovery. A short "this is a rule of thumb, log what works for you" line goes a long way.

6. **Distinguish food types (gel / chew / bar / real food).** Tag each food with a type; treat gels like fast fuel (closer to drinks, shorter spacing) and bars/real food with the longer gastric window. Makes the schedule realistic and teaches the difference.

7. **A tiny sweat-rate helper.** A one-screen "weigh before, weigh after, enter both" tool that estimates your personal ml/hr and starts personalizing hydration the same way the carb loop personalizes fuel. This is the hydration equivalent of the feedback loop and squarely on-theme.

### Nice to have

8. **Post-ride recovery note** (~1–1.2 g/kg carbs + protein in the first hour) — closes the loop on a full day.
9. **Caffeine as an optional, evidence-based toggle** with sane guidance (~3 mg/kg, timed).
10. **A "why this number?" link on every recommendation** into the (already good) help content — reinforces the learning goal for a curious rider.
11. **Broaden bottle/vessel options** (soft flasks, hydration packs) and allow non-forecast weather entry (manual temperature) for far-out or indoor plans.

---

## Bottom line

For where you are — amateur, experimenting, learning your own body — **CycleFuel is a genuinely good fit and its core science is trustworthy.** Use it, but with two caveats until they're addressed: on long or hot rides **don't trust the drinking schedule's volume** (drink to thirst and refill), and **add your own electrolytes** because the app won't remind you. And treat every number it gives you as a *starting hypothesis to test and log* — which, conveniently, is exactly what the feedback feature is built to help you do.
