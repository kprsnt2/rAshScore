export interface Industry {
  id: string;
  name: string;
  category: string;
  topBrands: string[];
  description: string;
}

export const INDUSTRIES: Industry[] = [
  {
    id: "technology",
    name: "Technology & IT",
    category: "technology",
    description: "Software, IT services, and hardware companies in India",
    topBrands: [
      "Tata Consultancy Services",
      "Infosys",
      "Wipro",
      "HCL Technologies",
      "Tech Mahindra",
      "LTIMindtree",
      "Zoho",
      "Freshworks",
      "Mphasis",
      "Persistent Systems",
      "Coforge",
      "NIIT Technologies",
      "Zensar Technologies",
      "Cyient",
      "Happiest Minds"
    ]
  },
  {
    id: "automotive",
    name: "Automotive (Cars & Bikes)",
    category: "automotive",
    description: "Car manufacturers, two-wheeler brands, and electric vehicles in India",
    topBrands: [
      "Maruti Suzuki",
      "Tata Motors",
      "Hyundai India",
      "Mahindra & Mahindra",
      "Hero MotoCorp",
      "Bajaj Auto",
      "Royal Enfield",
      "TVS Motor",
      "Kia India",
      "MG Motor India",
      "Ola Electric",
      "Ather Energy",
      "Yamaha",
      "Honda",
      "Toyota India"
    ]
  },
  {
    id: "ecommerce",
    name: "Retail & E-Commerce",
    category: "ecommerce",
    description: "Online and offline retail platforms in India",
    topBrands: [
      "Flipkart",
      "Amazon India",
      "Reliance Retail",
      "Myntra",
      "Nykaa",
      "Meesho",
      "BigBasket",
      "JioMart",
      "Tata CLiQ",
      "AJIO",
      "Swiggy Instamart",
      "Blinkit",
      "DMart",
      "Croma",
      "FirstCry"
    ]
  },
  {
    id: "fashion",
    name: "Fashion & Apparel",
    category: "fashion",
    description: "Clothing, footwear, and accessories brands in India",
    topBrands: [
      "Fabindia",
      "Manyavar",
      "Allen Solly",
      "Peter England",
      "W (BIBA Group)",
      "Raymond",
      "Van Heusen",
      "Woodland",
      "Bata India",
      "Titan (Tanishq)",
      "Kalyan Jewellers",
      "Levi's India",
      "Bewakoof",
      "Puma India",
      "Nike India"
    ]
  },
  {
    id: "food-beverage",
    name: "Food & Beverage",
    category: "food-beverage",
    description: "Food products, beverages, and restaurant chains in India",
    topBrands: [
      "Amul",
      "ITC Foods",
      "Britannia",
      "Parle",
      "Haldiram's",
      "MDH Spices",
      "Nestle India",
      "Tata Consumer Products",
      "Paper Boat",
      "Chai Point",
      "Bira 91",
      "Zomato",
      "Swiggy",
      "Domino's India",
      "Cafe Coffee Day"
    ]
  },
  {
    id: "healthcare",
    name: "Healthcare & Pharma",
    category: "healthcare",
    description: "Pharmaceutical companies and hospital chains in India",
    topBrands: [
      "Sun Pharmaceutical",
      "Dr. Reddy's",
      "Cipla",
      "Divi's Laboratories",
      "Apollo Hospitals",
      "Fortis Healthcare",
      "Max Healthcare",
      "Manipal Hospitals",
      "Narayana Health",
      "Lupin",
      "Aurobindo Pharma",
      "PharmEasy",
      "1mg (Tata Health)",
      "Biocon",
      "Thyrocare"
    ]
  },
  {
    id: "finance",
    name: "Finance & Banking",
    category: "finance",
    description: "Banks, NBFCs, insurance, and fintech companies in India",
    topBrands: [
      "HDFC Bank",
      "State Bank of India",
      "ICICI Bank",
      "Kotak Mahindra Bank",
      "Axis Bank",
      "Bajaj Finance",
      "Paytm",
      "PhonePe",
      "Razorpay",
      "Zerodha",
      "Groww",
      "CRED",
      "LIC",
      "PolicyBazaar",
      "HDFC Life"
    ]
  },
  {
    id: "telecom",
    name: "Telecommunications",
    category: "telecom",
    description: "Mobile operators, broadband, and telecom infrastructure in India",
    topBrands: [
      "Jio (Reliance)",
      "Airtel",
      "Vi (Vodafone Idea)",
      "BSNL",
      "Tata Communications",
      "ACT Fibernet",
      "Excitel",
      "Jio Fiber",
      "Airtel Xstream",
      "Lava International",
      "Micromax",
      "Jio Platforms",
      "Sterlite Technologies",
      "Tejas Networks",
      "HFCL"
    ]
  },
  {
    id: "entertainment",
    name: "Entertainment & Media",
    category: "entertainment",
    description: "Streaming, film production, and media companies in India",
    topBrands: [
      "Disney+ Hotstar",
      "JioCinema",
      "Zee Entertainment",
      "Sony LIV",
      "Netflix India",
      "Amazon Prime Video India",
      "Gaana",
      "JioSaavn",
      "Times of India",
      "NDTV",
      "Republic TV",
      "Yash Raj Films",
      "T-Series",
      "Dream11",
      "MPL (Mobile Premier League)"
    ]
  },
  {
    id: "travel",
    name: "Travel & Hospitality",
    category: "travel",
    description: "Airlines, hotels, and travel services in India",
    topBrands: [
      "MakeMyTrip",
      "Ixigo",
      "Yatra",
      "IndiGo Airlines",
      "Air India",
      "Vistara",
      "IRCTC",
      "OYO Rooms",
      "Taj Hotels (IHCL)",
      "ITC Hotels",
      "Oberoi Hotels",
      "Lemon Tree Hotels",
      "Cleartrip",
      "Goibibo",
      "SpiceJet"
    ]
  },
  {
    id: "energy",
    name: "Energy & Oil",
    category: "energy",
    description: "Oil, gas, power generation, and renewable energy in India",
    topBrands: [
      "Reliance Industries",
      "Indian Oil Corporation",
      "ONGC",
      "Bharat Petroleum",
      "Hindustan Petroleum",
      "NTPC",
      "Adani Green Energy",
      "Tata Power",
      "Power Grid Corporation",
      "Coal India",
      "Suzlon Energy",
      "JSW Energy",
      "ReNew Energy",
      "Adani Total Gas",
      "GAIL India"
    ]
  },
  {
    id: "fmcg",
    name: "Consumer Goods (FMCG)",
    category: "fmcg",
    description: "Fast-moving consumer goods and personal care brands in India",
    topBrands: [
      "Hindustan Unilever",
      "ITC Limited",
      "Godrej Consumer",
      "Marico",
      "Dabur India",
      "Colgate-Palmolive India",
      "Patanjali",
      "Emami",
      "Himalaya Wellness",
      "Wipro Consumer (Santoor)",
      "Bajaj Consumer Care",
      "Jyothy Labs",
      "Cavinkare",
      "Lotus Herbals",
      "Mama Earth"
    ]
  },
  {
    id: "realestate",
    name: "Real Estate & Construction",
    category: "realestate",
    description: "Real estate developers and construction companies in India",
    topBrands: [
      "DLF",
      "Godrej Properties",
      "Prestige Estates",
      "Brigade Group",
      "Oberoi Realty",
      "Lodha (Macrotech)",
      "Mahindra Lifespace",
      "Shapoorji Pallonji",
      "L&T Realty",
      "Sobha Limited",
      "Puravankara",
      "Tata Housing",
      "NoBroker",
      "Housing.com",
      "99acres (Info Edge)"
    ]
  },
  {
    id: "edtech",
    name: "Education & EdTech",
    category: "edtech",
    description: "EdTech platforms and education companies in India",
    topBrands: [
      "BYJU'S",
      "Unacademy",
      "upGrad",
      "Vedantu",
      "Physics Wallah",
      "Simplilearn",
      "Great Learning",
      "Scaler Academy",
      "Coding Ninjas",
      "Allen Career Institute",
      "FIITJEE",
      "Aakash Institute",
      "Emeritus",
      "Eruditus",
      "Testbook"
    ]
  },
  {
    id: "logistics",
    name: "Logistics & Supply Chain",
    category: "logistics",
    description: "Logistics, delivery, and supply chain companies in India",
    topBrands: [
      "Delhivery",
      "Blue Dart",
      "DTDC",
      "Ecom Express",
      "Shadowfax",
      "Rivigo",
      "Porter",
      "Dunzo",
      "XpressBees",
      "Gati Limited",
      "Allcargo Logistics",
      "TCI Express",
      "Mahindra Logistics",
      "Safexpress",
      "LoadShare"
    ]
  },
  {
    id: "consumer-electronics",
    name: "Consumer Electronics",
    category: "consumer-electronics",
    description: "Televisions, laptops, audio devices, and smart electronics in India",
    topBrands: [
      "Samsung",
      "LG",
      "Sony",
      "Boat",
      "Noise",
      "Lenovo",
      "Dell",
      "HP",
      "Acer",
      "Zebronics",
      "Portronics",
      "TCL",
      "JBL India",
      "Sennheiser India",
      "Bose India"
    ]
  },
  {
    id: "mobile-phones",
    name: "Mobile Phones",
    category: "mobile-phones",
    description: "Smartphones and feature phones sold in India",
    topBrands: [
      "Xiaomi",
      "Samsung",
      "Realme",
      "Vivo",
      "Oppo",
      "OnePlus",
      "Poco",
      "Motorola",
      "iQOO",
      "Apple",
      "Google",
      "Nothing Phone",
      "Nokia",
      "Lava",
      "Infinix"
    ]
  },
  {
    id: "home-appliances",
    name: "Home Appliances",
    category: "home-appliances",
    description: "Refrigerators, washing machines, ACs, and kitchen appliances in India",
    topBrands: [
      "LG",
      "Samsung",
      "Whirlpool",
      "Godrej",
      "IFB",
      "Haier",
      "Voltas",
      "Blue Star",
      "Bajaj",
      "Crompton",
      "Kent RO",
      "Philips",
      "Panasonic",
      "Borosil",
      "Morphy Richards"
    ]
  }
];

export function getIndustryById(id: string): Industry | undefined {
  return INDUSTRIES.find(industry => industry.id === id);
}

export function getAllIndustries(): Industry[] {
  return INDUSTRIES;
}

export function getTopBrandsByIndustry(industryId: string): string[] {
  const industry = getIndustryById(industryId);
  return industry ? industry.topBrands : [];
}
