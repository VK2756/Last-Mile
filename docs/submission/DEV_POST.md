# Last Mile: Testing active evacuation dispatch in a synthetic wildfire

Tags: `hackumass`, `mlh`, `gemini`, `mongodb`, `ai` (check the publishing form's tag limit before posting).

Warnings can tell people to leave. They do not provide a vehicle, an accessible ride, or a safe route. [NIST's Camp Fire research](https://www.nist.gov/publications/case-study-camp-fire-notification-evacuation-traffic-and-temporary-refuge-areas-nettra) documents how rapidly changing fire and traffic conditions complicate evacuation. [CDC](https://www.cdc.gov/disability-emergency-preparedness/about/) notes that transportation and communication barriers can affect people with disabilities.

At HackUMass, we built **Last Mile**, a simulation prototype for testing active evacuation dispatch. Every resident and helper in the demo is synthetic. The fire and travel models are simplified. We compare the same seeded scenario under two policies: alerts only and active matching of at-risk households to capable helpers.

The web app streams frames from a TypeScript engine. Each assignment explains the helper choice and modeled timing. A call screen uses Gemini to turn a resident's words into structured needs such as wheelchair access or no vehicle; a deterministic parser keeps the demo running without an API key. MongoDB Atlas supports geospatial helper matching, while Tiger Data stores time-series risk and dispatch records. The engine runs on Vultr behind HTTPS.

The most important screen is `/results`. We use paired seeded runs and show confidence intervals. **Insert the actual run count, baseline and active-dispatch rates, lift, confidence interval, and assumptions after the evaluator is verified.** We will report a zero or negative lift honestly if that is what the model produces.

This is an experiment in decision-support design, not an emergency service or a real-world survival claim. Next, we would validate assumptions with emergency managers and disability advocates, check road data against observed closures, and design a privacy-preserving intake workflow.
