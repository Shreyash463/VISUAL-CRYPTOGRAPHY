export interface TeamMember {
  name: string;
}

export interface ResearchPaper {
  id: string;
  title: string;
  authors: string;
  venue: string;
  url: string;
  desc: string;
}

export interface ProjectConfig {
  projectName: string;
  projectAlias: string;
  subtitle: string;
  institution: string;
  universityShort: string;
  motto: string;
  reviewStage: string;
  academicYear: string;
  team: {
    name: string;
    members: TeamMember[];
  };
  papers: ResearchPaper[];
}

export const PROJECT_CONFIG: ProjectConfig = {
  projectName: "VeilShare",
  projectAlias: "Visual Cryptography Studio",
  subtitle: "Semester Integrated Project · Final Review",
  institution: "Symbiosis Skills and Professional University (SSPU), Pune",
  universityShort: "SSPU",
  motto: "वसुधैव कुटुम्बकम् (Vasudhaiva Kutumbakam — The World is One Family)",
  reviewStage: "Final Review",
  academicYear: "2026-2027",
  team: {
    name: "VeilShare Team",
    members: [
      { name: "Shreyash" },
      { name: "Ayushi" },
      { name: "Niharika" },
      { name: "Yash" },
      { name: "Kunal" },
    ],
  },
  papers: [
    { id: "P1", title: "Visual Cryptography", authors: "Moni Naor & Adi Shamir", venue: "EUROCRYPT 1994", url: "https://doi.org/10.1007/BFb0053419", desc: "Foundational visual cryptography scheme using 2×2 subpixel expansions and physical transparency superposition." },
    { id: "P2", title: "Visual Cryptography II: Improving the Contrast", authors: "Moni Naor & Adi Shamir", venue: "IACR 1996", url: "https://eprint.iacr.org/1996/007", desc: "Techniques for optimal contrast and pixel expansion in k-out-of-n secret sharing." },
    { id: "P3", title: "Visual Cryptography for General Access Structures", authors: "G. Ateniese, C. Blundo, A. De Santis, D. R. Stinson", venue: "ECCC 1996", url: "https://eccc.weizmann.ac.il/report/1996/012", desc: "Generalized mathematical models for qualified and forbidden sets of shares." },
    { id: "P4", title: "On the Contrast in Visual Cryptography Schemes", authors: "C. Blundo, A. De Santis, D. R. Stinson", venue: "IACR 1996", url: "https://eprint.iacr.org/1996/013", desc: "Theoretical bounds and characterization of contrast in visual secret sharing schemes." },
    { id: "P5", title: "Visual Cryptography for Color Images", authors: "Young-Chang Hou", venue: "Pattern Recognition 2003", url: "https://ir.lib.ncu.edu.tw/handle/987654321/31614", desc: "Decomposition into CMY subtractive primaries with Floyd-Steinberg halftoning and Naor-Shamir subpixel sharing." },
    { id: "P6", title: "Secret Color Images Sharing Schemes Based on XOR Operation", authors: "D. Wang, L. Zhang, N. Ma, X. Huang", venue: "IACR 2005", url: "https://eprint.iacr.org/2005/372", desc: "Bitwise XOR-based secret sharing eliminating pixel expansion and enabling lossless digital reconstruction." },
    { id: "P7", title: "Visual Cryptography for Biometric Privacy", authors: "Arun Ross & Abeer Othman", venue: "IEEE Computer Society 2011", url: "https://www.infona.pl/resource/bwmeta1.element.ieee-art-000005658142", desc: "Decentralized storage of biometric face and fingerprint templates across distinct trusted databases." },
    { id: "P8", title: "Online Voting System with Steganography & Visual Cryptography", authors: "L. Rura, B. Issac, M. K. Haldar", venue: "CIT 2017", url: "https://hrcak.srce.hr/en/179239", desc: "Verifiable ballot secret sharing preventing insider election tampering." },
    { id: "P9", title: "Visual Cryptography Schemes: A Comprehensive Survey", authors: "O. Mursi, A. Salama, H. Mansour", venue: "ERMT 2014", url: "http://www.ermt.net/docs/papers/Volume_3/11_November2014/V3N11-141.pdf", desc: "Comparative taxonomy of traditional, extended, halftone, and progressive visual cryptography." },
    { id: "P10", title: "On the Security of a Visual Cryptography Scheme for Color Images", authors: "C. Leung, W. Ng, D. Wong", venue: "IACR 2008", url: "https://eprint.iacr.org/2008/223", desc: "Security and information-theoretic leakage bounds on color visual cryptography constructions." },
  ],
};
