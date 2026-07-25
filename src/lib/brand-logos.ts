/**
 * Brand-to-domain mapping for logo fetching.
 * Uses logo.dev API for high-quality brand logos.
 * Token is read from NEXT_PUBLIC_LOGO_DEV_TOKEN env var.
 * Covers all 19 industries tracked in the India rAsh Index.
 */

const BRAND_DOMAINS: Record<string, string> = {
  // ── Technology & IT ──
  "Tata Consultancy Services": "tcs.com",
  "Infosys": "infosys.com",
  "Wipro": "wipro.com",
  "HCL Technologies": "hcltech.com",
  "Tech Mahindra": "techmahindra.com",
  "LTIMindtree": "ltimindtree.com",
  "Zoho": "zoho.com",
  "Freshworks": "freshworks.com",
  "Mphasis": "mphasis.com",
  "Persistent Systems": "persistent.com",
  "Coforge": "coforge.com",
  "NIIT Technologies": "niit-tech.com",
  "Zensar Technologies": "zensar.com",
  "Cyient": "cyient.com",
  "Happiest Minds": "happiestminds.com",

  // ── Automotive ──
  "Maruti Suzuki": "marutisuzuki.com",
  "Tata Motors": "tatamotors.com",
  "Mahindra & Mahindra": "mahindra.com",
  "Hyundai India": "hyundai.co.in",
  "Hero MotoCorp": "heromotocorp.com",
  "Bajaj Auto": "bajajauto.com",
  "TVS Motor": "tvsmotor.com",
  "Royal Enfield": "royalenfield.com",
  "Kia India": "kia.com",
  "MG Motor India": "mgmotor.co.in",
  "Ashok Leyland": "ashokleyland.com",
  "Ola Electric": "olaelectric.com",
  "Ather Energy": "atherenergy.com",
  "Tata Passenger Electric": "tatamotors.com",
  "Honda Cars India": "hondacarindia.com",

  // ── Retail & E-Commerce ──
  "Flipkart": "flipkart.com",
  "Amazon India": "amazon.in",
  "Reliance Retail": "relianceretail.com",
  "Myntra": "myntra.com",
  "Nykaa": "nykaa.com",
  "Meesho": "meesho.com",
  "BigBasket": "bigbasket.com",
  "JioMart": "jiomart.com",
  "Tata CLiQ": "tatacliq.com",
  "AJIO": "ajio.com",
  "Swiggy Instamart": "swiggy.com",
  "Blinkit": "blinkit.com",
  "DMart": "dmartindia.com",
  "Croma": "croma.com",
  "FirstCry": "firstcry.com",

  // ── Fashion & Apparel ──
  "Fabindia": "fabindia.com",
  "Manyavar": "manyavar.com",
  "Allen Solly": "allensolly.com",
  "Peter England": "peterengland.com",
  "W (BIBA Group)": "biba.in",
  "Raymond": "raymond.in",
  "Van Heusen": "vanheusenindia.com",
  "Woodland": "woodlandworldwide.com",
  "Bata India": "bata.in",
  "Titan (Tanishq)": "tanishq.co.in",
  "Kalyan Jewellers": "kalyanjewellers.net",
  "Levi's India": "levi.in",
  "Bewakoof": "bewakoof.com",
  "boAt Lifestyle": "boat-lifestyle.com",
  "Noise": "gonoise.com",

  // ── Food & Beverage ──
  "Amul": "amul.com",
  "ITC Foods": "itcportal.com",
  "Britannia": "britannia.co.in",
  "Parle": "parleproducts.com",
  "Haldiram's": "haldirams.com",
  "MDH Spices": "mdhspices.com",
  "Dabur": "dabur.com",
  "Nestle India": "nestle.in",
  "Tata Consumer Products": "tataconsumer.com",
  "Paper Boat": "paperboatdrinks.com",
  "Chai Point": "chaipoint.com",
  "Bira 91": "bira91.com",
  "Zomato": "zomato.com",
  "Swiggy": "swiggy.com",
  "Domino's India": "dominos.co.in",

  // ── Healthcare & Pharma ──
  "Sun Pharmaceutical": "sunpharma.com",
  "Dr. Reddy's": "drreddys.com",
  "Cipla": "cipla.com",
  "Divi's Laboratories": "divislabs.com",
  "Apollo Hospitals": "apollohospitals.com",
  "Fortis Healthcare": "fortishealthcare.com",
  "Max Healthcare": "maxhealthcare.in",
  "Manipal Hospitals": "manipalhospitals.com",
  "Narayana Health": "narayanahealth.org",
  "Lupin": "lupin.com",
  "Aurobindo Pharma": "aurobindo.com",
  "PharmEasy": "pharmeasy.in",
  "1mg (Tata Health)": "1mg.com",
  "Biocon": "biocon.com",
  "Thyrocare": "thyrocare.com",

  // ── Finance & Banking ──
  "HDFC Bank": "hdfcbank.com",
  "State Bank of India": "sbi.co.in",
  "ICICI Bank": "icicibank.com",
  "Kotak Mahindra Bank": "kotak.com",
  "Axis Bank": "axisbank.com",
  "Bajaj Finance": "bajajfinserv.in",
  "Paytm": "paytm.com",
  "PhonePe": "phonepe.com",
  "Razorpay": "razorpay.com",
  "Zerodha": "zerodha.com",
  "Groww": "groww.in",
  "CRED": "cred.club",
  "LIC": "licindia.in",
  "PolicyBazaar": "policybazaar.com",
  "HDFC Life": "hdfclife.com",

  // ── Telecommunications ──
  "Jio (Reliance)": "jio.com",
  "Airtel": "airtel.in",
  "Vi (Vodafone Idea)": "myvi.in",
  "BSNL": "bsnl.co.in",
  "Tata Communications": "tatacommunications.com",
  "ACT Fibernet": "actcorp.in",
  "Excitel": "excitel.com",
  "Jio Fiber": "jio.com",
  "Airtel Xstream": "airtel.in",
  "Lava International": "lavamobiles.com",
  "Micromax": "micromaxinfo.com",
  "Jio Platforms": "jio.com",
  "Sterlite Technologies": "stl.tech",
  "Tejas Networks": "tejasnetworks.com",
  "HFCL": "hfcl.com",

  // ── Entertainment & Media ──
  "Disney+ Hotstar": "hotstar.com",
  "JioCinema": "jiocinema.com",
  "Zee Entertainment": "zee5.com",
  "Sony LIV": "sonyliv.com",
  "Netflix India": "netflix.com",
  "Amazon Prime Video India": "primevideo.com",
  "Gaana": "gaana.com",
  "JioSaavn": "jiosaavn.com",
  "Times of India": "timesofindia.indiatimes.com",
  "NDTV": "ndtv.com",
  "Republic TV": "republicworld.com",
  "Yash Raj Films": "yashrajfilms.com",
  "T-Series": "tseries.com",
  "Dream11": "dream11.com",
  "MPL (Mobile Premier League)": "mpl.live",

  // ── Travel & Hospitality ──
  "MakeMyTrip": "makemytrip.com",
  "Ixigo": "ixigo.com",
  "Yatra": "yatra.com",
  "IndiGo Airlines": "goindigo.in",
  "Air India": "airindia.com",
  "Vistara": "airvistara.com",
  "IRCTC": "irctc.co.in",
  "OYO Rooms": "oyorooms.com",
  "Taj Hotels (IHCL)": "tajhotels.com",
  "ITC Hotels": "itchotels.com",
  "Oberoi Hotels": "oberoihotels.com",
  "Lemon Tree Hotels": "lemontreehotels.com",
  "Cleartrip": "cleartrip.com",
  "Goibibo": "goibibo.com",
  "SpiceJet": "spicejet.com",

  // ── Energy & Oil ──
  "Reliance Industries": "ril.com",
  "Indian Oil Corporation": "iocl.com",
  "ONGC": "ongcindia.com",
  "Bharat Petroleum": "bharatpetroleum.in",
  "Hindustan Petroleum": "hindustanpetroleum.com",
  "NTPC": "ntpc.co.in",
  "Adani Green Energy": "adanigreenenergy.com",
  "Tata Power": "tatapower.com",
  "Power Grid Corporation": "powergrid.in",
  "Coal India": "coalindia.in",
  "Suzlon Energy": "suzlon.com",
  "JSW Energy": "jsw.in",
  "ReNew Energy": "renewpower.in",
  "Adani Total Gas": "adanitotalgas.com",
  "GAIL India": "gailonline.com",

  // ── Consumer Goods (FMCG) ──
  "Hindustan Unilever": "hul.co.in",
  "ITC Limited": "itcportal.com",
  "Godrej Consumer": "godrejcp.com",
  "Marico": "marico.com",
  "Dabur India": "dabur.com",
  "Colgate-Palmolive India": "colgatepalmolive.co.in",
  "Patanjali": "patanjaliayurved.net",
  "Emami": "emamiltd.in",
  "Himalaya Wellness": "himalayawellness.in",
  "Wipro Consumer (Santoor)": "wiproconsumercare.com",
  "Bajaj Consumer Care": "bajajconsumercare.com",
  "Jyothy Labs": "jyothylabs.com",
  "Cavinkare": "cavinkare.com",
  "Lotus Herbals": "lotusherbals.com",
  "Mama Earth": "mamaearth.in",

  // ── Real Estate & Construction ──
  "DLF": "dlf.in",
  "Godrej Properties": "godrejproperties.com",
  "Prestige Estates": "prestigeconstructions.com",
  "Brigade Group": "brigadegroup.com",
  "Oberoi Realty": "oberoirealty.com",
  "Lodha (Macrotech)": "lodhagroup.com",
  "Mahindra Lifespace": "mahindralifespaces.com",
  "Shapoorji Pallonji": "shapoorji.in",
  "L&T Realty": "lntrealty.com",
  "Sobha Limited": "sobha.com",
  "Puravankara": "puravankara.com",
  "Tata Housing": "tatahousing.in",
  "NoBroker": "nobroker.in",
  "Housing.com": "housing.com",
  "99acres (Info Edge)": "99acres.com",

  // ── Education & EdTech ──
  "BYJU'S": "byjus.com",
  "Unacademy": "unacademy.com",
  "upGrad": "upgrad.com",
  "Vedantu": "vedantu.com",
  "Physics Wallah": "pw.live",
  "Simplilearn": "simplilearn.com",
  "Great Learning": "greatlearning.in",
  "Scaler Academy": "scaler.com",
  "Coding Ninjas": "codingninjas.com",
  "Allen Career Institute": "allen.ac.in",
  "FIITJEE": "fiitjee.com",
  "Aakash Institute": "aakash.ac.in",
  "Emeritus": "emeritus.org",
  "Eruditus": "eruditus.com",
  "Testbook": "testbook.com",

  // ── Logistics & Supply Chain ──
  "Delhivery": "delhivery.com",
  "Blue Dart": "bluedart.com",
  "DTDC": "dtdc.in",
  "Ecom Express": "ecomexpress.in",
  "Shadowfax": "shadowfax.in",
  "Rivigo": "rivigo.com",
  "Porter": "porter.in",
  "Dunzo": "dunzo.com",
  "XpressBees": "xpressbees.com",
  "Gati Limited": "gati.com",
  "Allcargo Logistics": "allcargologistics.com",
  "TCI Express": "tciexpress.in",
  "Mahindra Logistics": "mahindralogistics.com",
  "Safexpress": "safexpress.com",
  "LoadShare": "loadshare.net",

  // ── Consumer Electronics ──
  "Samsung": "samsung.com",
  "LG": "lg.com",
  "Sony": "sony.co.in",
  "Xiaomi": "mi.com",
  "OnePlus": "oneplus.in",
  "Realme": "realme.com",
  "Boat": "boat-lifestyle.com",
  "Lenovo": "lenovo.com",
  "Dell": "dell.com",
  "HP": "hp.com",
  "Acer": "acer.com",
  "Zebronics": "zebronics.com",
  "Portronics": "portronics.com",
  "TCL": "tcl.com",

  // ── Mobile Phones ──
  "Vivo": "vivo.com",
  "Oppo": "oppo.com",
  "Poco": "poco.in",
  "Motorola": "motorola.in",
  "iQOO": "iqoo.com",
  "Apple": "apple.com",
  "Google": "google.com",
  "Nothing Phone": "nothing.tech",
  "Nokia": "nokia.com",
  "Lava": "lavamobiles.com",
  "Infinix": "infinixmobility.com",

  // ── Home Appliances ──
  "Whirlpool": "whirlpool.co.in",
  "Godrej": "godrej.com",
  "IFB": "ifbappliances.com",
  "Haier": "haier.com",
  "Voltas": "voltas.com",
  "Blue Star": "bluestarindia.com",
  "Bajaj": "bajajelectricals.com",
  "Crompton": "crompton.co.in",
  "Kent RO": "kent.co.in",
  "Philips": "philips.co.in",
  "Panasonic": "panasonic.com",
  "Borosil": "borosil.com",
  "Morphy Richards": "morphyrichards.co.in",

  // ── Two Wheelers ──
  "Honda": "honda2wheelersindia.com",
  "Yamaha": "yamaha-motor-india.com",
  "Suzuki": "suzukimotorcycle.co.in",
  "KTM": "ktm.com",
  "Jawa": "jawamotorcycles.com",
  "Revolt": "revoltmotors.com",
  "Ultraviolette": "ultraviolette.com",
  "Aprilia": "aprilia.com",
  "Simple Energy": "simpleenergy.in",
};

/**
 * Get the logo URL for a brand.
 * Returns the self-hosted path /logos/{domain}.png (downloaded via scripts/download-logos.ts).
 * Falls back to the live logo.dev API (requires NEXT_PUBLIC_LOGO_DEV_KEY) if needed.
 * Returns null if no domain mapping exists.
 */
export function getBrandLogoUrl(brand: string, size: number = 128): string | null {
  const domain = BRAND_DOMAINS[brand];
  if (!domain) return null;
  // Prefer self-hosted logos (no API key required, no rate limits)
  return `/logos/${domain}.png`;
}

/**
 * Get the live logo.dev URL for a brand (useful for fallback or SSR contexts).
 * Requires NEXT_PUBLIC_LOGO_DEV_KEY env var.
 */
export function getBrandLogoDevUrl(brand: string, size: number = 128): string | null {
  const domain = BRAND_DOMAINS[brand];
  if (!domain) return null;
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_KEY;
  if (!token) return null;
  return `https://img.logo.dev/${domain}?token=${token}&size=${size}&format=png`;
}

/**
 * Get the domain for a brand (useful for display or linking).
 */
export function getBrandDomain(brand: string): string | null {
  return BRAND_DOMAINS[brand] || null;
}
