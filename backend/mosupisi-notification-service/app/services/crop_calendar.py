from dataclasses import dataclass


@dataclass
class Milestone:
    day: int
    title_en: str
    body_en: str
    title_st: str
    body_st: str


CROP_CALENDAR: dict[str, list[Milestone]] = {
    "maize": [
        Milestone(
            day=7,
            title_en="Maize Germination Check",
            body_en="Your maize was planted 7 days ago. Check that at least 80% of seeds have germinated. Replant any bare patches.",
            title_st="Hlahloba ho Mela ha Poone",
            body_st="Poone ea hau e jaliloe matsatsi a 7. Hlahloba hore bonyane 80% ea dipeo di metse. Jala hape libaka tse se nang letho.",
        ),
        Milestone(
            day=14,
            title_en="First Fertiliser Application Due",
            body_en="Time to apply basal fertiliser (2:3:2 or similar). Apply 150kg/ha in a band 5cm from the plant base.",
            title_st="Nako ea Ho Sebelisa Manyolo a Pele",
            body_st="Nako ea ho sebelisa manyolo a motheo. Sebelisa 150kg/ha haufi le motheo oa mmea.",
        ),
        Milestone(
            day=21,
            title_en="First Weeding Window",
            body_en="Your maize is 3 weeks old — weeds are competing for nutrients. Weed now before they establish deep roots.",
            title_st="Nako ea Pele ea Ho Tlosa Joang",
            body_st="Poone ea hau e le libeke tse 3. Joang bo ja manyolo. Tlosa joang kajeno.",
        ),
        Milestone(
            day=35,
            title_en="Maize Top-Dressing Due",
            body_en="Apply top-dressing nitrogen fertiliser (CAN/LAN) at 150kg/ha. Place 10cm from stems to avoid burning.",
            title_st="Nako ea Manyolo a Tlase — Poone",
            body_st="Sebelisa manyolo a nitrogen (CAN/LAN) ho 150kg/ha. Beha 10cm ho tsoa mesong.",
        ),
        Milestone(
            day=45,
            title_en="Second Weeding",
            body_en="Complete final weeding before canopy closure. After this stage weeds have less impact.",
            title_st="Palo ea Bobeli ea Ho Tlosa Joang",
            body_st="Phetha ho tlosa joang pele liphahlo li koalana.",
        ),
        Milestone(
            day=70,
            title_en="Watch for Tasselling",
            body_en="Your maize should be tasselling. Ensure adequate moisture at this critical pollination stage. Stress now reduces yield by up to 30%.",
            title_st="Sheba Mehlahla ea Poone",
            body_st="Poone ea hau e lokela ho ntša mehlahla. Etsa bonnete ba mongobo. Khatello joale e fokotsa kotulo ho fihla 30%.",
        ),
        Milestone(
            day=100,
            title_en="Grain Fill Stage",
            body_en="Maize is filling grain. Maintain irrigation if dry. Check for stalk borer damage.",
            title_st="Sebaka sa Ho Tlala ha Lijwi",
            body_st="Poone e tlala lijwi. Boloka ho nosetsa haeba ho omile. Hlahloba lefu la motse.",
        ),
        Milestone(
            day=120,
            title_en="Harvest Window Approaching",
            body_en="Your maize harvest window opens in approximately 2 weeks. Prepare storage.",
            title_st="Nako ea Kotulo e Haufi",
            body_st="Nako ea kotulo ea poone e bula ka matsatsi a 14. Lokisa sebaka sa polokelo.",
        ),
        Milestone(
            day=135,
            title_en="Harvest Now",
            body_en="Time to harvest your maize. Moisture content should be below 25% for safe storage.",
            title_st="Kotula Joale",
            body_st="Nako ea ho kotula poone ea hau. Mongobo o lokela ho ba tlase ho 25%.",
        ),
    ],
    "sorghum": [
        Milestone(day=10, title_en="Sorghum Germination Check",
            body_en="Check germination of your sorghum. Expect 60-70% emergence at 10 days.",
            title_st="Hlahloba ho Mela ha Mabele",
            body_st="Hlahloba ho mela ha mabele. Lebella 60-70% ho mela matsatsi a 10."),
        Milestone(day=21, title_en="Sorghum First Weeding",
            body_en="Weed your sorghum fields now. Sorghum is sensitive to weed competition in the first 30 days.",
            title_st="Palo ea Pele ea Ho Tlosa Joang — Mabele",
            body_st="Tlosa joang masimong a mabele joale."),
        Milestone(day=30, title_en="Fertiliser Application — Sorghum",
            body_en="Apply nitrogen fertiliser (CAN) at 100kg/ha.",
            title_st="Ho Sebelisa Manyolo — Mabele",
            body_st="Sebelisa manyolo a nitrogen (CAN) ho 100kg/ha."),
        Milestone(day=60, title_en="Head Formation — Sorghum",
            body_en="Sorghum is forming heads. Ensure adequate moisture. Most critical stage for yield.",
            title_st="Ho Thehoa ha Hloho — Mabele",
            body_st="Mabele a bopa lihlooho. Etsa bonnete ba mongobo."),
        Milestone(day=90, title_en="Bird Scaring Season Begins",
            body_en="Sorghum heads are attracting birds. Set up bird-scaring devices. Daily field visits critical.",
            title_st="Nako ea Ho Lesa Linonyana e Qala",
            body_st="Lihlooho tsa mabele li hohela linonyana. Beha lisebelisoa tsa ho lesa linonyana."),
        Milestone(day=110, title_en="Harvest Sorghum",
            body_en="Harvest when grain is hard and moisture below 20%. Dry for 5-7 days before threshing.",
            title_st="Kotula Mabele",
            body_st="Kotula ha lijwi li thata le mongobo o tlase ho 20%."),
    ],
    "legumes": [
        Milestone(day=7, title_en="Check Legume Nodulation",
            body_en="Dig up one plant and check roots for pink nitrogen-fixing nodules. If absent, inoculant may be needed.",
            title_st="Hlahloba Manopo a Linaoa",
            body_st="Epa mmea o le mong le ho hlahloba metso ea manopo a rosy."),
        Milestone(day=21, title_en="Legume First Weeding",
            body_en="Weed your legume fields. Legumes are poor competitors against weeds in early growth.",
            title_st="Palo ea Pele ea Ho Tlosa Joang — Linaoa",
            body_st="Tlosa joang masimong a linaoa."),
        Milestone(day=35, title_en="Flowering Stage — Legumes",
            body_en="Legumes are flowering. Do not apply pesticides during flowering to protect pollinators.",
            title_st="Sebaka sa Lipalesa — Linaoa",
            body_st="Linaoa li a palama. Se sebelise lithibela-kokonyana."),
        Milestone(day=55, title_en="Pod Fill — Legumes",
            body_en="Pods are filling. Maintain soil moisture. Check for aphid infestations.",
            title_st="Ho Tlala ha Likotoana — Linaoa",
            body_st="Likotoana li a tlala. Boloka mongobo oa mobu."),
        Milestone(day=70, title_en="Harvest Legumes",
            body_en="Ready when 80% of pods are brown and dry. Harvest in the morning to reduce pod shatter.",
            title_st="Kotula Linaoa",
            body_st="Li motle ha 80% ea likotoana li tšoeu. Kotula hoseng."),
    ],
    "beans": [
        Milestone(day=14, title_en="Bean Germination Check",
            body_en="Check germination — expect 85%+ emergence. Replant gaps.",
            title_st="Hlahloba ho Mela ha Linaoa",
            body_st="Hlahloba ho mela — lebella 85%+."),
        Milestone(day=30, title_en="Bean Weeding",
            body_en="Weed bean fields now. Keep rows clean for the first 40 days.",
            title_st="Ho Tlosa Joang — Linaoa",
            body_st="Tlosa joang masimong a linaoa joale."),
        Milestone(day=50, title_en="Bean Flowering",
            body_en="Beans are flowering. Avoid spraying. Ensure moisture during pod set.",
            title_st="Lipalesa tsa Linaoa",
            body_st="Linaoa li a palama. Qoba ho ata."),
        Milestone(day=75, title_en="Harvest Beans",
            body_en="Harvest dry beans when pods are fully brown. Thresh and dry before storage.",
            title_st="Kotula Linaoa",
            body_st="Kotula linaoa tse omileng ha likotoana li tšoeu."),
    ],
}


def get_due_milestones(crop_id: str, days_since_planted: int,
                       tolerance_days: int = 2) -> list[Milestone]:
    calendar = CROP_CALENDAR.get(crop_id.lower(), [])
    return [m for m in calendar if abs(m.day - days_since_planted) <= tolerance_days]