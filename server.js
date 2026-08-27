const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

// Content selection below (Lead/Support/Proof/internal notes) is fully
// deterministic and does NOT use this key. It's kept here, and callAnthropic()
// below stays ready to call, for the planned generative-content feature —
// e.g. drafting a cohesive customer email from a set of verbatim selections.
// Retrieval must never depend on this; only a genuinely generative step should.
if (!API_KEY) {
  console.warn('WARNING: ANTHROPIC_API_KEY not set. Content selection will work fine without it, but any generative feature added later will fail until it is set.');
}

const HTML = fs.readFileSync(path.join(__dirname, 'roche-app.html'), 'utf8');

// Registry of source documents. Every library entry's "doc" field must be a
// key here. Adding a new source document means: drop the PDF in this folder,
// add an entry here, and tag new library entries with its key.
const DOCS = {
  crr: { file: 'reference-deck.pdf', title: 'Global Customer Relationship Study 2025', prefix: 'CRR' },
  oid: { file: 'oneroche-id-messaging-framework.pdf', title: 'OneRoche ID Messaging Framework', prefix: 'OID' }
};

// Reference database: verbatim content from the Global Customer Relationship
// Study 2025 deck only. Every "text" field must be reproduced exactly as
// written in the source deck — no paraphrasing, no rewriting.
//
// Definitions:
// - lead:    highest-level statement relevant to the query. Selected first,
//            directly against the requested buying influence / customer need.
// - support: detail that substantiates a lead message. Selected via
//            relatedLead — i.e. only surfaced once a lead has been chosen,
//            never independently tag-matched on its own.
// - proof:   case studies / stories / statistics related to a lead + its
//            support, selected the same way via relatedLead. Any statement
//            containing a statistic lands here, never in lead or support —
//            numbers are evidence, not the top-line claim itself.
//
// NOTE: this library previously carried an "internal" vs "external" audience
// tag per entry, attempting to auto-classify which statements were safe for
// customer-facing use. That classification proved too unreliable to trust
// and has been removed for now — curation of what belongs in this library at
// all should happen when content is added, not via an in-app heuristic.
const MESSAGE_LIBRARY = {
  "CRR-06a": { type: "lead", doc: "crr", page: 6, text: "Customer relationships matter because they drive loyalty and real commercial impact", source: "Slide 6", buyingInfluence: ["clinical","financial"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-06e": { type: "proof", doc: "crr", page: 6, relatedLead: ["CRR-06a"], text: "Promoter accounts renew 90% more often than Detractors", source: "Slide 6", buyingInfluence: ["financial"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-06f": { type: "proof", doc: "crr", page: 6, relatedLead: ["CRR-06a"], text: "Promoter accounts have a 53% higher win rate than Detractors", source: "Slide 6", buyingInfluence: ["financial"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-06g": { type: "proof", doc: "crr", page: 6, relatedLead: ["CRR-06a"], text: "Promoter accounts generate ~58% of the revenue", source: "Slide 6", buyingInfluence: ["financial"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-07a": { type: "lead", doc: "crr", page: 7, text: "Strong relationships, with opportunities to strengthen operations, communication, and future growth", source: "Slide 7", buyingInfluence: ["operational","financial"], customerChallenge: ["operational-excellence-uptime","communication-transparency"] },
  "CRR-07d": { type: "proof", doc: "crr", page: 7, relatedLead: ["CRR-07a"], text: "88% Overall satisfaction with Roche", source: "Slide 7", buyingInfluence: ["clinical","operational","financial"], customerChallenge: ["product-technical"] },
  "CRR-07e": { type: "proof", doc: "crr", page: 7, relatedLead: ["CRR-07a","CRR-17a"], text: "89% Believe Roche is a true partner", source: "Slide 7", buyingInfluence: ["clinical","operational","financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-09a": { type: "lead", doc: "crr", page: 9, text: "Customers praise our people and products but highlight areas to improve", source: "Slide 9", buyingInfluence: ["clinical"], customerChallenge: ["product-technical"] },
  "CRR-09b": { type: "proof", doc: "crr", page: 9, relatedLead: ["CRR-09a"], text: "60% of our customers would recommend Roche; only 8% would not", source: "Slide 9", buyingInfluence: ["clinical","financial"], customerChallenge: ["product-technical"] },
  "CRR-11a": { type: "lead", doc: "crr", page: 11, text: "Customers link transparent and proactive communication to their ability to plan ahead, innovate and grow", source: "Slide 11", buyingInfluence: ["operational","financial"], customerChallenge: ["communication-transparency"] },
  "CRR-12a": { type: "lead", doc: "crr", page: 12, text: "Customers want digital solutions but integration and staff readiness block adoption", source: "Slide 12", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization","barriers-to-digital-adoption"] },
  "CRR-12b": { type: "proof", doc: "crr", page: 12, relatedLead: ["CRR-12a"], text: "59% of customers want to explore optimising their lab workflows, and while 44% are interested in digital solutions to drive efficiency and growth they face major barriers", source: "Slide 12", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization","barriers-to-digital-adoption"] },
  "CRR-14a": { type: "lead", doc: "crr", page: 14, text: "Large labs are less likely to recommend Roche\u2026", source: "Slide 14", buyingInfluence: ["financial"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-15a": { type: "lead", doc: "crr", page: 15, text: "\u2026because operational inconsistencies can often turn into major failures", source: "Slide 15", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","operational-excellence-uptime"] },
  "CRR-16a": { type: "lead", doc: "crr", page: 16, text: "Executives are less likely to recommend Roche\u2026", source: "Slide 16", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-17a": { type: "lead", doc: "crr", page: 17, text: "\u2026and they wish for more engagement and strategic partnership", source: "Slide 17", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-19": { type: "lead", doc: "crr", page: 19, text: "Overall experience along the customer journey is high with opportunities to improve", source: "Slide 19", buyingInfluence: ["operational","clinical"], customerChallenge: ["operational-excellence-uptime"] },
  "CRR-34a": { type: "proof", doc: "crr", page: 34, relatedLead: ["CRR-07a","CRR-17a"], text: "Foundation of trust: Customers rate Roche highly for reliable products and professional staff. With an NPS of +49 and 89% seeing us as a true partner, trust in our people and solutions is our biggest strength", source: "Slide 34", buyingInfluence: ["clinical","financial"], customerChallenge: ["strategic-partnership","product-technical"] },
  "CRR-34b": { type: "lead", doc: "crr", page: 34, text: "Win the C-Suite: While quality is recognized, many executives perceive Roche as transactional. To win the C-Suite, we must position ourselves as a strategic partner, enabling efficiency and access to innovation", source: "Slide 34", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership","access-to-innovation"] },
  "CRR-34c": { type: "lead", doc: "crr", page: 34, text: "Enable future growth: Labs see strong potential in digital and AI-driven solutions, but face barriers with IT integration, budgets, and staff readiness. Roche can unlock adoption by reducing complexity, co-developing solutions, and supporting change management", source: "Slide 34", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization","barriers-to-digital-adoption"] },
  "CRR-34d": { type: "lead", doc: "crr", page: 34, text: "Close the communication gap: Proactive, transparent updates on orders, service, and innovation are critical. Customers want early insights to better manage operations and plan long-term", source: "Slide 34", buyingInfluence: ["operational"], customerChallenge: ["communication-transparency"] },

  "CRR-06b": { type: "support", doc: "crr", page: 6, relatedLead: ["CRR-06a"], text: "Over the 18 years of collaboration, I have been satisfied with the quality, durability of the equipment and reliability of Roche products, but the people I have interacted with are the main reason I recommend Roche", source: "Slide 6, customer quote", buyingInfluence: ["clinical"], customerChallenge: ["strategic-partnership","product-technical"] },
  "CRR-06c": { type: "support", doc: "crr", page: 6, relatedLead: ["CRR-06a"], text: "I did not buy from an equipment seller - I built a partnership with Roche - My Roche contacts are reliable people I trust", source: "Slide 6, customer quote", buyingInfluence: ["clinical","financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-06d": { type: "support", doc: "crr", page: 6, relatedLead: ["CRR-06a"], text: "The relationship with Roche Diagnostics goes beyond the one included in the agreements. We are partners with whom we have been working together for many years.", source: "Slide 6, customer quote", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership"] },
  "CRR-07b": { type: "support", doc: "crr", page: 7, relatedLead: ["CRR-07a"], text: "Reliable products and accurate results provide a strong foundation of trust. Local teams' responsiveness and expertise strengthen partnerships.", source: "Slide 7", buyingInfluence: ["clinical","operational"], customerChallenge: ["product-technical","strategic-partnership"] },
  "CRR-07c": { type: "support", doc: "crr", page: 7, relatedLead: ["CRR-07a","CRR-34c"], text: "Facing growing pressures, labs seek simpler, automated, and digital solutions and expect Roche to act as the partner for enabling future growth.", source: "Slide 7", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization"] },
  "CRR-11b": { type: "support", doc: "crr", page: 11, relatedLead: ["CRR-11a"], text: "If the laboratory isn't aware of alternative solutions to work faster, it doesn't have the opportunity to fight to acquire them.", source: "Slide 11, customer quote", buyingInfluence: ["operational"], customerChallenge: ["communication-transparency","access-to-innovation"] },
  "CRR-12c": { type: "support", doc: "crr", page: 12, relatedLead: ["CRR-12a"], text: "The biggest barriers are system integration, staff adaptation. Despite these, we're committed to advancing digital solutions because of their long-term value", source: "Slide 12, customer quote", buyingInfluence: ["operational"], customerChallenge: ["barriers-to-digital-adoption","managing-staff-shortages"] },
  "CRR-14b": { type: "support", doc: "crr", page: 14, relatedLead: ["CRR-14a"], text: "Main Priority: Cost-effective solutions and expanding test menu while adopting new right-sized solutions.", source: "Slide 14, Small labs", buyingInfluence: ["financial"], customerChallenge: ["cost-effective-right-sized-solutions"] },
  "CRR-14c": { type: "support", doc: "crr", page: 14, relatedLead: ["CRR-14a"], text: "Main Priority: Drive automation and efficiency to manage growth with limited staff.", source: "Slide 14, Medium labs", buyingInfluence: ["operational"], customerChallenge: ["automation-digitalization","managing-staff-shortages"] },
  "CRR-14d": { type: "support", doc: "crr", page: 14, relatedLead: ["CRR-14a"], text: "Main Priority: Standardize and digitalize (AI, DP, predictive analytics) for efficiency at scale.", source: "Slide 14, Large labs", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization"] },
  "CRR-14e": { type: "support", doc: "crr", page: 14, relatedLead: ["CRR-14a","CRR-15a"], text: "Key Pain Point: Extended downtime caused by delayed parts and service staff shortages", source: "Slide 14, Large labs", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","managing-staff-shortages"] },
  "CRR-15b": { type: "support", doc: "crr", page: 15, relatedLead: ["CRR-15a"], text: "Address operational frictions: Support labs with more predictive service, faster access to parts, and after-hours expertise to minimize disruptions.", source: "Slide 15", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","operational-excellence-uptime"] },
  "CRR-15c": { type: "support", doc: "crr", page: 15, relatedLead: ["CRR-15a","CRR-34d"], text: "Enhance transparency: Provide early visibility into reagent supply issues and delays so labs can plan workflows and avoid last-minute crisis.", source: "Slide 15", buyingInfluence: ["operational"], customerChallenge: ["communication-transparency","reagent-waste-packaging"] },
  "CRR-16b": { type: "support", doc: "crr", page: 16, relatedLead: ["CRR-16a"], text: "Key Pain Point: High costs, slow processes, and perceived loss of strategic partnership", source: "Slide 16, Executives", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership","cost-effective-right-sized-solutions"] },
  "CRR-16c": { type: "support", doc: "crr", page: 16, relatedLead: ["CRR-16a","CRR-34c"], text: "Main Priorities: Drive efficiency and growth through digitalization, automation, and AI.", source: "Slide 16, Executives", buyingInfluence: ["financial"], customerChallenge: ["automation-digitalization"] },
  "CRR-17b": { type: "support", doc: "crr", page: 17, relatedLead: ["CRR-17a"], text: "Efficiency & Scalability: Help them manage growth and control costs with automation solutions, workflow consulting, and inventory tools to improve TAT", source: "Slide 17", buyingInfluence: ["financial","operational"], customerChallenge: ["automation-digitalization","cost-effective-right-sized-solutions"] },
  "CRR-17c": { type: "support", doc: "crr", page: 17, relatedLead: ["CRR-17a","CRR-34b"], text: "Access to Innovation: Enable them to stay competitive with advanced tech, digital pathology, AI-driven workflows, and expanded menus.", source: "Slide 17", buyingInfluence: ["financial"], customerChallenge: ["access-to-innovation"] },
  "CRR-17d": { type: "support", doc: "crr", page: 17, relatedLead: ["CRR-17a"], text: "Strategic & Flexible Partnership: Strengthen partnership with transparent innovation pipeline, faster contracting, flexible commercial models and co-development opportunities", source: "Slide 17", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership","commercial-procurement-flexibility"] },
  "CRR-20": { type: "support", doc: "crr", page: 20, relatedLead: ["CRR-11a","CRR-34d"], text: "This is precisely a difficulty because we lack communication. No proactive communication, no information on new products, no dedicated sales representative. It's difficult to have a contact person when you have a request for information or a price", source: "Slide 20, customer quote", buyingInfluence: ["operational"], customerChallenge: ["communication-transparency"] },
  "CRR-21": { type: "support", doc: "crr", page: 21, relatedLead: ["CRR-17a","CRR-34b"], text: "Enhancing commercial and contractual flexibility. Customers feel the procurement process is often inflexible, with rigid pricing. This lack of flexibility makes it difficult to align with their internal processes and budgetary constraints.", source: "Slide 21", buyingInfluence: ["financial"], customerChallenge: ["commercial-procurement-flexibility"] },
  "CRR-22": { type: "support", doc: "crr", page: 22, relatedLead: ["CRR-19"], text: "Addressing space and infrastructure challenges early. Labs frequently struggle with limited physical space for large equipment, a challenge often not addressed during pre-installation inspections. Delays are also caused by issues with a lab's own IT department", source: "Slide 22", buyingInfluence: ["operational"], customerChallenge: ["infrastructure-space-constraints"] },
  "CRR-23": { type: "support", doc: "crr", page: 23, relatedLead: ["CRR-19"], text: "Expanding training frequency and accessibility. Time constraints in 24/7 labs make it difficult to train all staff; customers ask for more refresher sessions and accessible online options.", source: "Slide 23", buyingInfluence: ["operational"], customerChallenge: ["training-expertise","managing-staff-shortages"] },
  "CRR-24": { type: "support", doc: "crr", page: 24, relatedLead: ["CRR-09a","CRR-19"], text: "Making product offerings more flexible and cost-effective. High costs and large reagent pack sizes create waste and financial pressure, especially in lower-volume labs.", source: "Slide 24", buyingInfluence: ["financial"], customerChallenge: ["cost-effective-right-sized-solutions","reagent-waste-packaging"] },
  "CRR-25": { type: "support", doc: "crr", page: 25, relatedLead: ["CRR-15a","CRR-19"], text: "Improving resolution consistency. While many issues are fixed quickly, others are delayed by spare part shortages, repeat visits, or hotline procedures that feel unnecessary for experienced staff.", source: "Slide 25", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability"] },
  "CRR-26": { type: "support", doc: "crr", page: 26, relatedLead: ["CRR-15a","CRR-19"], text: "Improving delivery reliability and transparency: Despite many positive experiences, some customers report delays, backorders, and partial shipments that disrupt operations. They ask for earlier alerts on shortages and clearer, more reliable ETAs.", source: "Slide 26", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","communication-transparency"] },
  "CRR-27a": { type: "support", doc: "crr", page: 27, relatedLead: ["CRR-17a","CRR-19"], text: "Empowering representatives to act independently: Customers believe their representatives are personally capable, but are often restricted by rigid processes and internal hierarchies that slow decision-making.", source: "Slide 27", buyingInfluence: ["financial","operational"], customerChallenge: ["strategic-partnership"] },
  "CRR-27b": { type: "support", doc: "crr", page: 27, relatedLead: ["CRR-17a","CRR-19"], text: "Your front line staff are GREAT... The problem is Roche does not empower them to make decisions", source: "Slide 27, customer quote", buyingInfluence: ["operational"], customerChallenge: ["strategic-partnership"] },

  "CRR-29a": { type: "proof", doc: "crr", page: 29, relatedLead: ["CRR-34c","CRR-34d"], text: "How China is using the CRR to shape their 2026 strategy", source: "Slide 29, case study" },
  "CRR-29b": { type: "proof", doc: "crr", page: 29, relatedLead: ["CRR-34c","CRR-34d"], text: "289 responses, 97% response rate \u2014 among the highest globally", source: "Slide 29, case study" },
  "CRR-29c": { type: "proof", doc: "crr", page: 29, relatedLead: ["CRR-07a","CRR-34d"], text: "Enhancing the TOP account experience through CRR helps better secure China's business", source: "Slide 29, quote \u2014 Carolin Wang, Service Strategy & Transformation, China" },
  "CRR-31a": { type: "proof", doc: "crr", page: 31, relatedLead: ["CRR-34d","CRR-17a"], text: "How Brazil is using CRR to drive action", source: "Slide 31, case study" },
  "CRR-31b": { type: "proof", doc: "crr", page: 31, relatedLead: ["CRR-34d"], text: "Brazil conducted in-depth CRR interviews with strategic accounts to assess relationships and capture key feedback.", source: "Slide 31, case study" },
  "CRR-31c": { type: "proof", doc: "crr", page: 31, relatedLead: ["CRR-34c"], text: "They identified systemic challenges and defined high-level initiatives together with cross-functional leadership to drive improvements.", source: "Slide 31, case study" },
  "CRR-31d": { type: "proof", doc: "crr", page: 31, relatedLead: ["CRR-17a","CRR-34b"], text: "Brazil developed account reports, collaborated with account teams to prioritize actions, and formalized objectives, impact, owners, and timelines.", source: "Slide 31, case study" },
  "CRR-31e": { type: "proof", doc: "crr", page: 31, relatedLead: ["CRR-34d","CRR-17a"], text: "Finally, they shared findings and action plans with customers and validated next steps, which reinforced transparency and strengthened partnerships.", source: "Slide 31, case study" },

  // --- OneRoche ID Messaging Framework (MC-12149), a finished, structured
  // customer-facing messaging framework — not research analysis. Six major
  // themes (Trust & Experience, Partnership & Support, Comprehensive Value,
  // Patient-centric, Solutions for all settings, Rapid Responsiveness), each
  // with sub-themes. Sub-theme summaries are leads; the full body-copy
  // paragraphs under each sub-theme are support/proof, linked via relatedLead.
  "OID-04a": { type: "lead", doc: "oid", page: 4, text: "For c-suite and key decision-makers seeking to unlock new market opportunities, maximise their efficiency and ultimately improve patient outcomes.", source: "Positioning statement \u2014 For / Who", buyingInfluence: ["financial","operational"], customerChallenge: ["operational-excellence-uptime"] },
  "OID-04b": { type: "lead", doc: "oid", page: 4, text: "Most comprehensive, reliable and trusted ID solution partner of choice now and for the future", source: "Positioning statement \u2014 OneRoche ID is the", buyingInfluence: ["clinical","financial"], customerChallenge: ["product-technical","strategic-partnership"] },
  "OID-04c": { type: "lead", doc: "oid", page: 4, text: "Multiple players in the ID market with a myriad of complex, fragmented and inconsistent solutions", source: "Positioning statement \u2014 Versus", buyingInfluence: ["operational"], customerChallenge: ["operational-excellence-uptime"] },
  "OID-04d": { type: "lead", doc: "oid", page: 4, text: "Builds long-term, collaborative partnerships and is committed to continuous scientific innovation, with comprehensive, competitive and unique ID solutions to meet the needs of customers, partners and patients navigating the complex ID landscape", source: "Positioning statement \u2014 That", buyingInfluence: ["clinical","financial"], customerChallenge: ["strategic-partnership","access-to-innovation"] },
  "OID-04e": { type: "lead", doc: "oid", page: 4, text: "We improve patient lives: We are driven by a patient-centric mindset; focusing on the comprehensive portfolio and diagnostic innovations that strive to maximize medical value and meets the needs of those affected by diseases with the greatest global impact; helping to address public health inequalities across the entire patient journey.", source: "Positioning statement \u2014 Because (1)", buyingInfluence: ["clinical"], customerChallenge: ["product-technical"] },
  "OID-04f": { type: "lead", doc: "oid", page: 4, text: "We optimise and simplify: From the lab to point of care, we boost efficiency in centralised and decentralised settings, providing a holistic ID portfolio across throughput levels. Our integrated solutions can consolidate ID testing with our cutting-edge automation and modularity offering the flexibility and scalability to maximise capabilities, where needed, today and in the future.", source: "Positioning statement \u2014 Because (2)", buyingInfluence: ["operational"], customerChallenge: ["automation-digitalization"] },
  "OID-04g": { type: "lead", doc: "oid", page: 4, text: "We help customers get ahead: With integrity and innovation at our core, we strive to be the partner of choice, consulting with partners to help them optimise, prepare for future pandemics, and get ahead so they can compete and simplify complexities in the ever-changing ID landscape", source: "Positioning statement \u2014 Because (3)", buyingInfluence: ["operational","financial"], customerChallenge: ["strategic-partnership"] },
  "OID-04h": { type: "lead", doc: "oid", page: 4, text: "Customers are enabled to provide for the people who count on them; driving better public health outcomes at lower cost to health systems and society, improving patients\u2019 quality of life, and helping in the fight against ID globally", source: "Positioning statement \u2014 So that", buyingInfluence: ["financial","clinical"], customerChallenge: ["cost-effective-right-sized-solutions"] },
  "OID-05": { type: "lead", doc: "oid", page: 5, text: "OneRoche ID is the trusted and reliable partner of choice for c-suite and key decision-makers in diagnostic testing that is committed to continuous innovation and holistic ID solutions that benefit all patients and customers.\n\n[Because] Our comprehensive portfolio has the flexibility to meet each partner's needs; strives to maximise medical value, improving efficiency and unlocking new opportunities so that they can continue to improve public health and the lives of patients in the fight for eradicating infectious diseases globally.", source: "Value proposition", buyingInfluence: ["clinical","financial","operational"], customerChallenge: ["strategic-partnership","product-technical"] },
  "OID-06": { type: "lead", doc: "oid", page: 6, text: "The Roche infectious disease comprehensive portfolio unlocks new opportunities with built in flexibility to:\n\u25cf meet each partner's needs;\n\u25cf strive to maximize medical value;\n\u25cf and improve efficiency,\nso that together we can continue to improve public health and the lives of patients everywhere.\nTogether, we can fight for eradicating infectious diseases globally.", source: "Vision statement", buyingInfluence: ["clinical","financial","operational"], customerChallenge: ["product-technical"] },

  "OID-09a": { type: "lead", doc: "oid", page: 9, text: "History of innovation: Open with a clear picture of Roche Diagnostics\u2019 long history as a scientific leader and innovator in the ID diagnostic space. Scientific Expertise: Highlight key \u2018firsts\u2019 and ongoing scientific collaborations to demonstrate Roche\u2019s extensive and enduring track record of delivering innovative ID solutions.", source: "Key themes and message flow \u2014 Trust & experience: History of innovation", buyingInfluence: ["clinical","financial"], customerChallenge: ["product-technical","access-to-innovation"] },
  "OID-09b": { type: "lead", doc: "oid", page: 9, text: "Global footprint: Speak to the expansive global presence and large existing supply base to reinforce that Roche has the reach and capacity to be a reliable partner.", source: "Key themes and message flow \u2014 Trust & experience: Global footprint", buyingInfluence: ["operational","financial"], customerChallenge: ["service-logistics-reliability"] },
  "OID-09c": { type: "lead", doc: "oid", page: 9, text: "Sustainable solutions: Focuses on a commitment to a sustainable future for diagnostics, reducing the environmental impact and ensuring societal and economic sustainability.", source: "Key themes and message flow \u2014 Trust & experience: Sustainable solutions", buyingInfluence: ["clinical","operational"], customerChallenge: ["product-technical"] },
  "OID-10a": { type: "lead", doc: "oid", page: 10, text: "Post-sales support: Speak to rapid technical support to keep the labs running and scientific/educational support to help them stay ahead of the curve.", source: "Key themes and message flow \u2014 Partnership & support: Post-sales support", buyingInfluence: ["operational"], customerChallenge: ["service-logistics-reliability","training-expertise"] },
  "OID-10b": { type: "lead", doc: "oid", page: 10, text: "Global outlook: Messages focuses on key global partnerships in both the Global Access Program and the Global Fund, focusing heavily on partnerships/collaboration.", source: "Key themes and message flow \u2014 Partnership & support: Global outlook", buyingInfluence: ["financial"], customerChallenge: ["strategic-partnership"] },
  "OID-10c": { type: "lead", doc: "oid", page: 10, text: "Partnership: Emphasising Roche\u2019s position as a \u2018collaborative partner\u2019 rather than a \u2018transactional supplier\u2019, working with labs to deliver solutions that meet their needs.", source: "Key themes and message flow \u2014 Partnership & support: Partnership", buyingInfluence: ["operational","financial"], customerChallenge: ["strategic-partnership"] },
  "OID-10d": { type: "lead", doc: "oid", page: 10, text: "Consultancy: Highlight ability for technical and healthcare consultancy, with support ranging from finding an optimal configuration to improving operational efficiency.", source: "Key themes and message flow \u2014 Partnership & support: Consultancy", buyingInfluence: ["operational"], customerChallenge: ["operational-excellence-uptime"] },
  "OID-11a": { type: "lead", doc: "oid", page: 11, text: "Patient value: Summarises increased medical value, speaking to a comprehensive menu with fast and accurate results across the continuum of care (self-tests, POC, lab etc.).", source: "Key themes and message flow \u2014 Comprehensive value: Patient value", buyingInfluence: ["clinical"], customerChallenge: ["product-technical"] },
  "OID-11b": { type: "lead", doc: "oid", page: 11, text: "Operational value: Summarises increased value for labs with the flexibility and efficiency to meet each customers\u2019 needs, speaking to solution breadth, integration and automation.", source: "Key themes and message flow \u2014 Comprehensive value: Operational value", buyingInfluence: ["operational","financial"], customerChallenge: ["automation-digitalization","cost-effective-right-sized-solutions"] },
  "OID-11c": { type: "lead", doc: "oid", page: 11, text: "Investment & future-value: Finish with a message of continued commitment to ID; in investment and menu expansion that will strive to maximise value today and into the future.", source: "Key themes and message flow \u2014 Comprehensive value: Investment & future-value", buyingInfluence: ["financial"], customerChallenge: ["cost-effective-right-sized-solutions"] },
  "OID-13a": { type: "lead", doc: "oid", page: 13, text: "Improved patient experience: Focus on giving patients fast, reliable, and accurate diagnoses without the fear of misdiagnosis or the need for retests/redraws.", source: "Key themes and message flow \u2014 Patient-centric: Improved patient experience", buyingInfluence: ["clinical"], customerChallenge: ["product-technical"] },
  "OID-13b": { type: "lead", doc: "oid", page: 13, text: "Better patient care: Highlight the high coverage of key ID indications and improved care with assays that support and enhance clinical decisions. Finish by highlighting Roche\u2019s commitment to an extensive menu expansion.", source: "Key themes and message flow \u2014 Patient-centric: Better patient care", buyingInfluence: ["clinical"], customerChallenge: ["product-technical","access-to-innovation"] },
  "OID-13c": { type: "lead", doc: "oid", page: 13, text: "Global access: Utilise the great example of the Roche Global Access Program to show the strong commitment to supporting the fight against ID in LMIC.", source: "Key themes and message flow \u2014 Patient-centric: Global access", buyingInfluence: ["clinical","financial"], customerChallenge: ["strategic-partnership"] },
  "OID-14a": { type: "lead", doc: "oid", page: 14, text: "Systems portfolio: Speak to the systems at various throughput levels, cutting-edge automation and modular approaches that enable labs to scale as their needs change.", source: "Key themes and message flow \u2014 Solutions for all settings: Systems portfolio", buyingInfluence: ["operational"], customerChallenge: ["automation-digitalization"] },
  "OID-14b": { type: "lead", doc: "oid", page: 14, text: "Automation, consolidation & integration: Cover solutions that can boost efficiency, both within labs with the serum work area (SWA) and molecular work area (MWA) and at the bedside with rapid and automated point-of-care solutions.", source: "Key themes and message flow \u2014 Solutions for all settings: Automation, consolidation & integration", buyingInfluence: ["operational"], customerChallenge: ["automation-digitalization"] },
  "OID-14c": { type: "lead", doc: "oid", page: 14, text: "Digital integration: Focus on data solutions that enable powerful, actionable insights into performance.", source: "Key themes and message flow \u2014 Solutions for all settings: Digital integration", buyingInfluence: ["operational"], customerChallenge: ["automation-digitalization"] },
  "OID-15a": { type: "lead", doc: "oid", page: 15, text: "Outbreak expertise: Highlight key examples of crisis readiness, and reassure that we have the innovative solutions to rapidly respond to any future emergency.", source: "Key themes and message flow \u2014 Rapid responsiveness: Outbreak expertise", buyingInfluence: ["operational","financial"], customerChallenge: ["operational-excellence-uptime"] },
  "OID-15b": { type: "lead", doc: "oid", page: 15, text: "COVID-19 solutions: Focus on the speed and breadth of COVID-19 diagnostics solutions developed across divisions, with assays that cover the entire patient journey.", source: "Key themes and message flow \u2014 Rapid responsiveness: COVID-19 solutions", buyingInfluence: ["clinical","operational"], customerChallenge: ["product-technical"] },
  "OID-15c": { type: "lead", doc: "oid", page: 15, text: "COVID-19 response & infrastructure: Focus on the robust response from extra investment, rapid infrastructure expansion and ability to deliver tests despite global supply pressures.", source: "Key themes and message flow \u2014 Rapid responsiveness: COVID-19 response & infrastructure", buyingInfluence: ["operational","financial"], customerChallenge: ["service-logistics-reliability"] },

  "OID-18u": { type: "lead", doc: "oid", page: 18, text: "Unmet need: Labs are struggling with everything from dealing with multiple suppliers to complex, fragmented and unreliable solutions, and irregular supply chains. They need a trusted and experienced partner with the scientific expertise to deliver a comprehensive portfolio of solutions capable of meeting their needs.", source: "Unmet need \u2014 Trust & Experience", buyingInfluence: ["clinical","financial"], customerChallenge: ["product-technical"] },
  "OID-22u": { type: "lead", doc: "oid", page: 22, text: "Unmet need: With increasing complexity, breadth and volume of ID testing, labs don\u2019t want complex, fragmented and unreliable solutions from transactional suppliers. They want a long-term, collaborative partner that understands their needs and helps them build a lab that delivers the best possible service, both pre- and post-sale.", source: "Unmet need \u2014 Partnership & Support", buyingInfluence: ["operational","financial"], customerChallenge: ["strategic-partnership"] },
  "OID-29u": { type: "lead", doc: "oid", page: 29, text: "Unmet need: Our customers share a common goal of improving the lives of those affected by ID. They need a partner that not only looks at what patients need now, but also at what they need next. This enables them to continue to deliver the highest medical value and the best experience for patients.", source: "Unmet need \u2014 Patient-centric", buyingInfluence: ["clinical"], customerChallenge: ["product-technical"] },
  "OID-32u": { type: "lead", doc: "oid", page: 32, text: "Unmet need: Labs at all levels of throughput can struggle to cope with the pressure to deliver high-quality, timely results, and from an ever-increasing number of complex assays, all while managing with increasingly fewer staff.", source: "Unmet need \u2014 Solutions for all settings", buyingInfluence: ["operational"], customerChallenge: ["managing-staff-shortages","automation-digitalization"] },
  "OID-35u": { type: "lead", doc: "oid", page: 35, text: "Unmet need: Labs always need to be ready to respond to a sudden ID landscape that can rapidly shift. Our customers need a partner they can trust and who has expertise and experience from fighting past global health threats, to ensure they are ready to navigate any future crises.", source: "Unmet need \u2014 Rapid Responsiveness", buyingInfluence: ["operational","financial"], customerChallenge: ["operational-excellence-uptime"] },

  "OID-26u": { type: "proof", doc: "oid", page: 26, relatedLead: ["OID-11a","OID-11b","OID-11c"], text: "Unmet need: Between 60-70% of medical decisions are based on in vitro diagnostic test results. Despite diagnostics being crucial to combating ID, the landscape is becoming increasingly complex, with tighter budgets, rising workloads, staff pressures, and increased competition forcing labs to do more with less.", source: "Unmet need \u2014 Comprehensive Value" },

  "OID-18a": { type: "proof", doc: "oid", page: 18, relatedLead: ["OID-09a"], text: "At Roche, everything we do must meet the current and future needs of patients. Since 1968, Roche has been committed to delivering innovative diagnostics solutions, with a proud history at the forefront of infectious diseases (ID). We pioneered polymerase chain reaction (PCR). From the first real-time PCR instrument to the first compact real-time PCR system for on-demand ID testing at the point of care with cobas\u00ae liat\u00ae System. We redefined what is possible with the automation and consolidation of ID diagnostics with the first high-throughput, fully automated sample-to-results system with our cobas\u00ae 6800 and 8800 Systems. And, from delivering the first commercially available HIV assay to innovative assays for Hepatitis C and HIV that can simultaneously detect antigen and antibodies, we continue to expand what can be achieved from a single test.", source: "History of Innovation, paragraph 1" },
  "OID-18b": { type: "proof", doc: "oid", page: 18, relatedLead: ["OID-09a"], text: "We remain a leader in in vitro diagnostics (IVD), trusted by customers around the globe, with over 29 billion tests completed in 2022. Our patient-centric approach continues to focus on expanding our extensive portfolio of trusted and flexible ID diagnostics solutions, from immunochemistry, molecular and blood safety solutions, as well as point of care and lateral flow tests, to empower our partners to maximise their medical value and meet the needs of patients today and in the future.", source: "History of Innovation, paragraph 2" },
  "OID-19a": { type: "proof", doc: "oid", page: 19, relatedLead: ["OID-09a"], text: "With the best scientists and continuous commitment to investment ID, we have built our organisation around always striving to meet our customers\u2019 needs and improve patient care. Everything we do is rooted in science, collaborating with academic institutions, governments, and policymakers around the world to ensure all our solutions are robust, efficient and effective. We were one of the first companies to recognise the importance of external collaboration, partnering for more than 20 years with companies and research institutes worldwide and supporting Investigator Initiated Studies (IIS) to enhance understanding and application of our solutions and further their benefit to patients.", source: "Scientific Expertise, paragraph 1" },
  "OID-19b": { type: "proof", doc: "oid", page: 19, relatedLead: ["OID-09a"], text: "Staying ahead of an ever-shifting ID landscape requires agility and expertise. We have continuously improved the synergies between our Pharmaceutical and Diagnostics divisions, allowing them to share research facilities, technologies and discoveries for a unique development process that drives innovation and better solutions. We support all our R&D teams with the autonomy and resources to innovate, investing 14 billion CHF in 2022 to discover the best solutions to meet the unmet needs of our customers and patients.", source: "Scientific Expertise, paragraph 2" },
  "OID-20a": { type: "proof", doc: "oid", page: 20, relatedLead: ["OID-09b"], text: "Our global supply chain and efficient logistics help us consistently deliver, maintain, and supply our customers worldwide. We have built a robust network of over 60,000 suppliers, spanning 6 continents and over 80 countries, to secure a sustainable supply of solutions, reagents and consumables for our partners worldwide, even in times of crisis. During 2021, our expansive supply chain enabled our partners to continue to support patients, completing over 27 billion tests despite immense global pressures.", source: "Global Footprint" },
  "OID-21a": { type: "proof", doc: "oid", page: 21, relatedLead: ["OID-09c"], text: "We have long been committed to doing better for patients and the planet by building sustainability into the core of our business strategy, with an urgent focus on reducing our own footprint while influencing and supporting the decarbonisation efforts of our suppliers and partners. We are aiming for a 50% reduction in the environmental impact of our operations & products by 2029, and to reach absolute zero greenhouse gas emissions by 2050 without compensating and offsetting emissions. Our commitment to sustainability goes beyond minimising the environmental impact of our solutions to building a better society that creates jobs, ensures livelihoods, and contributes to over 100 local economies. All while prioritising safety and health, as well as promoting diversity, inclusion and equal opportunities, both internally and along the supply chain.", source: "Sustainable Solutions" },

  "OID-22a": { type: "support", doc: "oid", page: 22, relatedLead: ["OID-10c"], text: "We build relationships with our customers far beyond that of a transactional supplier. We foster strategic and collaborative partnerships aligned to a common goal of improving patients' lives. We listen to customers to understand their goals and pain points and deliver innovative solutions that meet their specific needs. With a focus on increasing efficiency and maximising medical value, we help our customers overcome staff and resource challenges, address unmet medical and diagnostic needs, and unlock new market opportunities while continuing to provide the best patient experience.", source: "Partnership" },
  "OID-23a": { type: "support", doc: "oid", page: 23, relatedLead: ["OID-10d"], text: "From innovative diagnostics solutions to data-powered insights, we support and advise our customers every step of the way. Our technical consultants get to know each customer\u2019s specific testing requirements, workflows, and physical space. That way, we can co-create a configuration that optimises resources, accelerates turnaround times and maximises the use of floor space for a future-ready solution capable of driving growth, all while ensuring our customers can deliver the highest possible medical value.", source: "Consultancy, paragraph 1" },
  "OID-23b": { type: "support", doc: "oid", page: 23, relatedLead: ["OID-10d"], text: "Our healthcare consultants work with our customers to recognise opportunities to integrate data and resources at all levels of their organisation, not just in the lab. Our years of experience have taught us the nuances of the diagnostic landscape, so we can go beyond surface-level improvements to provide deeper insights that optimise performance, add value and respond to ever-changing health policies and economics to improve patient and business outcomes.", source: "Consultancy, paragraph 2" },
  "OID-24a": { type: "proof", doc: "oid", page: 24, relatedLead: ["OID-10a"], text: "As one of the world's largest biotech companies and a leader in IVD, Roche has a global footprint with a force of over 88,000 people working together across more than 150 countries. Whenever our customers need us, we're here \u2014 24 hours a day, 7 days a week. With a global network of technical specialists and a 24-hour hotline, support is always available to fix any issues and keep our customers up and running. Our digital solution, Roche DiaLog, provides next-generation customer support as a collaborative online platform containing specialised support solutions designed to help our customers streamline and simplify everyday tasks to help staff get more done with less.", source: "Post-sales support" },
  "OID-25a": { type: "proof", doc: "oid", page: 25, relatedLead: ["OID-10b"], text: "[Position 1] We are committed to supporting governments in building strong and resilient healthcare systems by improving access to quality diagnostics. In 2014, Roche launched the Global Access Program to enable access to reliable testing solutions for patients in low- and low-middle-income countries (LMIC). We collaborate with international agencies, non-governmental organisations and governments at the global and local levels to improve health system diagnostic capacity. Our range of solutions includes disease awareness and education programmes, healthcare worker training, lab efficiency consulting and digital solutions to help create scalable and sustainable solutions for laboratories, healthcare professionals, and patients no matter where they live.", source: "Global Outlook, paragraph 1" },
  "OID-25b": { type: "proof", doc: "oid", page: 25, relatedLead: ["OID-10b"], text: "In 2022, we joined forces with the Global Fund to improve the diagnosis of HIV and TB for patients in LMIC by building local capacity to tackle fundamental infrastructure challenges \u2013 from increasing capacity and improving pandemic preparedness to supporting the establishment of affordable, effective, sustainable management of healthcare waste. Through collaboration with the Global Fund, Ministries of Health and country-based partners, our ambition is to support assessments and implementation of new technologies and knowledge transfer in 10 countries over the next five years.", source: "Global Outlook, paragraph 2" },

  "OID-26a": { type: "proof", doc: "oid", page: 26, relatedLead: ["OID-11a"], text: "Patients are at the heart of everything that we do. Our comprehensive infectious diseases portfolio of over 65 assays is designed to meet the needs of patients affected by diseases with the greatest global impact, ranging from hepatitis, sexual health and respiratory infections to vector-borne diseases. From a rapid and accurate diagnosis to guiding treatment or evaluating immunity, our assays help provide actionable insights along the entire treatment journey so that we can help patients get the right treatment at the right time.", source: "Patient Value, paragraph 1" },
  "OID-26b": { type: "support", doc: "oid", page: 26, relatedLead: ["OID-11a"], text: "We're paving the way for a new standard of care. Our cutting-edge automation and integration streamline workflows, increase throughput and accelerate turnaround times that ensure rapid and accurate results so patients get the right treatment as soon as possible to improve disease management and drive better outcomes. With solutions ranging from the lab to point-of-care and lateral flow tests, we ensure that patients can access fast and reliable results along the entire continuum of care.", source: "Patient Value, paragraph 2" },
  "OID-26c": { type: "support", doc: "oid", page: 26, relatedLead: ["OID-11a"], text: "Our innovations also account for the needs of providers, payers and all other stakeholders. We understand that fast, accurate diagnostics not only improve patient care but are crucial to delivering better public health outcomes. From shortening hospital stays to reducing costs of mistreatment and preventing transmission, our diagnostic solutions help build more robust, efficient and sustainable healthcare systems and improve the health of society as a whole.", source: "Patient Value, paragraph 3" },
  "OID-27a": { type: "support", doc: "oid", page: 27, relatedLead: ["OID-11c"], text: "Our holistic view of value goes beyond simply supplying tests. We focus on delivering solutions that meet our customer\u2019s needs and maximise their return on investment day after day, optimising workflow, speeding up turnaround times, and freeing up staff. We provide a range of options that meet the needs across all settings and at all levels of throughput, from integrated and automated serology and molecular lab testing, to point-of-care solutions that enable rapid testing at the point of need. Our platform options provide the flexibility to scale throughput and testing capabilities to increase value and access new market opportunities. While our cutting-edge automation handles those time-consuming, mundane manual tasks, our pioneering integration of serology and molecular workflows frees up skilled staff to dedicate more time to high-value tasks and collaborating with clinicians to improve patient care.", source: "Investment & Future Value, paragraph 1" },
  "OID-27b": { type: "support", doc: "oid", page: 27, relatedLead: ["OID-11c"], text: "We work closely with each customer, from selecting the configuration that unlocks untapped medical value to supporting them to overcome their organisational challenges, ultimately driving better outcomes for both business and patients.", source: "Investment & Future Value, paragraph 2" },
  "OID-28a": { type: "support", doc: "oid", page: 28, relatedLead: ["OID-11b"], text: "We are driven by a patient-centric mindset that concentrates our innovation on solutions that maximise medical value and improve patients\u2019 experience of ID testing. We\u2019re here for patients wherever they need us. Our comprehensive menu of assays and solutions spans nearly the entire spectrum of routine testing \u2013 from the lab to the point of care and lateral flow tests \u2013 meaning our patients can get fast, accurate results in almost any setting. Our cutting-edge automation speeds up turnaround times so patients get rapid results and the right care as soon as possible, in order for clinicians to improve disease management and drive better outcomes. Our integrated serology and molecular testing enables confirmatory reflex testing from a single specimen, so clinicians and patients get a comprehensive diagnostic picture with fewer visits and without the stress and pain of redraws and secondary tests.", source: "Operational Value" },

  "OID-29a": { type: "support", doc: "oid", page: 29, relatedLead: ["OID-13b"], text: "We are driven by a patient-centric mindset that concentrates our innovation on solutions that strives to maximise medical value and improve patients\u2019 experience of ID testing. We\u2019re here for patients wherever they need us. Our comprehensive menu of assays and solutions spans nearly the entire spectrum of routine testing \u2013 from the lab to the point of care and lateral flow tests \u2013 meaning our patients can get fast, accurate results in almost any setting. Our cutting-edge automation speeds up turnaround times so patients get rapid results and the right care as soon as possible, in order for clinicians to improve disease management and drive better outcomes. Our integrated serology and molecular testing enables confirmatory reflex testing from a single specimen, so clinicians and patients get a comprehensive diagnostic picture with fewer visits and without the stress and pain of redraws and secondary tests.", source: "Better Patient Care" },
  "OID-30a": { type: "proof", doc: "oid", page: 30, relatedLead: ["OID-13a"], text: "With over 65 high-sensitivity and specificity ID assays, ranging from core diseases (like HIV, hepatitis and TB) to regional-specific diseases (like West Nile virus, dengue and Zika), our comprehensive portfolio is designed to ensure patients across the globe can access a fast, reliable test for the disease that\u2019s specific to their needs.", source: "Improved Patient Experience, paragraph 1" },
  "OID-30b": { type: "proof", doc: "oid", page: 30, relatedLead: ["OID-13a"], text: "Our assays focus on delivering high medical value that helps clinicians make more informed decisions and improves patient care when they are needed most. We support antimicrobial stewardship and the appropriate use of antibiotics by rapidly identifying causative pathogens, detecting antibiotic resistance, and providing clear signals for antibiotic starts and stops. Our respiratory pathogen panel can identify 20 of the most common viruses and bacteria that cause upper respiratory illness in about 90 minutes, while our cobas\u00ae liat\u00ae solution can rule-in or rule-out SARS-CoV-2 & Influenza right at the point of care in only 20 minutes. Our ToRCH testing solutions help rapidly and reliably identify congenital infections, while our Elecsys\u00ae Cytomegalovirus and Toxoplasmosis antibody avidity assays provide vital information on time since infection to help manage the risks of congenital transmission in pregnant patients.", source: "Improved Patient Experience, paragraph 2" },
  "OID-30c": { type: "support", doc: "oid", page: 30, relatedLead: ["OID-13a"], text: "We\u2019re always looking to what patients need next. That\u2019s why we continue to support and expand our extensive assay pipeline and develop new and innovative platforms. Over the next decade, we will rapidly expand our POC ID portfolio to double access to high medical value solutions at the point of care. So we can give more patients and clinicians access to the diagnostics they need when they need it.", source: "Improved Patient Experience, paragraph 3" },
  "OID-31a": { type: "support", doc: "oid", page: 31, relatedLead: ["OID-13c"], text: "[Position 2] Almost half of the world\u2019s population has no or limited access to diagnostics. Therefore, our scientific expertise and innovation in ID diagnostics must support all patients \u2013 no matter where they live. The Roche Global Access Program aims to expand access to quality, sustainable diagnostic testing for patients in LMIC and assists in establishing sustainable, national elimination programmes that meet World Health Organisation (WHO) disease elimination goals. We have supported patients across the globe, delivered widespread HIV, hepatitis and TB testing and cervical cancer screening throughout Africa, and contributed to the global management of COVID-19.", source: "Global Access" },

  "OID-32a": { type: "support", doc: "oid", page: 32, relatedLead: ["OID-14a"], text: "Our holistic platform portfolio ensures we have a solution that meets our customer\u2019s needs in all settings and at all levels of throughput.", source: "Systems Portfolio, paragraph 1" },
  "OID-32b": { type: "support", doc: "oid", page: 32, relatedLead: ["OID-14a"], text: "From the lab bench, with solutions ranging from standalone analysers to fully integrated and automated systems, to the bedside, with lateral flow tests and fully automated point-of-care solutions. Our portfolio helps clinicians and patients get the results they need \u2013 wherever they are receiving care.", source: "Systems Portfolio, paragraph 2" },
  "OID-32c": { type: "support", doc: "oid", page: 32, relatedLead: ["OID-14a"], text: "The same innovative technology powers our comprehensive blood safety solution, designed to work together for maximum efficiency and accuracy to help ensure that patients across the globe have a sufficient and safe supply of whole blood and plasma products.", source: "Systems Portfolio, paragraph 3" },
  "OID-32d": { type: "support", doc: "oid", page: 32, relatedLead: ["OID-14a"], text: "Our range of platforms provides customers with the flexibility of a configuration that matches their specific throughput and testing needs. This unique approach ensures that our customers can scale their throughput and adapt testing capabilities for a solution that enables continuous growth and creates value for years to come.", source: "Systems Portfolio, paragraph 4" },
  "OID-33a": { type: "proof", doc: "oid", page: 33, relatedLead: ["OID-14b"], text: "We boost efficiency in centralised and decentralised settings. Within the lab, our cutting-edge end-to-end automation helps prevent contamination and tackles time-consuming and error-prone manual tasks, from pre- and post-analytics to seamlessly connecting different instruments, ensuring accurate and reliable results while accelerating turnaround times that free up staff time and expertise. While our point-of-care systems, capable of a fully automated PCR process that delivers accurate results in 20 minutes or less, and lateral flow tests make ID testing more accessible to patients wherever they are.", source: "Automation, Consolidation & Integration, paragraph 1" },
  "OID-33b": { type: "support", doc: "oid", page: 33, relatedLead: ["OID-14b"], text: "We are the pioneers of lab consolidation and integration, breaking down the barriers between and within labs for streamlined and simplified workflows. We fully integrated clinical chemistry and immunochemistry onto a single platform with our serum work area (SWA). We automated nearly the entire molecular workflow with the molecular work area (MWA). Our commitment extends beyond individual disciplines as we continually push what is possible within a single platform by combining serology and molecular testing into an all-inclusive solution for fully-integrated and automated ID testing for clinical and blood screening labs.", source: "Automation, Consolidation & Integration, paragraph 2" },
  "OID-34a": { type: "support", doc: "oid", page: 34, relatedLead: ["OID-14c"], text: "True integration means more than simple connectivity. We harness the power of data with purpose-built digital solutions that can securely integrate data from lab and point-of-care solutions. From providing actionable insight to help simplify laboratory processes and workflow to enabling real-time monitoring of lab performance, our digital solutions provide the detailed operational analytics needed to guide better outcomes.", source: "Digital Integration" },

  "OID-35a": { type: "proof", doc: "oid", page: 35, relatedLead: ["OID-15a"], text: "Over the last three decades, Roche has been on the front lines of outbreaks. In 1998, Roche founded the Global Surveillance Program to monitor changes to the HIV genome, but now monitors the genetic sequences of many diseases, ranging from viral pathogens like influenza and hepatitis to bacterial pathogens like Mycobacterium tuberculosis (MTB) and methicillin-resistant Staphylococcus aureus (MRSA). The programme is relied upon by researchers, physicians and patients worldwide and remains a vital tool to improve the reliability of our assays and to monitor new and emerging threats so that we\u2019re ready to rapidly respond with innovative solutions as soon as possible.", source: "Outbreak Expertise (1), paragraph 1" },
  "OID-35b": { type: "proof", doc: "oid", page: 35, relatedLead: ["OID-15a"], text: "In 2014, as Ebola spread to thousands in west Africa and reached patients in the UK and the US, we rapidly developed, under an emergency use authorisation (EUA), an easy-to-use molecular diagnostic test in whole blood samples for rapid virus detection.", source: "Outbreak Expertise (1), paragraph 2" },
  "OID-35c": { type: "proof", doc: "oid", page: 35, relatedLead: ["OID-15a"], text: "In 2016, as Zika began spreading rapidly, we worked closely with agencies in Puerto Rico and the US to rapidly develop an in vitro nucleic acid screening test capable of directly detecting the Zika virus RNA in plasma from blood donors, ensuring patients received the safest blood products possible. We continue to innovate, launching the first fully automated Zika antibody assay. By leveraging our Elecsys technology, we were able to rapidly develop an assay with the high specificity needed to cross-react with other viruses. This ensures that clinicians and patients, particularly expectant mothers, can make more informed choices through access to fast, reliable, and accurate results on a potential recent Zika infection.", source: "Outbreak Expertise (1), paragraph 3" },
  "OID-35d": { type: "proof", doc: "oid", page: 35, relatedLead: ["OID-15a"], text: "Babesiosis is a tick-borne illness from the Babesia parasite. It can be life-threatening, especially among the elderly and immunocompromised, but it can\u2019t be detected through traditional plasma or serum samples. In 2019, we created the first high-throughput nucleic acid screening method capable of detecting all four of the common Babesia species in whole blood samples to help protect the global blood supply from this disease.", source: "Outbreak Expertise (1), paragraph 4" },
  "OID-36a": { type: "proof", doc: "oid", page: 36, relatedLead: ["OID-15b"], text: "Declared a pandemic by the WHO in March 2020, COVID-19 represented an unprecedented global health crisis that demanded a global response. Roche worked with urgency, passion and purpose each and every day, leveraging our decades of innovation and research to rapidly deliver 13 high-quality assays to the market in only 12 months. We have continued to expand our portfolio to over 20 COVID-19 assays ranging from serological and molecular assays to point-of-care and lateral flow tests to ensure patients, clinicians, and policymakers have the vital diagnostic tools they need to navigate the pandemic. Our investment in increased production and scaling up infrastructure enabled 1.2 billion COVID-19 tests to be completed using one of our assays to date.", source: "Outbreak Expertise (2), paragraph 1" },
  "OID-36b": { type: "proof", doc: "oid", page: 36, relatedLead: ["OID-15a"], text: "In 2022, as Monkeypox was declared a public health emergency by the WHO, we delivered a Emergency Use Authorization (EUA) high-throughput automated test to detect the monkeypox virus with an innovative dual-target approach that ensures detection even if mutations occur. With swift action, patients could get an accurate diagnosis and appropriate treatment as soon as possible while avoiding unnecessary testing or isolation.", source: "Outbreak Expertise (2), paragraph 2" },
  "OID-36c": { type: "proof", doc: "oid", page: 36, relatedLead: ["OID-15a"], text: "We continue to drive research so that all of society is better able to navigate future outbreaks. In 2022, Roche, in partnership with Ludwig-Maximilians-Universit\u00e4t (LMU) and the Fraunhofer-Gesellschaft, opened a new centre dedicated to identifying and characterising pandemic pathogens to develop new diagnostics and therapies and to better understand the role of the immune system in ID.", source: "Outbreak Expertise (2), paragraph 3" },
  "OID-36d": { type: "support", doc: "oid", page: 36, relatedLead: ["OID-15a"], text: "By leveraging our extensive experience, scientific expertise, and innovative diagnostic solutions, we are always ready to respond and support labs", source: "Outbreak Expertise (2), paragraph 4" },
  "OID-37a": { type: "proof", doc: "oid", page: 37, relatedLead: ["OID-15b"], text: "The COVID-19 pandemic needed a rapid response. And we were prepared to rise to the challenge. But that preparedness didn\u2019t happen overnight. It was the culmination of our past experiences in fighting outbreaks and our scientific expertise and innovative technology. We brought 13 assays to the market in only 12 months, including one of the first laboratory developed tests (LDT) in collaboration with TIB Molbiol as well as the first IVD SARS-CoV-2 PCR test, a high-performance serology test in just 42 days. With over 20 COVID-19 assays covering the entire patient journey from detecting infection to assessing long-term immunity, we help public, healthcare professionals and governments to have the right tools to make informed decisions throughout the pandemic.", source: "COVID-19 Solutions" },
  "OID-38a": { type: "proof", doc: "oid", page: 38, relatedLead: ["OID-15c"], text: "The COVID-19 pandemic needed reliability and experience. Our robust supply chain enabled us to ramp up production to meet the rapid increase in demand. Since 2020, Roche has invested 664 million CHF in expanding our production capacity, including over 100 new manufacturing lines for consumables, reagents and raw materials, and a brand new manufacturing space for instruments alongside four major facility expansions. Since the start of the pandemic, 1.2 billion COVID-19 tests have been completed using one of the assays from our diverse portfolio.", source: "COVID-19 Response & Infrastructure, paragraph 1" },
  "OID-38b": { type: "support", doc: "oid", page: 38, relatedLead: ["OID-15c"], text: "We are committed to maintaining the momentum of our pandemic response. It can serve as the foundation for a more robust and accessible ID testing infrastructure, with the opportunity to redeploy testing for better screening and prevention of other IDs and strengthen our ability to fight against ID globally.", source: "COVID-19 Response & Infrastructure, paragraph 2" }
};

function contentTypeKey(label) {
  const s = (label || '').toLowerCase();
  if (s === 'all') return 'all';
  if (s.indexOf('proof') !== -1) return 'proof';
  if (s.indexOf('support') !== -1) return 'support';
  return 'lead';
}

function tagIncludes(arr, val) {
  return Array.isArray(arr) && arr.indexOf(val) !== -1;
}

// True intersection first: an entry must satisfy every filter that was
// actually specified (not "All"). Only if that intersection is empty do we
// fall back to a partial (any-one-filter) match, as a best-effort — never a
// silent substitution of union logic for a real, specific query.
function filterEntries(entries, audienceValue, needValue) {
  const hasAudience = !!audienceValue && audienceValue !== 'all';
  const hasNeed = !!needValue && needValue !== 'all';

  if (!hasAudience && !hasNeed) {
    return { matches: entries, mode: 'all' };
  }

  const matchesA = function(e) { return hasAudience ? tagIncludes(e[1].buyingInfluence, audienceValue) : true; };
  const matchesN = function(e) { return hasNeed ? tagIncludes(e[1].customerChallenge, needValue) : true; };

  const intersection = entries.filter(function(e) { return matchesA(e) && matchesN(e); });
  if (intersection.length > 0) return { matches: intersection, mode: 'intersection' };

  if (hasAudience && hasNeed) {
    const partial = entries.filter(function(e) { return matchesA(e) || matchesN(e); });
    if (partial.length > 0) return { matches: partial, mode: 'partial' };
  }

  return { matches: [], mode: 'none' };
}

function buildGaps(mode, count, kind) {
  if (mode === 'all') return [];
  if (count === 0) {
    return [{ title: 'No match found', description: 'No ' + kind + ' entries in the library satisfy the requested buying influence and customer need.' }];
  }
  if (mode === 'partial') {
    return [{ title: 'Partial match only', description: 'No entry satisfied both the requested buying influence and customer need together \u2014 showing entries that match at least one.' }];
  }
  return [];
}

// lead: matched directly by its own tags.
// support / proof: matched via relatedLead — first find which lead(s) fit
// the requested filters, then return target-type entries that substantiate
// one of those leads.
function selectByType(kind, audienceValue, needValue) {
  if (kind === 'lead') {
    const entries = Object.entries(MESSAGE_LIBRARY).filter(function(e) { return e[1].type === 'lead'; });
    const filtered = filterEntries(entries, audienceValue, needValue);
    const selections = filtered.matches.map(function(e) { return { id: e[0], text: e[1].text, source: e[1].source, doc: e[1].doc, page: e[1].page, type: 'lead' }; });
    return { selections: selections, gaps: buildGaps(filtered.mode, selections.length, 'lead') };
  }

  const allLeads = Object.entries(MESSAGE_LIBRARY).filter(function(e) { return e[1].type === 'lead'; });
  const leadMatch = filterEntries(allLeads, audienceValue, needValue);
  const matchedLeadIds = leadMatch.matches.map(function(e) { return e[0]; });

  const targetEntries = Object.entries(MESSAGE_LIBRARY).filter(function(e) { return e[1].type === kind; });
  const linked = targetEntries.filter(function(e) { return (e[1].relatedLead || []).some(function(rl) { return matchedLeadIds.indexOf(rl) !== -1; }); });

  const selections = linked.map(function(e) { return { id: e[0], text: e[1].text, source: e[1].source, doc: e[1].doc, page: e[1].page, type: kind }; });
  return { selections: selections, gaps: buildGaps(leadMatch.mode, selections.length, kind) };
}

// --- Generative-content infrastructure (not used by /api/generate today) ---
// Retrieval above is fully deterministic on purpose. This is kept ready for
// the planned feature where the LLM drafts customer-facing copy FROM a set
// of already-verbatim-matched selections (e.g. weaving a chosen Lead +
// Support into a cohesive email) — a genuinely generative step layered on
// top of deterministic retrieval, not a replacement for it. Selection
// (which entries are relevant) should stay deterministic even after this is
// wired in; only the drafting step should call the model.

function callAnthropic(systemPrompt, userPrompt) {
  if (!API_KEY) {
    return Promise.reject(new Error('ANTHROPIC_API_KEY not set \u2014 required for generative features (not for content selection).'));
  }
  return new Promise(function(resolve, reject) {
    const payload = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const apiReq = https.request(options, apiRes => {
      const bodyChunks = [];
      apiRes.on('data', c => bodyChunks.push(c));
      apiRes.on('end', () => {
        const body = Buffer.concat(bodyChunks).toString('utf8');
        if (apiRes.statusCode !== 200) {
          let errMsg = 'Anthropic error ' + apiRes.statusCode;
          try { errMsg = JSON.parse(body).error?.message || errMsg; } catch (_) {}
          reject(new Error(errMsg));
          return;
        }
        try {
          const data = JSON.parse(body);
          const text = (data.content || []).map(function(b) { return b.text || ''; }).join('');
          resolve(text);
        } catch (e) {
          reject(new Error('Malformed response from Anthropic: ' + e.message));
        }
      });
    });
    apiReq.on('error', function(e) { reject(new Error('Cannot reach Anthropic: ' + e.message)); });
    apiReq.write(payload);
    apiReq.end();
  });
}

// The model reliably returns only JSON when instructed to, but occasionally
// adds a conversational preamble anyway. Pull the {...} substring out
// directly so that can never break parsing of a generative response either.
function extractJSON(text) {
  const stripped = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in model response');
  }
  return JSON.parse(stripped.slice(start, end + 1));
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const reqPath = req.url.split('?')[0].replace(/\/+$/, '') || '/';

  if (req.method === 'GET' && (reqPath === '/' || reqPath === '')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  if (req.method === 'GET' && reqPath === '/health') {
    sendJSON(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && reqPath.indexOf('/docs/') === 0) {
    const docKey = reqPath.slice('/docs/'.length).replace(/\.pdf$/, '');
    const docEntry = DOCS[docKey];
    if (!docEntry) { res.writeHead(404); res.end('Unknown document'); return; }
    fs.readFile(path.join(__dirname, docEntry.file), (err, data) => {
      if (err) { res.writeHead(404); res.end('Deck not found'); return; }
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': data.length,
        'Content-Disposition': 'inline; filename="' + docEntry.title + '.pdf"'
      });
      res.end(data);
    });
    return;
  }

  // Streaming endpoint (kept as SSE for client compatibility, though for
  // simplicity — and since 'all' must combine three separate calls — each
  // call to Anthropic here is non-streaming internally; only one final
  // "result" event is ever emitted per request).
  if (req.method === 'POST' && reqPath === '/api/generate') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch (e) { sendJSON(res, 400, { error: 'Invalid JSON: ' + e.message }); return; }

      const typeKey = contentTypeKey(parsed.contentType);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      // Match on the underlying tag values (e.g. "financial", not the display
      // label "Financial"), sent by the client alongside the labels.
      const audienceValue = (parsed.audienceValue || '').toLowerCase();
      const needValue = (parsed.customerNeedValue || '').toLowerCase();

      let combined;
      if (typeKey === 'all') {
        const l = selectByType('lead', audienceValue, needValue);
        const s = selectByType('support', audienceValue, needValue);
        const p = selectByType('proof', audienceValue, needValue);
        combined = {
          selections: l.selections.concat(s.selections, p.selections),
          gaps: l.gaps.concat(s.gaps, p.gaps)
        };
      } else {
        combined = selectByType(typeKey, audienceValue, needValue);
      }

      console.log('[generate] type=' + typeKey + ' audience=' + (audienceValue || 'all') + ' need=' + (needValue || 'all') + ' \u2014 selections:', combined.selections.length);

      const result = { contentType: typeKey, selections: combined.selections, gaps: combined.gaps };
      res.write('event: result\ndata: ' + JSON.stringify({ result }) + '\n\n');
      res.end();
    });
    return;
  }

  console.log('[404]', req.method, reqPath);
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('Roche AIM demo running at http://localhost:' + PORT);
  console.log('Content selection is fully deterministic (no API key required for this).');
  console.log('Anthropic API key:', API_KEY ? 'YES (' + API_KEY.slice(0,16) + '...) \u2014 ready for future generative features' : 'NOT SET \u2014 fine for now, needed once generative features are added');
});
