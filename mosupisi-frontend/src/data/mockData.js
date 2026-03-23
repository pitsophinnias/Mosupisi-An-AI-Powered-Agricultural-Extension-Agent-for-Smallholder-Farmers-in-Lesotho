// Mock farmer profile
export const mockFarmerProfile = {
  id: 1,
  mobile: "266-1234-5678",
  name: "Ntate Thabo",
  region: "Maseru",
  crops: ["maize", "sorghum"],
  language: "sesotho",
  createdAt: "2025-01-15T10:30:00Z"
};

// Mock weather data for 7 days
export const mockWeatherData = [
  {
    date: "2026-02-27",
    temp: { min: 15, max: 28 },
    rainChance: 20,
    condition: "sunny",
    alert: null
  },
  {
    date: "2026-02-28",
    temp: { min: 14, max: 26 },
    rainChance: 60,
    condition: "rainy",
    alert: "Heavy rainfall expected. Protect young crops."
  },
  {
    date: "2026-03-01",
    temp: { min: 13, max: 24 },
    rainChance: 80,
    condition: "stormy",
    alert: "Storm warning. Secure livestock and harvest ripe crops."
  },
  {
    date: "2026-03-02",
    temp: { min: 12, max: 23 },
    rainChance: 40,
    condition: "cloudy",
    alert: null
  },
  {
    date: "2026-03-03",
    temp: { min: 14, max: 25 },
    rainChance: 10,
    condition: "sunny",
    alert: null
  },
  {
    date: "2026-03-04",
    temp: { min: 16, max: 29 },
    rainChance: 5,
    condition: "sunny",
    alert: "High temperature. Ensure adequate irrigation."
  },
  {
    date: "2026-03-05",
    temp: { min: 15, max: 27 },
    rainChance: 30,
    condition: "partly cloudy",
    alert: null
  }
];

// Mock sample Q&A responses
export const mockSampleResponses = [
  {
    question: "Ke lokela ho jala poone neng?",
    question_en: "When should I plant maize?",
    answer: "Ho molemo ho jala poone ka Mphalane ho isa ho Pulungoana Maseru. Etsa bonnete ba hore mobu o mongobo ebile o futhumetse. Source: Lesotho Crop Calendar 2025.",
    answer_en: "It is best to plant maize from October to November in Maseru. Ensure the soil is moist and warm. Source: Lesotho Crop Calendar 2025.",
    timestamp: "2026-02-26T08:30:00Z",
    sources: ["Lesotho Crop Calendar 2025"]
  },
  {
    question: "How do I control fall armyworm in sorghum?",
    question_st: "Ke laola liboko tsa sorghum joang?",
    answer: "For fall armyworm control in sorghum: 1) Monitor fields regularly, 2) Use neem-based pesticides, 3) Practice crop rotation, 4) Conserve natural enemies. Source: Department of Crop Protection.",
    answer_st: "Ho laola liboko tsa sorghum: 1) Hlahloba masimo khafetsa, 2) Sebelisa meriana ea neem, 3) Potoloha lijalo, 4) Boloka lira tsa tlhaho. Source: Department of Crop Protection.",
    timestamp: "2026-02-25T14:15:00Z",
    sources: ["Department of Crop Protection"]
  },
  {
    question: "When is the best time to harvest legumes?",
    question_st: "Nako e ntle ea ho kotula linaoa ke neng?",
    answer: "Harvest legumes when pods turn yellow-brown and seeds rattle inside. For beans, this is typically 90-120 days after planting. Dry thoroughly before storage.",
    answer_st: "Kotula linaoa ha likhapetla li soeufala 'me peo e lla ka hare. Bakeng sa linaoa, hangata ke matsatsi a 90-120 kamora ho jala. Omisa hantle pele u boloka.",
    timestamp: "2026-02-24T11:45:00Z",
    sources: ["Legume Production Guide 2025"]
  },
  {
    question: "What are climate-smart practices for maize?",
    question_st: "Mekhoa ea ho sebetsana le maemo a leholimo bakeng sa poone ke efe?",
    answer: "Climate-smart practices: 1) Drought-tolerant varieties, 2) Conservation tillage, 3) Mulching to retain moisture, 4) Intercropping with legumes, 5) Early planting.",
    answer_st: "Mekhoa ea ho sebetsana le maemo a leholimo: 1) Mefuta e mamellang komello, 2) Ho lema ho sa senyang mobu, 3) Ho kwafatsa ho boloka mongobo, 4) Ho kopanya linaoa le poone, 5) Ho jala kapele.",
    timestamp: "2026-02-23T09:20:00Z",
    sources: ["Climate-Smart Agriculture Manual"]
  },
  {
    question: "How do I store maize to prevent weevils?",
    question_st: "Ke boloka poone joang hore e se jeoe ke boea?",
    answer: "Store maize: 1) Dry to 12-13% moisture, 2) Use hermetic bags or metal silos, 3) Add ash or diatomaceous earth, 4) Check regularly for pests.",
    answer_st: "Boloka poone: 1) Omisa hore e be mongobo oa 12-13%, 2) Sebelisa mekotla e koalehang kapa silo tsa tšepe, 3) Kenya molora kapa diatomaceous earth, 4) Hlahloba khafetsa bakeng sa likokonyana.",
    timestamp: "2026-02-22T16:10:00Z",
    sources: ["Post-Harvest Management Guide"]
  }
];

// Mock knowledge base (digitized bulletins)
export const mockKnowledgeBase = [
  {
    id: 1,
    title: "Maize Planting Guide",
    title_st: "Tataiso ea Ho Jala Poone",
    crop: "maize",
    content: "Plant maize at the onset of rains (October-November). Space rows 75cm apart and plants 25cm apart. Use 120kg/ha of fertilizer. Weed after 3-4 weeks.",
    content_st: "Jala poone ha lipula li qala (Mphalane-Pulungoana). Arohanya mela ka 75cm le limela ka 25cm. Sebelisa manyolo a 120kg/ha. Lehla kamora libeke tse 3-4.",
    source: "Ministry of Agriculture",
    year: 2025
  },
  {
    id: 2,
    title: "Sorghum Pest Management",
    title_st: "Taolo ea Likokonyana tsa Mabele",
    crop: "sorghum",
    content: "Major pests: stem borer, aphids, fall armyworm. Control: use resistant varieties, apply neem extract, introduce natural enemies like ladybirds.",
    content_st: "Likokonyana tse kholo: seboko, dintsi, liboko. Taolo: sebelisa mefuta e hanyetsanang, sebelasa motsoako oa neem, kenya lira tsa tlhaho.",
    source: "Crop Protection Department",
    year: 2024
  },
  {
    id: 3,
    title: "Legume Production Practices",
    title_st: "Mekhoa ea Ho Lema Linaoa",
    crop: "legumes",
    content: "Plant beans, peas, and lentils after maize. Use rhizobium inoculation for better nitrogen fixation. Harvest when pods are dry.",
    content_st: "Jala linaoa, lierekisi, ka mor'a poone. Sebelisa rhizobium bakeng sa ho lokisa nitrogen. Kotula ha likhapetla li omme.",
    source: "Legume Research Institute",
    year: 2025
  }
];

// Mock regions in Lesotho
export const regions = [
  "Maseru",
  "Leribe",
  "Mafeteng",
  "Mohale's Hoek",
  "Quthing",
  "Butha-Buthe",
  "Mokhotlong",
  "Thaba-Tseka"
];

// Mock crops
export const crops = [
  { id: "maize", name: "Maize", name_st: "Poone" },
  { id: "sorghum", name: "Sorghum", name_st: "Mabele" },
  { id: "legumes", name: "Legumes", name_st: "Linaoa" }
];

// Mock languages
export const languages = [
  { id: "en", name: "English" },
  { id: "st", name: "Sesotho" }
];