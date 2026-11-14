# Sources for real-world claims

Use only these for real-world facts in the pitch, video, Devpost and DEV post. Paraphrase. The product's outcome numbers
are **not** real-world facts: they come only from our Monte Carlo evaluator ([`NUMBERS.md`](NUMBERS.md)), with the
simulation assumptions displayed.

**Verification log:** every URL below was opened on Sat 14 Nov 2026 (~18:00 EST) and checked against the exact claim we
make. Quotes are short excerpts for checking, not for publication.

| # | source | claim we may make | verified | supporting text on the page |
|---|---|---|---|---|
| 1 | NIST, [A Case Study of the Camp Fire: NETTRA](https://www.nist.gov/publications/case-study-camp-fire-notification-evacuation-traffic-and-temporary-refuge-areas-nettra) (Maranghides et al., NIST TN 2252, 2023) | The 2018 Camp Fire triggered evacuation of about 40,000 people, with 85 deaths and more than 18,000 structures destroyed. | yes | abstract: "widespread evacuation of 40000 people", "85 fatalities and more than 18000 destroyed structures" |
| 1b | same | NIST identified 198 evacuation-assistance or rescue events involving at least 1,000 civilians, and fire caused road closures and burnovers of evacuating civilians. | yes | abstract: "198 specific evacuation assistance / rescue events ... at least 1000 civilians"; "road closures due to fire and debris ... burnover events" |
| 2 | NIST, [ESCAPE: WUI Fire Evacuation and Sheltering Considerations](https://www.nist.gov/programs-projects/wildland-urban-interface-wui-fire-data-collection-parcel-vulnerabilities/escape) | Fast-moving WUI fires can outrun emergency notifications and cut off evacuation routes before residents leave. Supports modelling changing routes and time to impact; it does **not** validate our simulated outcomes. | yes | "fires outrunning emergency notifications and cutting off egress routes before residents can leave" |
| 3 | CDC, [Emergency Preparedness and Disability Inclusion](https://www.cdc.gov/disability-emergency-preparedness/about/) | Evacuation plans and emergency communications may not meet the needs of people with disabilities; lack of accessible transportation and disrupted support systems create barriers to evacuating. | yes | "evacuation plans and emergency communications, may not meet the needs of people with disabilities"; "A lack of accessible transportation ... can cause or contribute to inaccessible environments" |
| 4 | Ready.gov (FEMA), [Older Adults](https://www.ready.gov/older-adults) | FEMA advises older adults to plan transportation if they need help evacuating, and to plan for medicines, medical supplies and assistive devices. | yes | "Plan for your transportation if you need help evacuating"; "Plan how you will have your assistive devices with you during an evacuation" |

## Changes in this pass

- **Replaced** the FEMA flyer PDF (`ready.gov/sites/default/files/2023-05/ready.gov_older-adults_flyer.pdf`) with the
  Ready.gov "Older Adults" page: the PDF link still resolves but serves a file download, so judges can't read it in the
  browser; the HTML page carries the same advice.
- **Added** claim 1b (assistance/rescue events) from the same NIST abstract.

## Claims we do NOT use (no primary source verified)

- The average age of Camp Fire victims (often quoted as 72).
- "People with disabilities are 2–4x more likely to die in disasters."
- "Most Camp Fire victims had adequate warning."
- Any market size, pricing, or "counties pay for this" claim.

If someone needs one of these, find a primary source, verify it, and add a row above first.
