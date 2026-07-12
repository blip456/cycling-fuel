"use client";

import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useState } from "react";

function Section({ emoji, title, id, children }: { emoji: string; title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-6 scroll-mt-16">
      <h2 className="flex items-center gap-2.5 font-display text-2xl font-semibold text-foreground mb-4">
        <span className="text-xl">{emoji}</span>
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-border px-4 py-3.5 text-sm text-foreground leading-relaxed">
      {children}
    </div>
  );
}

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-foreground"
      >
        {title}
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="px-5 pt-14 pb-nav">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-3xl font-semibold text-foreground">How CycleFuel <em className="text-primary">works</em></h1>
      </div>

      {/* How to use the app */}
      <Section emoji="🗺️" title="The planning flow">
        <Card>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li><span className="text-foreground font-medium">Ride details</span> — enter distance, average speed and ride date. CycleFuel fetches the weather forecast for your location.</li>
            <li><span className="text-foreground font-medium">Fueling setup</span> — pick your carb target per hour and add your bottles.</li>
            <li><span className="text-foreground font-medium">Products</span> — select which drink powders and solid foods you&apos;ll bring.</li>
            <li><span className="text-foreground font-medium">Your plan</span> — shows exactly what to mix tonight and a checkpoint-by-checkpoint schedule for the ride.</li>
          </ol>
        </Card>
        <Card>
          <p className="text-muted-foreground">You can <span className="text-foreground font-medium">edit any plan</span> after it&apos;s generated — swap drinks, change scoops, add or remove food items. Numbers update live.</p>
        </Card>
      </Section>

      {/* Carb targets */}
      <Section emoji="🔥" title="Carb targets per hour" id="carbs">
        <Card>
          <div className="divide-y divide-border">
            <Stat label="30 g/hr" value="Easy / leisure pace" />
            <Stat label="45 g/hr" value="Easy long or steady short rides" />
            <Stat label="60 g/hr" value="Steady 2–3 h, single carb source" />
            <Stat label="70–80 g/hr" value="Gut-training zone, mixed carbs" />
            <Stat label="90 g/hr" value="Hard or 3 h+ rides, mixed carbs" />
            <Stat label="120 g/hr" value="Racing, gut-trained athletes" />
          </div>
        </Card>
        <Card>
          <p className="text-muted-foreground">Recommendations scale with <span className="text-foreground font-medium">both duration and effort</span>. A 3-hour leisure ride burns far fewer carbs than a 3-hour race — pick your ride effort (Easy / Steady / Hard) in step 1 and CycleFuel adjusts the suggestion. The <span className="text-foreground font-medium">70 and 80 g/hr</span> steps sit in the gut-training zone so you can nudge intake up in small jumps rather than leaping 60 → 90. 120 g/hr is never auto-recommended; it&apos;s an opt-in for gut-trained racers.</p>
        </Card>
        <Accordion title="Why does the limit change?">
          <p className="mb-2">Your gut absorbs carbohydrates through transporters in the small intestine. Glucose uses the SGLT1 transporter — it saturates at around <strong>60 g/hr</strong>. Beyond that, extra glucose simply isn&apos;t absorbed and causes stomach distress.</p>
          <p>Fructose uses a separate GLUT5 transporter, so combining glucose + fructose lets you absorb up to <strong>90–120 g/hr</strong>. This is why high-carb sports drinks use a mix rather than glucose alone.</p>
        </Accordion>
        <Accordion title="What is the 2:1 and 1:1 ratio?">
          <p className="mb-2">These refer to the glucose:fructose ratio in a drink:</p>
          <ul className="list-disc list-inside space-y-1 mb-2">
            <li><strong>Single source</strong> — glucose only. Max ~60 g/hr.</li>
            <li><strong>2:1 ratio</strong> — 2 parts glucose, 1 part fructose. Ideal for 60–90 g/hr.</li>
            <li><strong>1:1 ratio</strong> — equal glucose and fructose. Supports up to 120 g/hr for gut-trained athletes.</li>
          </ul>
          <p>CycleFuel warns you if your carb target doesn&apos;t match your drink&apos;s ratio — for example, targeting 90 g/hr with a glucose-only drink.</p>
        </Accordion>
      </Section>

      {/* Fluid */}
      <Section emoji="💧" title="Fluid recommendations" id="fluid">
        <Card>
          <div className="divide-y divide-border">
            <Stat label="Cold  (&lt; 15 °C)" value="400 ml / hr" />
            <Stat label="Moderate  (15–25 °C)" value="500 ml / hr" />
            <Stat label="Hot  (&gt; 25 °C)" value="650 ml / hr" />
          </div>
        </Card>
        <Card>
          <p className="text-muted-foreground">These temperature baselines are a <span className="text-foreground font-medium">starting point</span> — real sweat rates run anywhere from 0.5 to over 2 L/hr depending on your body, effort and humidity. The honest approach: use the baseline, then drink to thirst and learn your own number. Measure it in <span className="text-foreground font-medium">Settings → Your Sweat Rate</span> and CycleFuel paces you to that instead.</p>
        </Card>
        <Accordion title="Where do these numbers come from?">
          <p>These are conservative baselines for recreational cyclists. Actual sweat rate varies by body size, effort and humidity. In hot conditions CycleFuel flags a warning to remind you to top up your bottles fully.</p>
          <p className="mt-2">The <strong>target fluid</strong> shown in the summary is the recommended total for the ride. <strong>Total water</strong> is what you&apos;re actually bringing in bottles — if it falls short you&apos;ll see the gap highlighted, and on rides longer than your bottles hold the schedule paces you to the full target and marks <strong>refill</strong> points.</p>
        </Accordion>
        <Accordion title="How do I measure my sweat rate?">
          <p className="mb-2">Weigh yourself (kg) right before and right after a ride on the same scale, wearing about the same, and note how much you drank. Then:</p>
          <p className="font-mono bg-muted rounded px-2 py-1 text-xs mb-2">sweat/hr = ((before − after) L + drunk L) ÷ hours</p>
          <p>Do it in <strong>Settings → Your Sweat Rate</strong> and CycleFuel saves the result and uses it to pace your drinking. Repeat on a hot day and a cool day — you&apos;ll see how much conditions change it.</p>
        </Accordion>
      </Section>

      {/* Electrolytes */}
      <Section emoji="🧂" title="Electrolytes &amp; sodium" id="sodium">
        <Card>
          <p className="text-muted-foreground">Sweat isn&apos;t just water — it carries <span className="text-foreground font-medium">sodium</span>, roughly 0.5–1.5 g per litre (more if you&apos;re a &quot;salty sweater&quot; with white crust on your kit). On long or hot rides, replacing only water can leave you flat, crampy, or — over many hours — dangerously dilute your blood sodium.</p>
        </Card>
        <Accordion title="Why does sodium matter?">
          <p className="mb-2">Two reasons. First, it keeps your blood sodium in a safe range on long efforts. Second, sodium actively <strong>helps you absorb both fluid and glucose</strong> — the SGLT1 glucose doorway is sodium-powered, so a little salt speeds everything through.</p>
          <p>CycleFuel estimates the sodium you&apos;ll lose (about 800 mg per litre of sweat) and adds up what your drinks and food replace. Set sodium on your products in Settings, and the plan flags long or hot rides where you&apos;re coming up short.</p>
        </Accordion>
        <Accordion title="How much should I take?">
          <p>Most riders do well around <strong>300–700 mg of sodium per litre of fluid</strong> on rides over ~2 hours or in the heat. Very salty sweaters or ultra-distance riders may want more. It&apos;s individual — start in that range and adjust based on how you feel and whether you cramp.</p>
        </Accordion>
      </Section>

      {/* Sip logic */}
      <Section emoji="🍼" title="The 20-minute schedule">
        <Card>
          <p className="text-muted-foreground">CycleFuel schedules a drink stop every <span className="text-foreground font-medium">20 minutes</span> — a well-established endurance sports guideline. Each stop shows how many <span className="text-foreground font-medium">sips</span> to take.</p>
        </Card>
        <Accordion title="Why sips and not millilitres?">
          <p className="mb-2">A normal mouthful from a cycling bottle is approximately <strong>50 ml</strong>. Using sips avoids false precision — you can&apos;t measure 161 ml on the bike, but you can count to 3.</p>
          <p>The sips are spread evenly across all intervals using cumulative rounding. When a bottle runs out mid-interval you&apos;ll see a <span className="text-amber-600 font-medium">finish → next bottle</span> note.</p>
        </Accordion>
        <Accordion title="What if I carry more fluid than I need?">
          <p className="mb-2">The schedule paces you to the <strong>weather-based fluid need</strong> (e.g. 500 ml/hr in moderate temps), not to whatever your bottles happen to hold. If you carry 1.5 L for a ride that needs 1 L, the schedule covers 1 L and the rest stays in your bottles as reserve.</p>
          <p>The carb totals reflect what you actually drink — if the schedule leaves mix in a bottle, those carbs aren&apos;t counted, and CycleFuel will suggest mixing stronger if that creates a shortfall.</p>
        </Accordion>
        <Accordion title="When does the schedule start?">
          <ul className="list-disc list-inside space-y-1">
            <li><strong>&lt; 1 hr</strong> — water only, sip as needed.</li>
            <li><strong>1–1.5 hr</strong> — first checkpoint at 30 min.</li>
            <li><strong>1.5–3 hr</strong> — first checkpoint at 15 min.</li>
            <li><strong>3 hr+</strong> — first checkpoint at 10 min.</li>
          </ul>
        </Accordion>
      </Section>

      {/* Solid food */}
      <Section emoji="🍌" title="Solid food pacing" id="food">
        <Card>
          <div className="divide-y divide-border">
            <Stat label="Typical warmup" value="~30 min before first food" />
            <Stat label="Spacing (bar / real food)" value="~45–50 min" />
            <Stat label="Spacing (gels / chews)" value="~25–30 min" />
            <Stat label="Feed window closes" value="20 min before finish" />
          </div>
        </Card>
        <Card>
          <p className="text-muted-foreground">These are practical <span className="text-foreground font-medium">rules of thumb, not hard physiology</span> — individual tolerance varies a lot. Treat them as sensible defaults, try what works for you, and log how your stomach felt so the plan can learn.</p>
        </Card>
        <Accordion title="Why ease into eating in the first ~30 minutes?">
          <p className="mb-2">Early in a ride your body is still ramping up — blood is shifting to working muscles and digestion takes a back seat. Many riders find a big solid item in the first half hour sits heavily, so CycleFuel holds the first solid item until then. It&apos;s a comfort guideline rather than a strict rule — drinks and gels are fine from the start.</p>
          <p>For longer rides (up to ~5 hours) the first solid item is nudged to as late as 45 minutes, scaling with ride duration.</p>
        </Accordion>
        <Accordion title="Why space solid items out — and why gels can go closer?">
          <p className="mb-2">A bar or real food takes roughly 45–60 minutes to clear the stomach. Stacking another on top before the first has moved on is a common cause of that heavy, sloshy feeling at intensity — so CycleFuel spaces bars and real food ~45–50 min apart.</p>
          <p>Gels and chews are mostly fast-absorbing carbohydrate and behave more like a drink, so they can be taken closer together (~25–30 min). Set each food&apos;s <strong>type</strong> in Settings and the schedule spaces it accordingly. It&apos;s a starting point — some guts handle more, some less.</p>
        </Accordion>
        <Accordion title="Why stop eating 20 minutes before the finish?">
          <p>Solid food needs to be in your gut long enough to be digested and absorbed. An item eaten in the final 20 minutes will still be sitting in your stomach at the finish line — it contributes nothing to your energy and adds unnecessary digestive load during the hardest part of the effort.</p>
        </Accordion>
        <Accordion title="How many food items will CycleFuel schedule?">
          <p className="mb-2">The app works out the <strong>feed window</strong> — from the first food checkpoint (30–45 min in) to the last one (20 min before finish) — then fills it just enough to cover the carbs your drinks don&apos;t. It places the first item at the window start and steps forward by each item&apos;s own spacing (a bar ~45–50 min, a gel ~25–30 min), stopping once the carb gap is covered or the window closes.</p>
          <p>If you&apos;ve selected more than fits, the extras stay in your pocket as backup — and a selection of gels fits more than the same number of bars.</p>
        </Accordion>
        <Accordion title="How is the carb split decided between drinks and food?">
          <p className="mb-2">CycleFuel fills carbs in this order:</p>
          <ol className="list-decimal list-inside space-y-1 mb-2">
            <li>Drinks are distributed across all scheduled sip checkpoints first — they deliver the bulk of your carbs reliably and without GI risk.</li>
            <li>Any remaining carb gap (target minus drink carbs) is filled by solid food items, up to the number that fit in the feed window.</li>
          </ol>
          <p>This order reflects best practice: liquids are easier to absorb under effort, so you maximise drink carbs before leaning on solid food.</p>
        </Accordion>
      </Section>

      {/* Pre-ride */}
      <Section emoji="🍝" title="Pre-ride carb loading" id="preride">
        <Card>
          <p className="text-muted-foreground">For rides over 90 minutes, CycleFuel suggests eating <span className="text-foreground font-medium">~2 g of carbs per kg of body weight</span> in the 3–4 hours before the ride. Think oats, rice, banana or toast.</p>
        </Card>
        <Accordion title="Why 2 g/kg?">
          <p>This tops up muscle glycogen without leaving you too full to ride. The classic pre-race recommendation is 1–4 g/kg depending on how much time you have before the start. CycleFuel uses 2 g/kg as a practical middle ground. Set your body weight in Settings to get personalised suggestions.</p>
        </Accordion>
      </Section>

      {/* Caffeine */}
      <Section emoji="☕" title="Caffeine" id="caffeine">
        <Card>
          <p className="text-muted-foreground">Caffeine is one of the best-evidenced endurance aids there is. Toggle <span className="text-foreground font-medium">Caffeine plan</span> on a ride and CycleFuel suggests a dose based on your body weight.</p>
        </Card>
        <Accordion title="How much and when?">
          <p className="mb-2">The evidence points to about <strong>3 mg per kg of body weight</strong> (≈200 mg for a 70 kg rider) taken <strong>45–60 minutes before</strong> the hard part of your ride. More isn&apos;t better — higher doses bring jitters and a racing heart without extra performance.</p>
          <p>On rides over 3 hours a smaller top-up in the final third can lift a fading effort. Keep your whole day under roughly 6 mg/kg, and remember caffeine is individual — try it in training first.</p>
        </Accordion>
      </Section>

      {/* Recovery */}
      <Section emoji="🥣" title="After the ride (recovery)" id="recovery">
        <Card>
          <p className="text-muted-foreground">For rides of 90 minutes or more, CycleFuel suggests refuelling within the first hour: about <span className="text-foreground font-medium">1.1 g/kg of carbs plus 0.3 g/kg of protein</span> to refill glycogen and start muscle repair.</p>
        </Card>
        <Accordion title="Why refuel so soon?">
          <p>Your muscles are most receptive to topping up glycogen in the hour or two after finishing, and a little protein kick-starts repair. It matters most when your next ride is soon; after an easy spin your normal meals cover it. A recovery shake, rice and chicken, or milk and a banana all work — set your weight in Settings for a personalised figure.</p>
        </Accordion>
      </Section>

      {/* Bottle refills */}
      <Section emoji="♻️" title="Bottle refills">
        <Accordion title="How does CycleFuel handle long rides?">
          <p className="mb-2">If the weather-based fluid target exceeds what fits in your bottles, CycleFuel estimates how many refills you&apos;ll need and shows a warning. For example, needing 2.5 L with 2 L of bottles means roughly one refill.</p>
          <p>Plan for a feed zone, café stop, or carry an extra bottle for rides where the target fluid exceeds your bottle capacity.</p>
        </Accordion>
      </Section>

      {/* Gut training */}
      <Section emoji="💪" title="Training your gut" id="gut-training">
        <Card>
          <p className="text-muted-foreground">Your ability to take on carbs is <span className="text-foreground font-medium">trainable</span>. The transporters that absorb carbohydrate, and your tolerance for eating while working hard, both adapt to practice. Nobody takes 90 g/hr comfortably on day one — they build up to it.</p>
        </Card>
        <Accordion title="How do I train it?">
          <p className="mb-2">Start at an intake that feels easy, then nudge it up gradually on training rides — never test something new on an important day. When you log a ride as feeling right (or wanting more) with no gut trouble, CycleFuel spots it and suggests trying the next step up, in small 10 g/hr jumps through the 60–90 range.</p>
          <p>If your stomach complains, back off a step and hold there a while. Progress, don&apos;t force — this is exactly the &quot;finding your limits&quot; process, made concrete.</p>
        </Accordion>
      </Section>

      {/* Feedback / learning */}
      <Section emoji="📝" title="Learning from your feedback">
        <Card>
          <p className="text-muted-foreground">After a ride, open the plan and log <span className="text-foreground font-medium">how it went</span> — were the carbs too much, just right, or too little? How was your stomach? Did the fluid last?</p>
        </Card>
        <Accordion title="How does CycleFuel use this?">
          <p className="mb-2">CycleFuel looks at your last 5 rides with feedback (preferring rides at the same effort level) and adjusts the carb suggestion for new plans:</p>
          <ul className="list-disc list-inside space-y-1 mb-2">
            <li>Marked carbs <strong>&quot;too much&quot;</strong> on 2+ rides → suggestion steps down one level.</li>
            <li>Marked <strong>&quot;too little&quot;</strong> on 2+ rides → suggestion steps up one level.</li>
            <li>A rate that felt <strong>&quot;just right&quot;</strong> recently → that rate is suggested directly.</li>
            <li>Repeated <strong>gut trouble</strong> → suggestions are capped at 60 g/hr until it settles.</li>
          </ul>
          <p>Fluid feedback works the same way: finish thirsty twice and the planner nudges you to carry an extra bottle. You can see a summary of what&apos;s been learned in Settings.</p>
        </Accordion>
      </Section>

      {/* Data */}
      <Section emoji="💾" title="Your data">
        <Card>
          <p className="text-muted-foreground">Everything is stored <span className="text-foreground font-medium">locally on your device</span> — no account, no server. Use <span className="text-foreground font-medium">Export JSON</span> in Settings to back up your drinks, foods and plans, and <span className="text-foreground font-medium">Import JSON</span> to restore them on a new device.</p>
        </Card>
      </Section>
    </div>
  );
}
