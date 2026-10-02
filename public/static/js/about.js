/**
 * About & References tab module (Section 10, Sections A to H).
 */
import { el, createIcon } from "./ui.js";

const WHAT_IS_VC_BULLETS = [
  "A secret image is turned into several noise-like shares and becomes visible only when the right shares are combined.",
  "Naor and Shamir introduced it at EUROCRYPT 1994; decoding is done by laying printed transparencies over each other, so the receiver needs no key knowledge and performs no cryptographic computation.",
  "The basic scheme is perfectly secure: even an attacker with unlimited computing power cannot tell from fewer than the required shares whether a pixel of the secret is black or white.",
  "k-out-of-n: any k of n shares reveal the image, any k-1 give no information; the original problem is 2-out-of-2.",
  "Each secret pixel is replaced by a small block of subpixels in every share, chosen by a random coin toss per pixel, so one share looks like random noise.",
];

const WHY_IT_MATTERS_BULLETS = [
  "P7 uses it to protect biometric data (face, fingerprint, iris) in central databases: a face image is split into two sheets stored on two separate servers, revealed only when both are available.",
  "P8 uses it as one component of a web-based online voting system.",
  "P9 reviews applications that use visual cryptography.",
  "Because decoding needs no cryptographic expertise, it suits a web tool for non-specialists.",
];

const MODULES_DATA = [
  { module: "M1", name: "Input image", purpose: "Accept and validate uploaded secret images (formats, dimensions, sizes)." },
  { module: "M2", name: "Preprocessing", purpose: "Convert secret images to binary pixel matrices via Floyd–Steinberg halftoning or fixed thresholding." },
  { module: "M3", name: "Share generation", purpose: "Generate noise-like shares using Naor–Shamir 2×2 overlay blocks or Wang et al. XOR secret sharing." },
  { module: "M4", name: "Reconstruction", purpose: "Combine shares via physical transparency stacking simulation (OR) or mathematical XOR." },
  { module: "M5", name: "User interface", purpose: "Provide an accessible web test harness and educational demonstration suite." },
  { module: "M6", name: "Share storage and delivery", purpose: "Optional persistent storage and transmission (not included in this stateless build)." },
];

const LIMITATIONS_DATA = [
  "C-1 Overlay mode inherently loses contrast and expands pixels (P1, P2); figures are measured and reported.",
  "C-2 P2's Cover model is not usable for k,n above 2, so it is not planned.",
  "C-3 XOR mode is limited to (n,n) and (2,n) because P6 leaves a general (k,n) version open; this build offers (n,n) only.",
  "C-4 Colour sharing only after a security review, given P10.",
  "C-5 Shares must keep identical dimensions so they align pixel by pixel.",
  "k-out-of-n sharing is not included in this build.",
];

const LITERATURE_DATA = [
  {
    paper: "P9 Mursi et al. (survey)",
    year: "2014",
    contribution: "Overview of basic visual cryptography constructions, techniques derived from them, and applications.",
    limitation: "Overview by design; proposes no new scheme. Abstract-level verification only.",
  },
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
    contribution: "Gray-level and colour sharing via halftoning and colour decomposition; compatible with black-and-white schemes.",
    limitation: "Its four-share colour scheme was later shown secure only for a few specific images (P10).",
  },
  {
    paper: "P6 Wang et al.",
    year: "2005",
    contribution: "(n,n) and (2,n) colour schemes with no pixel expansion, XOR reconstruction, perfect secrecy; relative difference 1 and 1/2.",
    limitation: "Needs a computing step (XOR) instead of eye-only stacking; (k,n) XOR scheme without expansion left as future work.",
  },
  {
    paper: "P10 Leung et al.",
    year: "2008",
    contribution: "Security analysis of Hou's scheme: attacker succeeds with probability 4/7 from two shares.",
    limitation: "Covers one scheme; the abstract offers no replacement.",
  },
];

const SOURCE_KEY_DATA = [
  {
    id: "P1",
    citation: 'M. Naor and A. Shamir, "Visual Cryptography", EUROCRYPT 1994, LNCS 950 (Springer, 1995), pp. 1-12.',
    url: "https://doi.org/10.1007/BFb0053419",
    read: "Full text",
  },
  {
    id: "P2",
    citation: 'M. Naor and A. Shamir, "Visual Cryptography II: Improving the Contrast Via the Cover Base", Cryptology ePrint Archive 1996/007.',
    url: "https://eprint.iacr.org/1996/007",
    read: "Abstract",
  },
  {
    id: "P3",
    citation: 'G. Ateniese, C. Blundo, A. De Santis, D. R. Stinson, "Visual Cryptography for General Access Structures", Information and Computation, 1996 (ECCC TR96-012).',
    url: "https://eccc.weizmann.ac.il/report/1996/012",
    read: "Abstract",
  },
  {
    id: "P4",
    citation: 'C. Blundo, A. De Santis, D. R. Stinson, "On the Contrast in Visual Cryptography Schemes", Cryptology ePrint Archive 1996/013.',
    url: "https://eprint.iacr.org/1996/013",
    read: "Abstract",
  },
  {
    id: "P5",
    citation: 'Y.-C. Hou, "Visual Cryptography for Color Images", Pattern Recognition 36(7), 1619-1629, 2003.',
    url: "https://ir.lib.ncu.edu.tw/handle/987654321/31614",
    read: "Abstract (truncated)",
  },
  {
    id: "P6",
    citation: 'D.-S. Wang, L. Zhang, N. Ma, L.-S. Huang, "Secret Color Images Sharing Schemes Based on XOR Operation", Cryptology ePrint Archive 2005/372.',
    url: "https://eprint.iacr.org/2005/372",
    read: "Full text",
  },
  {
    id: "P7",
    citation: 'A. Ross and A. Othman, "Visual Cryptography for Biometric Privacy", IEEE Trans. Information Forensics and Security, 2011.',
    url: "https://www.infona.pl/resource/bwmeta1.element.ieee-art-000005658142",
    read: "Abstract",
  },
  {
    id: "P8",
    citation: 'L. Rura, B. Issac, M. K. Haldar, "Online Voting System Based on Image Steganography and Visual Cryptography", J. Computing and Information Technology 25(1), 47-61, 2017. DOI 10.20532/cit.2017.1003224.',
    url: "https://hrcak.srce.hr/en/179239",
    read: "Abstract",
  },
  {
    id: "P9",
    citation: 'M. Mursi, M. Salama, M. Mansour, "Visual Cryptography Schemes: A Comprehensive Survey", Int. J. Emerging Research in Management & Technology 3(11), 2014.',
    url: "http://www.ermt.net/docs/papers/Volume_3/11_November2014/V3N11-141.pdf",
    read: "Abstract",
  },
  {
    id: "P10",
    citation: 'B. W. Leung, F. Y. Ng, D. S. Wong, "On the Security of a Visual Cryptography Scheme for Color Images", Cryptology ePrint Archive 2008/223.',
    url: "https://eprint.iacr.org/2008/223",
    read: "Abstract",
  },
  {
    id: "Opt.",
    citation: "D. R. Stinson, Visual Cryptography page (explainer, not a paper; Introduction only).",
    url: "https://cs.uwaterloo.ca/~dstinson/visual.html",
    read: "Page",
  },
];

const VERIFICATION_NOTE =
  "Only P1 and P6 were read in full. For P2, P3, P4 the full texts are PostScript or unreadable PDFs, so only abstracts were read. " +
  "For P7, P8, P9, P10 the full text was blocked to automated access, so only abstracts were used (P9's abstract was confirmed on a university author-profile record). " +
  "For P5 only a truncated abstract was reachable, so its method details come from the supplied summary. " +
  "P1's proceedings volume is dated 1995; the conference was 1994. " +
  "Where a source was abstract-only, claims are kept to what the abstract states.";

function createAccordion(title, iconId, isOpen = false) {
  const details = document.createElement("details");
  details.className = "about-details card";
  if (isOpen) details.open = true;

  const summary = document.createElement("summary");
  summary.className = "about-summary";
  summary.appendChild(createIcon(iconId));
  const span = document.createElement("span");
  span.textContent = ` ${title}`;
  summary.appendChild(span);
  details.appendChild(summary);

  const content = document.createElement("div");
  content.className = "about-content";
  details.appendChild(content);

  return { details, content };
}

export function init() {
  const panel = document.getElementById("panel-about");
  if (!panel) return;

  panel.textContent = "";

  // Section A: What is visual cryptography? (Open by default)
  const secA = createAccordion("What is visual cryptography?", "i-info", true);
  const ulA = el("ul", { className: "help-text", style: { paddingLeft: "20px" } });
  WHAT_IS_VC_BULLETS.forEach((text) => {
    ulA.appendChild(el("li", { style: { marginBottom: "8px" } }, text));
  });
  secA.content.appendChild(ulA);
  panel.appendChild(secA.details);

  // Section B: Why it matters (Open by default)
  const secB = createAccordion("Why it matters", "i-check", true);
  const ulB = el("ul", { className: "help-text", style: { paddingLeft: "20px" } });
  WHY_IT_MATTERS_BULLETS.forEach((text) => {
    ulB.appendChild(el("li", { style: { marginBottom: "8px" } }, text));
  });
  secB.content.appendChild(ulB);
  panel.appendChild(secB.details);

  // Section C: How this tool works
  const secC = createAccordion("How this tool works", "i-layers", false);
  secC.content.appendChild(el("h4", { className: "metric-card-title" }, "Encode Path"));

  const encodeFlow = el("div", { className: "diagram-boxes" }, [
    el("div", { className: "diagram-box" }, "Upload"),
    createIcon("i-arrow-right"),
    el("div", { className: "diagram-box" }, "Validate"),
    createIcon("i-arrow-right"),
    el("div", { className: "diagram-box" }, "Preprocess"),
    createIcon("i-arrow-right"),
    el("div", { className: "diagram-box" }, "Generate Shares"),
    createIcon("i-arrow-right"),
    el("div", { className: "diagram-box" }, "Shares Out"),
  ]);
  secC.content.appendChild(encodeFlow);

  secC.content.appendChild(el("h4", { className: "metric-card-title", style: { marginTop: "16px" } }, "Decode Path"));
  const decodeFlow = el("div", { className: "diagram-boxes" }, [
    el("div", { className: "diagram-box" }, "Shares In"),
    createIcon("i-arrow-right"),
    el("div", { className: "diagram-box" }, "Reconstruct"),
    createIcon("i-arrow-right"),
    el("div", { className: "diagram-box" }, "Result Shown"),
  ]);
  secC.content.appendChild(decodeFlow);

  secC.content.appendChild(
    el(
      "p",
      { className: "help-text", style: { marginTop: "12px" } },
      "Generic block diagram of a web-based visual cryptography system. Share storage and delivery (M6) is optional and not included in this build."
    )
  );
  panel.appendChild(secC.details);

  // Section D: Modules
  const secD = createAccordion("Modules", "i-sliders", false);
  const tableWrapperD = el("div", { className: "table-wrapper" });
  const tableD = el("table", { className: "leakage-table" });
  tableD.appendChild(
    el("thead", {}, [
      el("tr", {}, [
        el("th", {}, "Module"),
        el("th", {}, "Name"),
        el("th", {}, "Purpose"),
      ]),
    ])
  );
  const tbodyD = el("tbody");
  MODULES_DATA.forEach((m) => {
    tbodyD.appendChild(
      el("tr", {}, [
        el("td", { className: "font-mono" }, m.module),
        el("td", { className: "form-label" }, m.name),
        el("td", {}, m.purpose),
      ])
    );
  });
  tableD.appendChild(tbodyD);
  tableWrapperD.appendChild(tableD);
  secD.content.appendChild(tableWrapperD);
  panel.appendChild(secD.details);

  // Section E: Known limitations (constraints)
  const secE = createAccordion("Known limitations (constraints)", "i-alert", false);
  const ulE = el("ul", { className: "help-text", style: { paddingLeft: "20px" } });
  LIMITATIONS_DATA.forEach((text) => {
    ulE.appendChild(el("li", { style: { marginBottom: "8px" } }, text));
  });
  secE.content.appendChild(ulE);
  panel.appendChild(secE.details);

  // Section F: Literature at a glance (Sticky header, zebra rows, scroll wrapper)
  const secF = createAccordion("Literature at a glance", "i-image", false);
  const tableWrapperF = el("div", { className: "table-wrapper", style: { maxHeight: "400px", overflow: "auto" } });
  const tableF = el("table", { className: "literature-table leakage-table" });
  tableF.appendChild(
    el("thead", {}, [
      el("tr", {}, [
        el("th", {}, "Paper"),
        el("th", {}, "Year"),
        el("th", {}, "Contribution"),
        el("th", {}, "Limitation"),
      ]),
    ])
  );
  const tbodyF = el("tbody");
  LITERATURE_DATA.forEach((row) => {
    tbodyF.appendChild(
      el("tr", {}, [
        el("td", { className: "form-label" }, row.paper),
        el("td", { className: "font-mono" }, row.year),
        el("td", {}, row.contribution),
        el("td", {}, row.limitation),
      ])
    );
  });
  tableF.appendChild(tbodyF);
  tableWrapperF.appendChild(tableF);
  secF.content.appendChild(tableWrapperF);
  panel.appendChild(secF.details);

  // Section G: Source key
  const secG = createAccordion("Source key", "i-link", false);
  const ulG = el("ul", { className: "help-text", style: { paddingLeft: "20px" } });
  SOURCE_KEY_DATA.forEach((s) => {
    const isFullText = s.read === "Full text";
    const badgeClass = isFullText ? "badge badge-success" : "badge badge-neutral";
    const li = el("li", { style: { marginBottom: "12px" } }, [
      el("strong", {}, `${s.id} `),
      document.createTextNode(`${s.citation} `),
      el("a", { href: s.url, target: "_blank", rel: "noopener noreferrer" }, s.url),
      document.createTextNode(" "),
      el("span", { className: badgeClass }, [
        createIcon(isFullText ? "i-check" : "i-info", "icon icon-sm"),
        ` Read: ${s.read}`,
      ]),
    ]);
    ulG.appendChild(li);
  });
  secG.content.appendChild(ulG);

  const verifNote = el("p", { className: "help-text", style: { marginTop: "16px" } }, VERIFICATION_NOTE);
  secG.content.appendChild(verifNote);
  panel.appendChild(secG.details);

  // Section H: Team block (Card with 2 columns on desktop)
  const secH = el("section", { className: "card", style: { marginTop: "16px" } });
  secH.appendChild(el("h2", { className: "card-title" }, "Team"));

  const teamContainer = el("div", { className: "metrics-grid" });
  secH.appendChild(teamContainer);
  panel.appendChild(secH);

  fetch("/static/team.json")
    .then((r) => r.json())
    .then((team) => {
      const placeholder = "__________ (to be filled in)";
      const teamName = team.team_name && team.team_name.trim() ? team.team_name : placeholder;

      const itemTeam = el("div", { className: "metric-card card" }, [
        el("span", { className: "metric-card-title" }, "Team Name"),
        el("span", { className: "font-mono" }, teamName),
      ]);
      teamContainer.appendChild(itemTeam);

      const members = Array.isArray(team.members) ? team.members : [];
      for (let i = 0; i < 4; i++) {
        const mem = members[i] && members[i].trim() ? members[i] : placeholder;
        const itemMember = el("div", { className: "metric-card card" }, [
          el("span", { className: "metric-card-title" }, `Team Member ${i + 1}`),
          el("span", { className: "font-mono" }, mem),
        ]);
        teamContainer.appendChild(itemMember);
      }
    })
    .catch(() => {
      const placeholder = "__________ (to be filled in)";
      teamContainer.appendChild(
        el("div", { className: "metric-card card" }, [
          el("span", { className: "metric-card-title" }, "Team Name"),
          el("span", { className: "font-mono" }, placeholder),
        ])
      );
      for (let i = 0; i < 4; i++) {
        teamContainer.appendChild(
          el("div", { className: "metric-card card" }, [
            el("span", { className: "metric-card-title" }, `Team Member ${i + 1}`),
            el("span", { className: "font-mono" }, placeholder),
          ])
        );
      }
    });
}
