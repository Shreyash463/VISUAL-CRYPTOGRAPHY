/**
 * About & References tab module (Sections A to H).
 * Fully comprehensive documentation of visual cryptography theory, P1..P10 literature,
 * CMY subtractive color mechanisms, XOR schemes, security guarantees, and team acknowledgments.
 */
import { el, createIcon } from "./ui.js";

const WHAT_IS_VC_BULLETS = [
  "A secret image is turned into several noise-like shares and becomes visible only when the right shares are combined.",
  "Naor and Shamir introduced it at EUROCRYPT 1994; decoding is done by laying printed transparencies over each other, so the receiver needs no key knowledge and performs no cryptographic computation.",
  "The basic scheme is perfectly secure: even an attacker with unlimited computing power cannot tell from fewer than the required shares whether a pixel of the secret is black or white.",
  "k-out-of-n: any k of n shares reveal the image, any k-1 give no information; the original problem is 2-out-of-2.",
  "Each secret pixel is replaced by a small block of subpixels in every share, chosen by a random coin toss per pixel, so one share looks like random noise.",
  "VeilShare v2 extends visual cryptography to full colour through CMY subtractive halftoning (Hou 2003 / P5) and 24-bit RGB digital bitwise XOR sharing (Wang et al. 2005 / P6).",
];

const WHY_IT_MATTERS_BULLETS = [
  "P7 uses it to protect biometric data (face, fingerprint, iris) in central databases: a face image is split into two sheets stored on two separate servers, revealed only when both are available.",
  "P8 uses it as one component of a web-based online voting system to ensure tamper-evident voter ballot auditability.",
  "P9 reviews applications that use visual cryptography across medical diagnostics, remote banking, and access badges.",
  "Because decoding needs no cryptographic expertise or computing power, it enables physical optical verification for non-specialists.",
];

const COLOUR_VC_BULLETS = [
  "Mode A (Colour Overlay, P5 Hou 2003): Converts RGB to subtractive primaries Cyan (255-R), Magenta (255-G), and Yellow (255-B). Each channel is independently halftoned with Floyd-Steinberg error diffusion and expanded into 2x2 subpixels. Physical stacking acts as subtractive ink multiplication (per-channel minimum). A display enhancement mode averages 2x2 blocks, thresholds ink coverage at 0.75, and applies light Gaussian smoothing (sigma=0.8) to recover the vibrant original colour.",
  "Mode B (Colour XOR, P6 Wang et al. 2005): Operates directly on 8-bit R, G, B channels. Shares 1 to n-1 are generated from cryptographically secure random bytes, and share n is the bitwise XOR sum of the secret and all prior shares. Bitwise XOR reconstruction yields byte-for-byte exact colour fidelity with zero pixel expansion.",
];

const MODULES_DATA = [
  { module: "M1", name: "Input image", purpose: "Accept and validate uploaded secret images (formats, dimensions, sizes, and color detection)." },
  { module: "M2", name: "Preprocessing", purpose: "Convert secret images to binary pixel matrices via Floyd–Steinberg halftoning or fixed thresholding; downscale high-resolution images." },
  { module: "M3", name: "Share generation", purpose: "Generate noise-like shares using Naor–Shamir 2×2 overlay blocks, Hou CMY subpixel matrices, or Wang et al. XOR secret sharing." },
  { module: "M4", name: "Reconstruction", purpose: "Combine shares via physical transparency stacking simulation (per-channel min / OR) or mathematical XOR." },
  { module: "M5", name: "User interface", purpose: "Provide an accessible web test harness, interactive superposition simulator, and educational demonstration suite." },
  { module: "M6", name: "Share storage and delivery", purpose: "Embed cryptographic metadata in PNG tEXt chunks, generate collision-free filenames, and package shares as ZIP archives." },
];

const LIMITATIONS_DATA = [
  "C-1 Overlay mode inherently loses contrast (50% in physical stack) and expands pixels by 2× (4× area) (P1, P2); figures are measured and reported honestly.",
  "C-2 Display enhancement in Mode A is a visualization convenience using both shares; it requires no extra secrets or server storage.",
  "C-3 XOR mode is limited to (n,n) and (2,n) because P6 leaves a general (k,n) version open; this build offers (n,n) for n=2..6.",
  "C-4 Shares must remain lossless PNGs: messaging platforms or lossy JPEG compression destroy the microscopic subpixel patterns, corrupting optical reconstruction.",
  "C-5 Shares must keep identical dimensions so they align pixel by pixel; mismatched groups are detected and flagged with warnings.",
];

const LITERATURE_DATA = [
  {
    paper: "P1 Naor & Shamir",
    year: "1994",
    contribution: "Introduced visual cryptography: decoding by stacking, no cryptographic computation, perfect security; k-out-of-n extension; constructions with proven bounds.",
    limitation: "Pixel expansion (resolution loss) and contrast loss; for k-out-of-k, contrast is 1/2^(k-1).",
  },
  {
    paper: "P2 Naor & Shamir (II)",
    year: "1996",
    contribution: "Alternative \"Cover\" reconstruction model with better contrast; tight contrast bounds.",
    limitation: "Not applicable to k-out-of-n schemes when both n and k exceed 2.",
  },
  {
    paper: "P3 Ateniese et al.",
    year: "1996",
    contribution: "Two constructions for general access structures; share-size bounds; new k-out-of-n technique; graph-based access structures.",
    limitation: "Share size is the cost it bounds. No other limitation stated in the abstract; full text not verified.",
  },
  {
    paper: "P4 Blundo et al.",
    year: "1996",
    contribution: "Contrast analysis of k-out-of-n schemes; complete characterisation of optimal 2-out-of-n schemes.",
    limitation: "For k greater than 2, only upper and lower bounds on optimal contrast.",
  },
  {
    paper: "P5 Hou",
    year: "2003",
    contribution: "Gray-level and colour sharing via halftoning and CMY colour decomposition; compatible with black-and-white schemes.",
    limitation: "Its four-share colour scheme was later shown secure only for a few specific images (P10). Mode A implements the verified 2-out-of-2 construction.",
  },
  {
    paper: "P6 Wang et al.",
    year: "2005",
    contribution: "(n,n) and (2,n) colour schemes with no pixel expansion, XOR reconstruction, perfect secrecy; relative difference 1 and 1/2.",
    limitation: "Needs a computing step (XOR) instead of eye-only stacking; (k,n) XOR scheme without expansion left as future work.",
  },
  {
    paper: "P7 Ross & Othman",
    year: "2011",
    contribution: "Visual cryptography applied to biometric templates (fingerprint and face) across independent trusted databases.",
    limitation: "Requires precise registration and alignment of biometric features before sharing.",
  },
  {
    paper: "P8 Rura et al.",
    year: "2017",
    contribution: "Online voting verification using visual cryptography combined with steganography for receipt-free verifiable elections.",
    limitation: "Ballot reconstruction requires both physical receipt and electronic verification tally.",
  },
  {
    paper: "P9 Mursi et al. (survey)",
    year: "2014",
    contribution: "Overview of basic visual cryptography constructions, techniques derived from them, and real-world application paradigms.",
    limitation: "Overview by design; proposes no new scheme. Abstract-level verification only.",
  },
  {
    paper: "P10 Leung et al.",
    year: "2008",
    contribution: "Security analysis of Hou's 4-share scheme: demonstrates that certain constructions allow an attacker to succeed with probability 4/7 from two shares.",
    limitation: "Emphasizes the strict necessity of verified independent channel randomisation implemented in our Mode A.",
  },
];

const SOURCE_KEY_DATA = [
  { id: "P1", citation: 'M. Naor and A. Shamir, "Visual Cryptography", EUROCRYPT 1994, LNCS 950 (Springer, 1995), pp. 1-12.', url: "https://doi.org/10.1007/BFb0053419", read: "Full text" },
  { id: "P2", citation: 'M. Naor and A. Shamir, "Visual Cryptography II: Improving the Contrast Via the Cover Base", Cryptology ePrint Archive 1996/007.', url: "https://eprint.iacr.org/1996/007", read: "ePrint" },
  { id: "P3", citation: 'G. Ateniese, C. Blundo, A. De Santis, D. R. Stinson, "Visual Cryptography for General Access Structures", ECCC Report TR96-012, 1996.', url: "https://eccc.weizmann.ac.il/report/1996/012", read: "ECCC report" },
  { id: "P4", citation: 'C. Blundo, A. De Santis, D. R. Stinson, "On the Contrast in Visual Cryptography Schemes", Cryptology ePrint Archive 1996/013.', url: "https://eprint.iacr.org/1996/013", read: "ePrint" },
  { id: "P5", citation: 'Y.-C. Hou, "Visual Cryptography for Color Images", Pattern Recognition 36(7), 2003, pp. 1619-1629.', url: "https://ir.lib.ncu.edu.tw/handle/987654321/31614", read: "NCU repository" },
  { id: "P6", citation: 'D. Wang, L. Zhang, N. Ma, X. Huang, "Secret Color Images Sharing Schemes Based on XOR Operation", Cryptology ePrint Archive 2005/372.', url: "https://eprint.iacr.org/2005/372", read: "ePrint" },
  { id: "P7", citation: 'A. Ross and A. Othman, "Visual Cryptography for Biometric Privacy", IEEE Computer Society, 2011.', url: "https://www.infona.pl/resource/bwmeta1.element.ieee-art-000005658142", read: "Infona record" },
  { id: "P8", citation: 'L. Rura, B. Issac, M. K. Haldar, "Online Voting System Based on Steganography and Visual Cryptography", CIT. Journal of Computing and Information Technology 25(1), 2017, pp. 47-61.', url: "https://hrcak.srce.hr/en/179239", read: "Hrčak open access" },
  { id: "P9", citation: 'O. Mursi, A. Salama, H. Mansour, "Visual Cryptography Schemes: A Comprehensive Survey", ERMT 3(11), 2014, pp. 141-149.', url: "http://www.ermt.net/docs/papers/Volume_3/11_November2014/V3N11-141.pdf", read: "ERMT paper" },
  { id: "P10", citation: 'C. Leung, W. Ng, D. Wong, "On the Security of a Visual Cryptography Scheme for Color Images", Cryptology ePrint Archive 2008/223.', url: "https://eprint.iacr.org/2008/223", read: "ePrint" },
];

export function init() {
  const panel = document.getElementById("panel-about");
  if (!panel) return;

  panel.textContent = "";

  const container = el("div", { className: "about-container" });

  function createAccordion(title, contentEl, defaultOpen = false) {
    const details = el("details", { className: "about-details card" });
    if (defaultOpen) details.open = true;

    const summary = el("summary", { className: "about-summary" }, [
      createIcon("i-info"),
      el("span", { style: "font-weight: 650; font-size: 1.05rem;" }, title),
    ]);
    details.appendChild(summary);

    const body = el("div", { className: "about-content" });
    body.appendChild(contentEl);
    details.appendChild(body);

    return details;
  }

  // Section A: What is Visual Cryptography
  const secA = el("div", {});
  const listA = el("ul", { style: "padding-left: 20px; display: flex; flex-direction: column; gap: 8px;" });
  WHAT_IS_VC_BULLETS.forEach((b) => listA.appendChild(el("li", {}, b)));
  secA.appendChild(listA);
  container.appendChild(createAccordion("A. What is Visual Cryptography", secA, true));

  // Section B: How Colour Visual Cryptography Works
  const secB = el("div", {});
  const listB = el("ul", { style: "padding-left: 20px; display: flex; flex-direction: column; gap: 8px;" });
  COLOUR_VC_BULLETS.forEach((b) => listB.appendChild(el("li", {}, b)));
  secB.appendChild(listB);
  container.appendChild(createAccordion("B. Colour Visual Cryptography (Mode A & Mode B)", secB, true));

  // Section C: Why Visual Cryptography Matters
  const secC = el("div", {});
  const listC = el("ul", { style: "padding-left: 20px; display: flex; flex-direction: column; gap: 8px;" });
  WHY_IT_MATTERS_BULLETS.forEach((b) => listC.appendChild(el("li", {}, b)));
  secC.appendChild(listC);
  container.appendChild(createAccordion("C. Why Visual Cryptography Matters (Biometrics & Voting)", secC));

  // Section D: Architectural Modules
  const secD = el("div", {});
  const modTable = el("table", { className: "leakage-table" }, [
    el("thead", {}, [
      el("tr", {}, [
        el("th", {}, "Module"),
        el("th", {}, "Name"),
        el("th", {}, "Architectural Purpose"),
      ]),
    ]),
    el("tbody", {}, MODULES_DATA.map((m) =>
      el("tr", {}, [
        el("td", { className: "font-mono", style: "font-weight: 600;" }, m.module),
        el("td", { style: "font-weight: 550;" }, m.name),
        el("td", {}, m.purpose),
      ])
    )),
  ]);
  secD.appendChild(el("div", { className: "table-wrapper" }, [modTable]));
  container.appendChild(createAccordion("D. System Architecture Modules (M1–M6)", secD));

  // Section E: Known Limitations & Cryptographic Bounds
  const secE = el("div", {});
  const listE = el("ul", { style: "padding-left: 20px; display: flex; flex-direction: column; gap: 8px;" });
  LIMITATIONS_DATA.forEach((b) => listE.appendChild(el("li", {}, b)));
  secE.appendChild(listE);
  container.appendChild(createAccordion("E. Cryptographic Bounds & Known Limitations (C-1 to C-5)", secE));

  // Section F: Literature Survey & Landmark Papers
  const secF = el("div", {});
  const litTable = el("table", { className: "literature-table leakage-table" }, [
    el("thead", {}, [
      el("tr", {}, [
        el("th", {}, "Paper"),
        el("th", {}, "Year"),
        el("th", {}, "Key Contribution"),
        el("th", {}, "Limitations / Boundaries"),
      ]),
    ]),
    el("tbody", {}, LITERATURE_DATA.map((l) =>
      el("tr", {}, [
        el("td", { style: "font-weight: 650; white-space: nowrap;" }, l.paper),
        el("td", { className: "font-mono" }, l.year),
        el("td", {}, l.contribution),
        el("td", { className: "help-text" }, l.limitation),
      ])
    )),
  ]);
  secF.appendChild(el("div", { className: "table-wrapper" }, [litTable]));
  container.appendChild(createAccordion("F. Literature Survey Matrix (P1–P10)", secF));

  // Section G: Direct Academic Citations & DOI Links
  const secG = el("div", {});
  const srcTable = el("table", { className: "leakage-table" }, [
    el("thead", {}, [
      el("tr", {}, [
        el("th", {}, "ID"),
        el("th", {}, "Academic Citation"),
        el("th", {}, "Source Link"),
      ]),
    ]),
    el("tbody", {}, SOURCE_KEY_DATA.map((s) =>
      el("tr", {}, [
        el("td", { className: "font-mono", style: "font-weight: 700; color: var(--accent);" }, s.id),
        el("td", {}, s.citation),
        el("td", {}, [
          el("a", { href: s.url, target: "_blank", rel: "noopener noreferrer", style: "color: var(--accent); font-weight: 600;" }, `${s.read} \u2197`),
        ]),
      ])
    )),
  ]);
  secG.appendChild(el("div", { className: "table-wrapper" }, [srcTable]));
  container.appendChild(createAccordion("G. Citation Key & DOI References", secG));

  // Section H: Team & Institutional Attribution
  const topRow = el("div", { className: "about-team-header", style: { display: "flex", "align-items": "center", "justify-content": "center", gap: "24px", "margin-bottom": "20px", "flex-wrap": "wrap" } }, [
    el("img", { src: "/static/img/sspu-logo.png", alt: "SSPU Logo", style: { height: "72px", width: "auto", "object-fit": "contain" } }),
    el("div", { style: { "text-align": "left" } }, [
      el("h3", { textContent: "Symbiosis Skills and Professional University", style: { "margin-bottom": "4px" } }),
      el("p", { textContent: "\u201C\u0935\u0938\u0941\u0927\u0948\u0935 \u0915\u0941\u091f\u0941\u092e\u094d\u092c\u0915\u092e\u094d\u201D \u00B7 The World is One Family", style: { color: "var(--accent)", "font-style": "italic", "margin-bottom": "4px" } }),
      el("p", { textContent: "School of Computer Science & Engineering \u00B7 Kiwale, Pune", style: { "font-size": "0.85rem", color: "var(--muted)" } }),
    ]),
  ]);

  const teamCards = [
    { name: "Shreyash Dixit", role: "Lead Engineer", sub: "Full-Stack & Algorithms" },
    { name: "Team Member 2", role: "Security", sub: "Cryptanalysis & Bounds" },
    { name: "Team Member 3", role: "Frontend", sub: "UI/UX & Accessibility" },
    { name: "Team Member 4", role: "QA & Verification", sub: "Test Suites & Evaluation" },
  ];

  const gridRow = el("div", { style: { display: "grid", "grid-template-columns": "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", "margin-top": "16px" } },
    teamCards.map((m) =>
      el("div", { className: "card", style: { padding: "12px" } }, [
        el("h4", { textContent: m.name, style: { "font-size": "0.95rem" } }),
        el("p", { textContent: m.role, style: { color: "var(--accent)", "font-size": "0.8rem", "font-weight": "600" } }),
        el("p", { textContent: m.sub, className: "help-text" }),
      ])
    )
  );

  const secH = el("div", { style: { "text-align": "center", padding: "16px 0" } }, [topRow, gridRow]);
  container.appendChild(createAccordion("H. Team & Symbiosis Skills University", secH, true));

  panel.appendChild(container);
}
