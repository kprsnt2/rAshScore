"""
rAsh Score v2.0 — Industry & Brand Definitions
19 Indian industries with 15 top brands each (285 total).
"""

INDUSTRIES = [
    {
        "id": "technology",
        "name": "Technology & IT",
        "category": "technology",
        "description": "Software, IT services, and hardware companies in India",
        "top_brands": [
            "Tata Consultancy Services", "Infosys", "Wipro", "HCL Technologies",
            "Tech Mahindra", "LTIMindtree", "Zoho", "Freshworks", "Mphasis",
            "Persistent Systems", "Coforge", "NIIT Technologies",
            "Zensar Technologies", "Cyient", "Happiest Minds",
        ],
    },
    {
        "id": "automotive",
        "name": "Automotive (Cars & Bikes)",
        "category": "automotive",
        "description": "Car manufacturers, two-wheeler brands, and electric vehicles in India",
        "top_brands": [
            "Maruti Suzuki", "Tata Motors", "Hyundai India",
            "Mahindra & Mahindra", "Hero MotoCorp", "Bajaj Auto",
            "Royal Enfield", "TVS Motor", "Kia India", "MG Motor India",
            "Ola Electric", "Ather Energy", "Yamaha", "Honda", "Toyota India",
        ],
    },
    {
        "id": "ecommerce",
        "name": "Retail & E-Commerce",
        "category": "ecommerce",
        "description": "Online and offline retail platforms in India",
        "top_brands": [
            "Flipkart", "Amazon India", "Reliance Retail", "Myntra", "Nykaa",
            "Meesho", "BigBasket", "JioMart", "Tata CLiQ", "AJIO",
            "Swiggy Instamart", "Blinkit", "DMart", "Croma", "FirstCry",
        ],
    },
    {
        "id": "fashion",
        "name": "Fashion & Apparel",
        "category": "fashion",
        "description": "Clothing, footwear, and accessories brands in India",
        "top_brands": [
            "Fabindia", "Manyavar", "Allen Solly", "Peter England",
            "W (BIBA Group)", "Raymond", "Van Heusen", "Woodland",
            "Bata India", "Titan (Tanishq)", "Kalyan Jewellers",
            "Levi's India", "Bewakoof", "Puma India", "Nike India",
        ],
    },
    {
        "id": "food-beverage",
        "name": "Food & Beverage",
        "category": "food-beverage",
        "description": "Food products, beverages, and restaurant chains in India",
        "top_brands": [
            "Amul", "ITC Foods", "Britannia", "Parle", "Haldiram's",
            "MDH Spices", "Nestle India", "Tata Consumer Products",
            "Paper Boat", "Chai Point", "Bira 91", "Zomato", "Swiggy",
            "Domino's India", "Cafe Coffee Day",
        ],
    },
    {
        "id": "healthcare",
        "name": "Healthcare & Pharma",
        "category": "healthcare",
        "description": "Pharmaceutical companies and hospital chains in India",
        "top_brands": [
            "Sun Pharmaceutical", "Dr. Reddy's", "Cipla",
            "Divi's Laboratories", "Apollo Hospitals", "Fortis Healthcare",
            "Max Healthcare", "Manipal Hospitals", "Narayana Health", "Lupin",
            "Aurobindo Pharma", "PharmEasy", "1mg (Tata Health)", "Biocon",
            "Thyrocare",
        ],
    },
    {
        "id": "finance",
        "name": "Finance & Banking",
        "category": "finance",
        "description": "Banks, NBFCs, insurance, and fintech companies in India",
        "top_brands": [
            "HDFC Bank", "State Bank of India", "ICICI Bank",
            "Kotak Mahindra Bank", "Axis Bank", "Bajaj Finance", "Paytm",
            "PhonePe", "Razorpay", "Zerodha", "Groww", "CRED", "LIC",
            "PolicyBazaar", "HDFC Life",
        ],
    },
    {
        "id": "telecom",
        "name": "Telecommunications",
        "category": "telecom",
        "description": "Mobile operators, broadband, and telecom infrastructure in India",
        "top_brands": [
            "Jio (Reliance)", "Airtel", "Vi (Vodafone Idea)", "BSNL",
            "Tata Communications", "ACT Fibernet", "Excitel", "Jio Fiber",
            "Airtel Xstream", "Lava International", "Micromax",
            "Jio Platforms", "Sterlite Technologies", "Tejas Networks", "HFCL",
        ],
    },
    {
        "id": "entertainment",
        "name": "Entertainment & Media",
        "category": "entertainment",
        "description": "Streaming, film production, and media companies in India",
        "top_brands": [
            "Disney+ Hotstar", "JioCinema", "Zee Entertainment", "Sony LIV",
            "Netflix India", "Amazon Prime Video India", "Gaana", "JioSaavn",
            "Times of India", "NDTV", "Republic TV", "Yash Raj Films",
            "T-Series", "Dream11", "MPL (Mobile Premier League)",
        ],
    },
    {
        "id": "travel",
        "name": "Travel & Hospitality",
        "category": "travel",
        "description": "Airlines, hotels, and travel services in India",
        "top_brands": [
            "MakeMyTrip", "Ixigo", "Yatra", "IndiGo Airlines", "Air India",
            "Vistara", "IRCTC", "OYO Rooms", "Taj Hotels (IHCL)",
            "ITC Hotels", "Oberoi Hotels", "Lemon Tree Hotels", "Cleartrip",
            "Goibibo", "SpiceJet",
        ],
    },
    {
        "id": "energy",
        "name": "Energy & Oil",
        "category": "energy",
        "description": "Oil, gas, power generation, and renewable energy in India",
        "top_brands": [
            "Reliance Industries", "Indian Oil Corporation", "ONGC",
            "Bharat Petroleum", "Hindustan Petroleum", "NTPC",
            "Adani Green Energy", "Tata Power", "Power Grid Corporation",
            "Coal India", "Suzlon Energy", "JSW Energy", "ReNew Energy",
            "Adani Total Gas", "GAIL India",
        ],
    },
    {
        "id": "fmcg",
        "name": "Consumer Goods (FMCG)",
        "category": "fmcg",
        "description": "Fast-moving consumer goods and personal care brands in India",
        "top_brands": [
            "Hindustan Unilever", "ITC Limited", "Godrej Consumer", "Marico",
            "Dabur India", "Colgate-Palmolive India", "Patanjali", "Emami",
            "Himalaya Wellness", "Wipro Consumer (Santoor)",
            "Bajaj Consumer Care", "Jyothy Labs", "Cavinkare",
            "Lotus Herbals", "Mama Earth",
        ],
    },
    {
        "id": "realestate",
        "name": "Real Estate & Construction",
        "category": "realestate",
        "description": "Real estate developers and construction companies in India",
        "top_brands": [
            "DLF", "Godrej Properties", "Prestige Estates", "Brigade Group",
            "Oberoi Realty", "Lodha (Macrotech)", "Mahindra Lifespace",
            "Shapoorji Pallonji", "L&T Realty", "Sobha Limited",
            "Puravankara", "Tata Housing", "NoBroker", "Housing.com",
            "99acres (Info Edge)",
        ],
    },
    {
        "id": "edtech",
        "name": "Education & EdTech",
        "category": "edtech",
        "description": "EdTech platforms and education companies in India",
        "top_brands": [
            "BYJU'S", "Unacademy", "upGrad", "Vedantu", "Physics Wallah",
            "Simplilearn", "Great Learning", "Scaler Academy", "Coding Ninjas",
            "Allen Career Institute", "FIITJEE", "Aakash Institute",
            "Emeritus", "Eruditus", "Testbook",
        ],
    },
    {
        "id": "logistics",
        "name": "Logistics & Supply Chain",
        "category": "logistics",
        "description": "Logistics, delivery, and supply chain companies in India",
        "top_brands": [
            "Delhivery", "Blue Dart", "DTDC", "Ecom Express", "Shadowfax",
            "Rivigo", "Porter", "Dunzo", "XpressBees", "Gati Limited",
            "Allcargo Logistics", "TCI Express", "Mahindra Logistics",
            "Safexpress", "LoadShare",
        ],
    },
    {
        "id": "consumer-electronics",
        "name": "Consumer Electronics",
        "category": "consumer-electronics",
        "description": "Televisions, laptops, audio devices, and smart electronics in India",
        "top_brands": [
            "Samsung", "LG", "Sony", "Boat", "Noise", "Lenovo", "Dell",
            "HP", "Acer", "Zebronics", "Portronics", "TCL", "JBL India",
            "Sennheiser India", "Bose India",
        ],
    },
    {
        "id": "mobile-phones",
        "name": "Mobile Phones",
        "category": "mobile-phones",
        "description": "Smartphones and feature phones sold in India",
        "top_brands": [
            "Xiaomi", "Samsung", "Realme", "Vivo", "Oppo", "OnePlus",
            "Poco", "Motorola", "iQOO", "Apple", "Google", "Nothing Phone",
            "Nokia", "Lava", "Infinix",
        ],
    },
    {
        "id": "home-appliances",
        "name": "Home Appliances",
        "category": "home-appliances",
        "description": "Refrigerators, washing machines, ACs, and kitchen appliances in India",
        "top_brands": [
            "LG", "Samsung", "Whirlpool", "Godrej", "IFB", "Haier",
            "Voltas", "Blue Star", "Bajaj", "Crompton", "Kent RO",
            "Philips", "Panasonic", "Borosil", "Morphy Richards",
        ],
    },
]


def get_all_industries() -> list[dict]:
    """Return all 19 industries."""
    return INDUSTRIES


def get_industry_by_id(industry_id: str) -> dict | None:
    """Find an industry by its ID."""
    for ind in INDUSTRIES:
        if ind["id"] == industry_id:
            return ind
    return None


def get_brands_for_industry(industry_id: str) -> list[str]:
    """Get the top brands list for a given industry."""
    ind = get_industry_by_id(industry_id)
    return ind["top_brands"] if ind else []


def get_total_brand_count() -> int:
    """Total number of brands across all industries."""
    return sum(len(i["top_brands"]) for i in INDUSTRIES)
