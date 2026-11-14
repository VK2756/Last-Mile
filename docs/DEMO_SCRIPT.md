# 3-minute demo (also the video script). Replace [X] with REAL numbers from /results.

**0:00 Hook (15s)** "In the Camp Fire, the average age of the people who died was 72. Most didn't lack a warning. They lacked a way out. Last Mile is live evacuation dispatch for the people who can't drive away."
**0:15 Split screen (45s)** Click Run. "Same fire, same town, same 600 synthetic households. Left: alerts only. Right: Last Mile." Narrate households turning yellow then red on the left while the right dispatches vans and neighbors. Point at the scoreboard.
**1:00 Why this helper? (30s)** Click a red household on the right: "It doesn't just dispatch. It explains: wheelchair-capable van, [N] minutes away, arrives [M] minutes before the fire."
**1:30 The phone call (40s)** Open /call. Speak (or type) as a resident in Spanish. "No app, no registration. Gemini calls, understands, and the household appears on the map as needing help." Show the dot change on /live.
**2:10 The proof (30s)** /results: "We ran this [200] times with paired seeds. Vulnerable residents evacuated: [X]% vs [Y]%. Lift [Z] points, 95% CI [a, b]." Say out loud: "This is a simulation with synthetic people and stated assumptions."
**2:40 Stack + ask (20s)** "Gemini for triage, MongoDB Atlas geospatial matching, Tiger Data time-series, Vultr running the engine, Vercel for the front end. Counties and home-care agencies pay for this. Thank you."

Backup plan: if the network dies, `/live?mock=1&pitch=1`, and narrate over the recorded video.
