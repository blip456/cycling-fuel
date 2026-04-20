"use client";

import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useState } from "react";

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-foreground mb-3">
        <span>{emoji}</span>
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
    <div className="px-4 pt-12 pb-nav">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold text-foreground">How CycleFuel works</h1>
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
      <Section emoji="🔥" title="Carb targets per hour">
        <Card>
          <div className="divide-y divide-border">
            <Stat label="45 g/hr" value="Short rides &lt; 1 h" />
            <Stat label="60 g/hr" value="1–2 h, single carb source" />
            <Stat label="90 g/hr" value="2–4 h, mixed carb sources" />
            <Stat label="120 g/hr" value="4 h+, gut-trained athletes" />
          </div>
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
      <Section emoji="💧" title="Fluid recommendations">
        <Card>
          <div className="divide-y divide-border">
            <Stat label="Cold  (&lt; 15 °C)" value="400 ml / hr" />
            <Stat label="Moderate  (15–25 °C)" value="500 ml / hr" />
            <Stat label="Hot  (&gt; 25 °C)" value="650 ml / hr" />
          </div>
        </Card>
        <Accordion title="Where do these numbers come from?">
          <p>These are conservative, science-backed baselines for recreational cyclists. Actual sweat rate varies by body size, effort and humidity. In hot conditions CycleFuel flags a warning to remind you to top up your bottles fully.</p>
          <p className="mt-2">The <strong>target fluid</strong> shown in the summary is the recommended total for the ride. <strong>Total water</strong> is what you&apos;re actually bringing in bottles — if it falls short you&apos;ll see the gap highlighted.</p>
        </Accordion>
      </Section>

      {/* Sip logic */}
      <Section emoji="🍼" title="The 20-minute schedule">
        <Card>
          <p className="text-muted-foreground">CycleFuel schedules a drink stop every <span className="text-foreground font-medium">20 minutes</span> — a well-established endurance sports guideline. Each stop shows how many <span className="text-foreground font-medium">sips</span> to take.</p>
        </Card>
        <Accordion title="Why sips and not millilitres?">
          <p className="mb-2">A normal mouthful from a cycling bottle is approximately <strong>50 ml</strong>. Using sips avoids false precision — you can&apos;t measure 161 ml on the bike, but you can count to 3.</p>
          <p>The total sips are spread evenly across all intervals using cumulative rounding, so every drop in every bottle is accounted for. When a bottle runs out mid-interval you&apos;ll see a <span className="text-amber-600 font-medium">finish → next bottle</span> note.</p>
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
      <Section emoji="🍌" title="Solid food pacing">
        <Card>
          <div className="divide-y divide-border">
            <Stat label="Minimum warmup" value="30 min before first food" />
            <Stat label="Spacing between items" value="Every 50 min" />
            <Stat label="Feed window closes" value="20 min before finish" />
          </div>
        </Card>
        <Accordion title="Why wait 30 minutes before eating?">
          <p className="mb-2">During the first 30 minutes your body is ramping up — blood is redirecting to working muscles, heart rate is climbing and your digestive system is winding down. Eating solid food too early competes with that process and dramatically increases the risk of GI distress.</p>
          <p>For longer rides (&gt; ~5 hours), CycleFuel delays the first food item to up to 45 minutes, scaling with ride duration, to give your gut even more time to settle before the deep-effort phase begins.</p>
        </Accordion>
        <Accordion title="Why exactly 50 minutes between items?">
          <p className="mb-2">Solid food takes 45–60 minutes to leave the stomach. Eating again before the previous item has cleared means the two compete for gut space and blood flow — a common cause of cramping and nausea at race intensity.</p>
          <p>The 50-minute gap is the practical minimum that keeps the gut clear. It is a fixed rule, not a function of ride length or carb target.</p>
        </Accordion>
        <Accordion title="Why stop eating 20 minutes before the finish?">
          <p>Solid food needs to be in your gut long enough to be digested and absorbed. An item eaten in the final 20 minutes will still be sitting in your stomach at the finish line — it contributes nothing to your energy and adds unnecessary digestive load during the hardest part of the effort.</p>
        </Accordion>
        <Accordion title="How many food items will CycleFuel schedule?">
          <p className="mb-2">The app calculates the <strong>feed window</strong> — the time between the first food item and the last allowed checkpoint (20 min before finish). It then divides that window by 50 minutes:</p>
          <p className="font-mono bg-muted rounded px-2 py-1 text-xs mb-2">maxItems = floor(feedWindowMinutes ÷ 50)</p>
          <p>Items are scheduled at fixed 50-minute intervals starting from the first food checkpoint. If you&apos;ve selected more food items than fit in the window, the extras are dropped.</p>
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
      <Section emoji="🍝" title="Pre-ride carb loading">
        <Card>
          <p className="text-muted-foreground">For rides over 90 minutes, CycleFuel suggests eating <span className="text-foreground font-medium">~2 g of carbs per kg of body weight</span> in the 3–4 hours before the ride. Think oats, rice, banana or toast.</p>
        </Card>
        <Accordion title="Why 2 g/kg?">
          <p>This tops up muscle glycogen without leaving you too full to ride. The classic pre-race recommendation is 1–4 g/kg depending on how much time you have before the start. CycleFuel uses 2 g/kg as a practical middle ground. Set your body weight in Settings to get personalised suggestions.</p>
        </Accordion>
      </Section>

      {/* Bottle refills */}
      <Section emoji="♻️" title="Bottle refills">
        <Accordion title="How does CycleFuel handle long rides?">
          <p className="mb-2">If the weather-based fluid target exceeds what fits in your bottles, CycleFuel estimates how many refills you&apos;ll need and shows a warning. For example, needing 2.5 L with 2 L of bottles means roughly one refill.</p>
          <p>Plan for a feed zone, café stop, or carry an extra bottle for rides where the target fluid exceeds your bottle capacity.</p>
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
