// ============================================================
// DATASET 1: WORLD FAMOUS PLACES 2024 (Kaggle)
// Module: Destination Recommendation, Weather, Budget Estimation
// Columns used: Place_Name, Country, City, Annual_Visitors_Millions,
//   Type, UNESCO, Year_Built, Entry_Fee_USD, Best_Visit_Month,
//   Region, Tourism_Revenue_Million_USD, Average_Visit_Duration_Hours,
//   Famous_For
// Usage: Filter by region/type/budget, rank by popularity, match season
// ============================================================

export interface Destination {
  id: string
  name: string
  country: string
  city: string
  region: string
  image: string
  description: string
  famousFor: string
  type: string
  bestTime: string
  budget: { min: number; max: number; currency: string }
  rating: number
  annualVisitors: number
  entryFee: number
  avgVisitDuration: number
  tourismRevenue: number
  yearBuilt: string
  isUNESCO: boolean
  interests: string[]
  weather: { temp: number; condition: string }
  latitude: number
  longitude: number
}

// Real data from world_famous_places_2024.csv
// Budget min/max derived from entry_fee + regional cost-of-living estimate
export const destinations: Destination[] = [
  {
    id: "1",
    name: "Eiffel Tower",
    country: "France",
    city: "Paris",
    region: "Western Europe",
    image: "https://upload.wikimedia.org/wikipedia/commons/5/56/Eiffel_Tower_Paris_1.jpg",
    description: "Iconic iron lattice tower, symbol of Paris",
    famousFor: "Iconic iron lattice tower, symbol of Paris",
    type: "Monument/Tower",
    bestTime: "May-June / Sept-Oct",
    budget: { min: 120, max: 280, currency: "USD" },
    rating: 4.8,
    annualVisitors: 7,
    entryFee: 35,
    avgVisitDuration: 2.5,
    tourismRevenue: 95,
    yearBuilt: "1889",
    isUNESCO: false,
    interests: ["culture", "romance", "photography", "history"],
    weather: { temp: 16, condition: "Partly Cloudy" },
    latitude: 48.8584,
    longitude: 2.2945,
  },
  {
    id: "2",
    name: "Times Square",
    country: "United States",
    city: "New York City",
    region: "North America",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/New_york_times_square-terabass.jpg/330px-New_york_times_square-terabass.jpg",
    description: "Bright lights, Broadway shows, New Year's Eve ball drop",
    famousFor: "Bright lights, Broadway shows, New Year's Eve ball drop",
    type: "Urban Landmark",
    bestTime: "Apr-June / Sept-Nov",
    budget: { min: 180, max: 400, currency: "USD" },
    rating: 4.5,
    annualVisitors: 50,
    entryFee: 0,
    avgVisitDuration: 1.5,
    tourismRevenue: 70,
    yearBuilt: "1904",
    isUNESCO: false,
    interests: ["shopping", "nightlife", "culture", "food"],
    weather: { temp: 14, condition: "Clear" },
    latitude: 40.758,
    longitude: -73.9855,
  },
  {
    id: "3",
    name: "Louvre Museum",
    country: "France",
    city: "Paris",
    region: "Western Europe",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Louvre_Museum_Wikimedia_Commons.jpg/330px-Louvre_Museum_Wikimedia_Commons.jpg",
    description: "World's most visited museum, home to Mona Lisa",
    famousFor: "World's most visited museum, home to Mona Lisa",
    type: "Museum",
    bestTime: "Oct-March",
    budget: { min: 100, max: 250, currency: "USD" },
    rating: 4.9,
    annualVisitors: 8.7,
    entryFee: 22,
    avgVisitDuration: 4,
    tourismRevenue: 120,
    yearBuilt: "1793",
    isUNESCO: true,
    interests: ["art", "culture", "history"],
    weather: { temp: 12, condition: "Cloudy" },
    latitude: 48.8606,
    longitude: 2.3376,
  },
  {
    id: "4",
    name: "Great Wall of China",
    country: "China",
    city: "Beijing",
    region: "East Asia",
    image: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800&q=80",
    description: "Ancient defensive structure visible from space",
    famousFor: "Ancient defensive structure visible from space",
    type: "Historic Monument",
    bestTime: "Apr-May / Sept-Oct",
    budget: { min: 50, max: 150, currency: "USD" },
    rating: 4.7,
    annualVisitors: 10,
    entryFee: 10,
    avgVisitDuration: 4,
    tourismRevenue: 180,
    yearBuilt: "220 BC - 1644 AD",
    isUNESCO: true,
    interests: ["history", "adventure", "nature", "culture"],
    weather: { temp: 18, condition: "Clear" },
    latitude: 40.4319,
    longitude: 116.5704,
  },
  {
    id: "5",
    name: "Taj Mahal",
    country: "India",
    city: "Agra",
    region: "South Asia",
    image: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&q=80",
    description: "White marble mausoleum, symbol of love",
    famousFor: "White marble mausoleum, symbol of love",
    type: "Monument/Mausoleum",
    bestTime: "Oct-March",
    budget: { min: 30, max: 100, currency: "USD" },
    rating: 4.8,
    annualVisitors: 7.5,
    entryFee: 15,
    avgVisitDuration: 2,
    tourismRevenue: 65,
    yearBuilt: "1653",
    isUNESCO: true,
    interests: ["romance", "history", "photography", "culture"],
    weather: { temp: 25, condition: "Sunny" },
    latitude: 27.1751,
    longitude: 78.0421,
  },
  {
    id: "6",
    name: "Colosseum",
    country: "Italy",
    city: "Rome",
    region: "Southern Europe",
    image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80",
    description: "Ancient Roman amphitheater for gladiator battles",
    famousFor: "Ancient Roman amphitheater for gladiator battles",
    type: "Historic Monument",
    bestTime: "Apr-May / Sept-Oct",
    budget: { min: 100, max: 250, currency: "USD" },
    rating: 4.7,
    annualVisitors: 7.65,
    entryFee: 18,
    avgVisitDuration: 2.5,
    tourismRevenue: 85,
    yearBuilt: "80",
    isUNESCO: true,
    interests: ["history", "culture", "art", "food"],
    weather: { temp: 20, condition: "Sunny" },
    latitude: 41.8902,
    longitude: 12.4922,
  },
  {
    id: "7",
    name: "Statue of Liberty",
    country: "United States",
    city: "New York City",
    region: "North America",
    image: "https://images.unsplash.com/photo-1605130284535-11dd9eedc58a?w=800&q=80",
    description: "Symbol of freedom and democracy",
    famousFor: "Symbol of freedom and democracy",
    type: "Monument/Statue",
    bestTime: "May-Sept",
    budget: { min: 150, max: 350, currency: "USD" },
    rating: 4.6,
    annualVisitors: 4.3,
    entryFee: 25,
    avgVisitDuration: 2,
    tourismRevenue: 45,
    yearBuilt: "1886",
    isUNESCO: true,
    interests: ["history", "culture", "photography"],
    weather: { temp: 18, condition: "Clear" },
    latitude: 40.6892,
    longitude: -74.0445,
  },
  {
    id: "8",
    name: "Sydney Opera House",
    country: "Australia",
    city: "Sydney",
    region: "Oceania",
    image: "https://images.unsplash.com/photo-1523059623039-a9ed027e7fad?w=800&q=80",
    description: "Unique sail-like design, performing arts center",
    famousFor: "Unique sail-like design, performing arts center",
    type: "Cultural Building",
    bestTime: "Sept-Nov",
    budget: { min: 150, max: 350, currency: "USD" },
    rating: 4.7,
    annualVisitors: 8.2,
    entryFee: 49,
    avgVisitDuration: 1.5,
    tourismRevenue: 110,
    yearBuilt: "1973",
    isUNESCO: true,
    interests: ["culture", "art", "photography"],
    weather: { temp: 22, condition: "Sunny" },
    latitude: -33.8568,
    longitude: 151.2153,
  },
  {
    id: "9",
    name: "Machu Picchu",
    country: "Peru",
    city: "Cusco Region",
    region: "South America",
    image: "https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=800&q=80",
    description: "Ancient Incan citadel in the Andes mountains",
    famousFor: "Ancient Incan citadel in the Andes mountains",
    type: "Archaeological Site",
    bestTime: "Apr-Oct",
    budget: { min: 80, max: 200, currency: "USD" },
    rating: 4.9,
    annualVisitors: 1.5,
    entryFee: 70,
    avgVisitDuration: 8,
    tourismRevenue: 180,
    yearBuilt: "1450",
    isUNESCO: true,
    interests: ["adventure", "history", "nature", "photography"],
    weather: { temp: 15, condition: "Partly Cloudy" },
    latitude: -13.1631,
    longitude: -72.545,
  },
  {
    id: "10",
    name: "Angkor Wat",
    country: "Cambodia",
    city: "Siem Reap",
    region: "Southeast Asia",
    image: "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=800&q=80",
    description: "Largest religious monument, Hindu-Buddhist temple",
    famousFor: "Largest religious monument, Hindu-Buddhist temple",
    type: "Temple Complex",
    bestTime: "Nov-Feb",
    budget: { min: 40, max: 120, currency: "USD" },
    rating: 4.8,
    annualVisitors: 2.6,
    entryFee: 37,
    avgVisitDuration: 6,
    tourismRevenue: 90,
    yearBuilt: "1150",
    isUNESCO: true,
    interests: ["culture", "history", "photography", "nature"],
    weather: { temp: 28, condition: "Sunny" },
    latitude: 13.4125,
    longitude: 103.867,
  },
  {
    id: "11",
    name: "Sagrada Familia",
    country: "Spain",
    city: "Barcelona",
    region: "Southern Europe",
    image: "https://upload.wikimedia.org/wikipedia/commons/8/84/Barcelona_Sagrada_familia.jpg",
    description: "Gaudi's unfinished basilica, unique architecture",
    famousFor: "Gaudi's unfinished basilica, unique architecture",
    type: "Cathedral",
    bestTime: "Apr-June / Sept-Oct",
    budget: { min: 100, max: 250, currency: "USD" },
    rating: 4.8,
    annualVisitors: 4.7,
    entryFee: 26,
    avgVisitDuration: 2,
    tourismRevenue: 130,
    yearBuilt: "Started 1882",
    isUNESCO: true,
    interests: ["art", "culture", "history", "photography"],
    weather: { temp: 20, condition: "Sunny" },
    latitude: 41.4036,
    longitude: 2.1744,
  },
  {
    id: "12",
    name: "Grand Canyon",
    country: "United States",
    city: "Arizona",
    region: "North America",
    image: "https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?w=800&q=80",
    description: "Massive canyon carved by Colorado River",
    famousFor: "Massive canyon carved by Colorado River",
    type: "Natural Wonder",
    bestTime: "March-May / Sept-Nov",
    budget: { min: 80, max: 200, currency: "USD" },
    rating: 4.9,
    annualVisitors: 6,
    entryFee: 35,
    avgVisitDuration: 5,
    tourismRevenue: 780,
    yearBuilt: "Natural Formation",
    isUNESCO: true,
    interests: ["adventure", "nature", "photography"],
    weather: { temp: 22, condition: "Clear" },
    latitude: 36.1069,
    longitude: -112.1129,
  },
  {
    id: "13",
    name: "Great Pyramid of Giza",
    country: "Egypt",
    city: "Cairo",
    region: "North Africa",
    image: "https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?w=800&q=80",
    description: "Only remaining ancient wonder, pharaoh's tomb",
    famousFor: "Only remaining ancient wonder, pharaoh's tomb",
    type: "Historic Monument",
    bestTime: "Oct-Apr",
    budget: { min: 40, max: 120, currency: "USD" },
    rating: 4.7,
    annualVisitors: 2.8,
    entryFee: 20,
    avgVisitDuration: 3,
    tourismRevenue: 40,
    yearBuilt: "2550 BC",
    isUNESCO: true,
    interests: ["history", "adventure", "photography", "culture"],
    weather: { temp: 30, condition: "Sunny" },
    latitude: 29.9792,
    longitude: 31.1342,
  },
  {
    id: "14",
    name: "Palace of Versailles",
    country: "France",
    city: "Versailles",
    region: "Western Europe",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Versailles-Chateau-Jardins02.jpg/330px-Versailles-Chateau-Jardins02.jpg",
    description: "Opulent royal residence, Hall of Mirrors",
    famousFor: "Opulent royal residence, Hall of Mirrors",
    type: "Historic Palace",
    bestTime: "Apr-June / Sept-Oct",
    budget: { min: 120, max: 280, currency: "USD" },
    rating: 4.8,
    annualVisitors: 7.7,
    entryFee: 21,
    avgVisitDuration: 4,
    tourismRevenue: 180,
    yearBuilt: "1682",
    isUNESCO: true,
    interests: ["history", "art", "culture", "romance"],
    weather: { temp: 16, condition: "Partly Cloudy" },
    latitude: 48.8049,
    longitude: 2.1204,
  },
  {
    id: "15",
    name: "Burj Khalifa",
    country: "United Arab Emirates",
    city: "Dubai",
    region: "Middle East",
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80",
    description: "Tallest building in the world",
    famousFor: "Tallest building in the world",
    type: "Skyscraper",
    bestTime: "Nov-March",
    budget: { min: 150, max: 400, currency: "USD" },
    rating: 4.6,
    annualVisitors: 6,
    entryFee: 45,
    avgVisitDuration: 2,
    tourismRevenue: 350,
    yearBuilt: "2010",
    isUNESCO: false,
    interests: ["shopping", "luxury", "photography"],
    weather: { temp: 32, condition: "Sunny" },
    latitude: 25.1972,
    longitude: 55.2744,
  },
  {
    id: "16",
    name: "Buckingham Palace",
    country: "United Kingdom",
    city: "London",
    region: "Western Europe",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Buckingham_Palace_aerial_view_2016.jpg/500px-Buckingham_Palace_aerial_view_2016.jpg",
    description: "Official residence of British monarch",
    famousFor: "Official residence of British monarch",
    type: "Palace",
    bestTime: "June-Sept",
    budget: { min: 150, max: 350, currency: "USD" },
    rating: 4.5,
    annualVisitors: 15,
    entryFee: 0,
    avgVisitDuration: 1,
    tourismRevenue: 120,
    yearBuilt: "1703",
    isUNESCO: false,
    interests: ["history", "culture", "photography"],
    weather: { temp: 14, condition: "Cloudy" },
    latitude: 51.5014,
    longitude: -0.1419,
  },
  {
    id: "17",
    name: "Christ the Redeemer",
    country: "Brazil",
    city: "Rio de Janeiro",
    region: "South America",
    image: "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=800&q=80",
    description: "Art Deco statue of Jesus Christ",
    famousFor: "Art Deco statue of Jesus Christ",
    type: "Monument/Statue",
    bestTime: "Apr-June / Sept-Nov",
    budget: { min: 60, max: 180, currency: "USD" },
    rating: 4.7,
    annualVisitors: 2.2,
    entryFee: 12,
    avgVisitDuration: 1.5,
    tourismRevenue: 35,
    yearBuilt: "1931",
    isUNESCO: false,
    interests: ["adventure", "photography", "culture", "nature"],
    weather: { temp: 26, condition: "Partly Cloudy" },
    latitude: -22.9519,
    longitude: -43.2105,
  },
  {
    id: "18",
    name: "Acropolis",
    country: "Greece",
    city: "Athens",
    region: "Southern Europe",
    image: "https://images.unsplash.com/photo-1555993539-1732b0258235?w=800&q=80",
    description: "Ancient citadel, Parthenon temple",
    famousFor: "Ancient citadel, Parthenon temple",
    type: "Archaeological Site",
    bestTime: "Apr-May / Sept-Oct",
    budget: { min: 80, max: 200, currency: "USD" },
    rating: 4.8,
    annualVisitors: 4,
    entryFee: 13,
    avgVisitDuration: 3,
    tourismRevenue: 60,
    yearBuilt: "447 BC",
    isUNESCO: true,
    interests: ["history", "culture", "art", "photography"],
    weather: { temp: 22, condition: "Sunny" },
    latitude: 37.9715,
    longitude: 23.7267,
  },
  {
    id: "19",
    name: "Forbidden City",
    country: "China",
    city: "Beijing",
    region: "East Asia",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/The_Forbidden_City_-_View_from_Coal_Hill.jpg/330px-The_Forbidden_City_-_View_from_Coal_Hill.jpg",
    description: "Imperial palace of Ming and Qing dynasties",
    famousFor: "Imperial palace of Ming and Qing dynasties",
    type: "Historic Palace",
    bestTime: "Apr-May / Sept-Oct",
    budget: { min: 50, max: 150, currency: "USD" },
    rating: 4.7,
    annualVisitors: 9,
    entryFee: 8,
    avgVisitDuration: 3,
    tourismRevenue: 75,
    yearBuilt: "1420",
    isUNESCO: true,
    interests: ["history", "culture", "art"],
    weather: { temp: 18, condition: "Clear" },
    latitude: 39.9163,
    longitude: 116.3972,
  },
  {
    id: "20",
    name: "Central Park",
    country: "United States",
    city: "New York City",
    region: "North America",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Global_Citizen_Festival_Central_Park_New_York_City_from_NYonAir_%2815351915006%29.jpg/330px-Global_Citizen_Festival_Central_Park_New_York_City_from_NYonAir_%2815351915006%29.jpg",
    description: "Urban park oasis in Manhattan",
    famousFor: "Urban park oasis in Manhattan",
    type: "Park",
    bestTime: "May-Sept",
    budget: { min: 150, max: 350, currency: "USD" },
    rating: 4.7,
    annualVisitors: 42,
    entryFee: 0,
    avgVisitDuration: 3,
    tourismRevenue: 35,
    yearBuilt: "1857",
    isUNESCO: false,
    interests: ["nature", "photography", "wellness"],
    weather: { temp: 18, condition: "Partly Cloudy" },
    latitude: 40.7829,
    longitude: -73.9654,
  },
]

// ============================================================
// DATASET 2: TRIPADVISOR REVIEWS (Kaggle)
// Module: User Profiling & Personalization
// Columns: User ID, Category 1-10
//   Category mapping (inferred from travel context):
//   1-Art Galleries, 2-Dance Clubs, 3-Juice Bars/Health,
//   4-Restaurants, 5-Museums, 6-Resorts, 7-Parks/Outdoors,
//   8-Beaches, 9-Theaters, 10-Religious Sites
// Usage: Build user preference profiles, personalize recommendations
// ============================================================

export interface UserProfile {
  userId: string
  preferences: {
    artGalleries: number
    danceClubs: number
    healthWellness: number
    restaurants: number
    museums: number
    resorts: number
    parksOutdoors: number
    beaches: number
    theaters: number
    religiousSites: number
  }
  topInterests: string[]
  travelStyle: string
  budgetRange: string
}

// Category names mapped from TripAdvisor review categories
export const categoryNames = [
  "Art Galleries",
  "Dance Clubs",
  "Health & Wellness",
  "Restaurants",
  "Museums",
  "Resorts",
  "Parks & Outdoors",
  "Beaches",
  "Theaters",
  "Religious Sites",
]

// Sample user profiles derived from tripadvisor_review.csv
// Scores are original ratings from dataset
// topInterests computed by ranking the top 3 category scores
// travelStyle inferred from dominant category clusters
export const userProfiles: UserProfile[] = [
  {
    userId: "User 1",
    preferences: { artGalleries: 0.93, danceClubs: 1.8, healthWellness: 2.29, restaurants: 0.62, museums: 0.8, resorts: 2.42, parksOutdoors: 3.19, beaches: 2.79, theaters: 1.82, religiousSites: 2.42 },
    topInterests: ["Parks & Outdoors", "Beaches", "Resorts"],
    travelStyle: "Nature & Relaxation",
    budgetRange: "mid",
  },
  {
    userId: "User 2",
    preferences: { artGalleries: 1.02, danceClubs: 2.2, healthWellness: 2.66, restaurants: 0.64, museums: 1.42, resorts: 3.18, parksOutdoors: 3.21, beaches: 2.63, theaters: 1.86, religiousSites: 2.32 },
    topInterests: ["Parks & Outdoors", "Resorts", "Health & Wellness"],
    travelStyle: "Nature & Relaxation",
    budgetRange: "mid",
  },
  {
    userId: "User 3",
    preferences: { artGalleries: 1.22, danceClubs: 0.8, healthWellness: 0.54, restaurants: 0.53, museums: 0.24, resorts: 1.54, parksOutdoors: 3.18, beaches: 2.8, theaters: 1.31, religiousSites: 2.5 },
    topInterests: ["Parks & Outdoors", "Beaches", "Religious Sites"],
    travelStyle: "Culture Explorer",
    budgetRange: "budget",
  },
  {
    userId: "User 4",
    preferences: { artGalleries: 0.45, danceClubs: 1.8, healthWellness: 0.29, restaurants: 0.57, museums: 0.46, resorts: 1.52, parksOutdoors: 3.18, beaches: 2.96, theaters: 1.57, religiousSites: 2.86 },
    topInterests: ["Parks & Outdoors", "Beaches", "Religious Sites"],
    travelStyle: "Culture Explorer",
    budgetRange: "budget",
  },
  {
    userId: "User 5",
    preferences: { artGalleries: 0.51, danceClubs: 1.2, healthWellness: 1.18, restaurants: 0.57, museums: 1.54, resorts: 2.02, parksOutdoors: 3.18, beaches: 2.78, theaters: 1.18, religiousSites: 2.54 },
    topInterests: ["Parks & Outdoors", "Beaches", "Religious Sites"],
    travelStyle: "Nature & Relaxation",
    budgetRange: "mid",
  },
  {
    userId: "User 10",
    preferences: { artGalleries: 0.7, danceClubs: 1.36, healthWellness: 0.22, restaurants: 0.26, museums: 1.5, resorts: 1.54, parksOutdoors: 3.17, beaches: 2.82, theaters: 2.24, religiousSites: 3.12 },
    topInterests: ["Parks & Outdoors", "Religious Sites", "Beaches"],
    travelStyle: "Culture Explorer",
    budgetRange: "budget",
  },
  {
    userId: "User 30",
    preferences: { artGalleries: 0.64, danceClubs: 1.16, healthWellness: 3.12, restaurants: 0.45, museums: 1.84, resorts: 3.16, parksOutdoors: 3.2, beaches: 2.75, theaters: 1.54, religiousSites: 2.46 },
    topInterests: ["Parks & Outdoors", "Resorts", "Health & Wellness"],
    travelStyle: "Luxury & Wellness",
    budgetRange: "luxury",
  },
  {
    userId: "User 61",
    preferences: { artGalleries: 1.06, danceClubs: 1.92, healthWellness: 3.11, restaurants: 0.55, museums: 1.46, resorts: 3.24, parksOutdoors: 3.2, beaches: 2.62, theaters: 1.28, religiousSites: 2.34 },
    topInterests: ["Resorts", "Parks & Outdoors", "Health & Wellness"],
    travelStyle: "Luxury & Wellness",
    budgetRange: "luxury",
  },
  {
    userId: "User 100",
    preferences: { artGalleries: 0.67, danceClubs: 1.6, healthWellness: 0.21, restaurants: 0.47, museums: 2.16, resorts: 1.96, parksOutdoors: 3.17, beaches: 2.86, theaters: 3.04, religiousSites: 3.1 },
    topInterests: ["Parks & Outdoors", "Religious Sites", "Theaters"],
    travelStyle: "Culture Explorer",
    budgetRange: "mid",
  },
  {
    userId: "User 248",
    preferences: { artGalleries: 1.5, danceClubs: 1.96, healthWellness: 2.08, restaurants: 2.73, museums: 1.12, resorts: 2.94, parksOutdoors: 3.2, beaches: 2.63, theaters: 1.63, religiousSites: 2.46 },
    topInterests: ["Parks & Outdoors", "Resorts", "Restaurants"],
    travelStyle: "Food & Leisure",
    budgetRange: "luxury",
  },
]

// ============================================================
// DATASET 3: HOTEL RECOMMENDATIONS
// Module: Hotel/Booking Recommendation
// Derived from regional data of world_famous_places +
// typical hotel data patterns for each destination
// Usage: Filter by destination & budget, rank by rating + reviews
// ============================================================

export interface HotelData {
  id: string
  name: string
  destination: string
  city: string
  image: string
  rating: number
  reviews: number
  price: number
  amenities: string[]
  hotelType: string
  latitude: number
  longitude: number
}

export const hotels: HotelData[] = [
  {
    id: "h1",
    name: "The Ritz Paris",
    destination: "Eiffel Tower",
    city: "Paris",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
    rating: 4.9,
    reviews: 2847,
    price: 850,
    amenities: ["Spa", "Pool", "Restaurant", "WiFi", "Gym"],
    hotelType: "Luxury",
    latitude: 48.8682,
    longitude: 2.3289,
  },
  {
    id: "h2",
    name: "Hotel Le Marais",
    destination: "Louvre Museum",
    city: "Paris",
    image: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80",
    rating: 4.5,
    reviews: 1243,
    price: 220,
    amenities: ["WiFi", "Restaurant", "Bar"],
    hotelType: "Boutique",
    latitude: 48.8566,
    longitude: 2.3522,
  },
  {
    id: "h3",
    name: "The Plaza Hotel",
    destination: "Times Square",
    city: "New York City",
    image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800&q=80",
    rating: 4.7,
    reviews: 4521,
    price: 750,
    amenities: ["Spa", "Restaurant", "WiFi", "Gym", "Concierge"],
    hotelType: "Luxury",
    latitude: 40.7645,
    longitude: -73.9742,
  },
  {
    id: "h4",
    name: "Beijing Courtyard Hotel",
    destination: "Great Wall of China",
    city: "Beijing",
    image: "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&q=80",
    rating: 4.4,
    reviews: 892,
    price: 95,
    amenities: ["WiFi", "Restaurant", "Garden", "Tour Desk"],
    hotelType: "Traditional",
    latitude: 39.9042,
    longitude: 116.4074,
  },
  {
    id: "h5",
    name: "Taj Hotel Agra",
    destination: "Taj Mahal",
    city: "Agra",
    image: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80",
    rating: 4.6,
    reviews: 1567,
    price: 120,
    amenities: ["Pool", "Spa", "Restaurant", "WiFi", "Garden"],
    hotelType: "Heritage",
    latitude: 27.18,
    longitude: 78.03,
  },
  {
    id: "h6",
    name: "Hotel Colosseo Roma",
    destination: "Colosseum",
    city: "Rome",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
    rating: 4.5,
    reviews: 2103,
    price: 280,
    amenities: ["WiFi", "Restaurant", "Bar", "Rooftop"],
    hotelType: "Boutique",
    latitude: 41.8919,
    longitude: 12.4866,
  },
  {
    id: "h7",
    name: "Siem Reap Resort",
    destination: "Angkor Wat",
    city: "Siem Reap",
    image: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80",
    rating: 4.6,
    reviews: 987,
    price: 75,
    amenities: ["Pool", "Spa", "Restaurant", "WiFi", "Bicycle Rental"],
    hotelType: "Resort",
    latitude: 13.3633,
    longitude: 103.8564,
  },
  {
    id: "h8",
    name: "Burj Al Arab",
    destination: "Burj Khalifa",
    city: "Dubai",
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80",
    rating: 4.9,
    reviews: 3456,
    price: 1200,
    amenities: ["Spa", "Pool", "Beach", "Restaurant", "WiFi", "Butler"],
    hotelType: "Ultra Luxury",
    latitude: 25.1412,
    longitude: 55.1852,
  },
  {
    id: "h9",
    name: "Hotel 31",
    destination: "Times Square",
    city: "New York City",
    image: "https://images.unsplash.com/photo-1598605272254-173a2bce9ef2?w=800&q=80",
    rating: 4.2,
    reviews: 856,
    price: 145,
    amenities: ["WiFi", "Bar", "Central Location"],
    hotelType: "Boutique",
    latitude: 40.7445,
    longitude: -73.9812,
  },
  {
    id: "h10",
    name: "The Jane Gateway",
    destination: "Statue of Liberty",
    city: "New York City",
    image: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800&q=80",
    rating: 4.0,
    reviews: 1102,
    price: 98,
    amenities: ["WiFi", "Bicycle Rental", "Bar"],
    hotelType: "Standard",
    latitude: 40.7382,
    longitude: -74.0094,
  },
]

// ============================================================
// DATASET 4: BUDGET ESTIMATION
// Module: Budget Planner
// Derived from world_famous_places entry_fee + regional cost estimates
// Usage: Calculate total trip cost per destination
// ============================================================

export interface BudgetEstimate {
  destination: string
  city: string
  country: string
  region: string
  avgFlightCost: number
  hotelPricePerNight: number
  foodCostPerDay: number
  localTransportCost: number
  activityCostAvg: number
  entryFee: number
}

export const budgetEstimates: BudgetEstimate[] = [
  { destination: "Eiffel Tower", city: "Paris", country: "France", region: "Western Europe", avgFlightCost: 650, hotelPricePerNight: 220, foodCostPerDay: 65, localTransportCost: 15, activityCostAvg: 45, entryFee: 35 },
  { destination: "Times Square", city: "New York City", country: "United States", region: "North America", avgFlightCost: 350, hotelPricePerNight: 280, foodCostPerDay: 75, localTransportCost: 20, activityCostAvg: 50, entryFee: 0 },
  { destination: "Great Wall of China", city: "Beijing", country: "China", region: "East Asia", avgFlightCost: 800, hotelPricePerNight: 95, foodCostPerDay: 25, localTransportCost: 10, activityCostAvg: 20, entryFee: 10 },
  { destination: "Taj Mahal", city: "Agra", country: "India", region: "South Asia", avgFlightCost: 700, hotelPricePerNight: 80, foodCostPerDay: 15, localTransportCost: 8, activityCostAvg: 15, entryFee: 15 },
  { destination: "Colosseum", city: "Rome", country: "Italy", region: "Southern Europe", avgFlightCost: 600, hotelPricePerNight: 180, foodCostPerDay: 55, localTransportCost: 12, activityCostAvg: 35, entryFee: 18 },
  { destination: "Machu Picchu", city: "Cusco Region", country: "Peru", region: "South America", avgFlightCost: 900, hotelPricePerNight: 100, foodCostPerDay: 25, localTransportCost: 15, activityCostAvg: 40, entryFee: 70 },
  { destination: "Angkor Wat", city: "Siem Reap", country: "Cambodia", region: "Southeast Asia", avgFlightCost: 750, hotelPricePerNight: 60, foodCostPerDay: 15, localTransportCost: 8, activityCostAvg: 20, entryFee: 37 },
  { destination: "Burj Khalifa", city: "Dubai", country: "UAE", region: "Middle East", avgFlightCost: 700, hotelPricePerNight: 300, foodCostPerDay: 60, localTransportCost: 25, activityCostAvg: 50, entryFee: 45 },
  { destination: "Sagrada Familia", city: "Barcelona", country: "Spain", region: "Southern Europe", avgFlightCost: 550, hotelPricePerNight: 160, foodCostPerDay: 45, localTransportCost: 10, activityCostAvg: 30, entryFee: 26 },
  { destination: "Grand Canyon", city: "Arizona", country: "United States", region: "North America", avgFlightCost: 400, hotelPricePerNight: 150, foodCostPerDay: 50, localTransportCost: 30, activityCostAvg: 40, entryFee: 35 },
  { destination: "Acropolis", city: "Athens", country: "Greece", region: "Southern Europe", avgFlightCost: 580, hotelPricePerNight: 120, foodCostPerDay: 40, localTransportCost: 10, activityCostAvg: 25, entryFee: 13 },
  { destination: "Christ the Redeemer", city: "Rio de Janeiro", country: "Brazil", region: "South America", avgFlightCost: 850, hotelPricePerNight: 110, foodCostPerDay: 30, localTransportCost: 12, activityCostAvg: 25, entryFee: 12 },
  { destination: "Buckingham Palace", city: "London", country: "UK", region: "Western Europe", avgFlightCost: 600, hotelPricePerNight: 250, foodCostPerDay: 60, localTransportCost: 18, activityCostAvg: 40, entryFee: 0 },
  { destination: "Sydney Opera House", city: "Sydney", country: "Australia", region: "Oceania", avgFlightCost: 1100, hotelPricePerNight: 200, foodCostPerDay: 55, localTransportCost: 20, activityCostAvg: 45, entryFee: 49 },
]

// ============================================================
// DATASET 5: WEATHER & BEST TIME TO TRAVEL
// Module: Weather Page
// Derived from regional climate patterns for each destination
// Usage: Monthly averages, best travel months, travel advice
// ============================================================

export interface WeatherEntry {
  location: string
  month: string
  avgTemperature: number
  rainfall: number
  humidity: number
  weatherCondition: string
}

// Paris monthly weather (representative for Western Europe destinations)
export const parisWeather: WeatherEntry[] = [
  { location: "Paris", month: "Jan", avgTemperature: 5, rainfall: 50, humidity: 85, weatherCondition: "Cold & Cloudy" },
  { location: "Paris", month: "Feb", avgTemperature: 6, rainfall: 45, humidity: 80, weatherCondition: "Cold & Cloudy" },
  { location: "Paris", month: "Mar", avgTemperature: 10, rainfall: 40, humidity: 75, weatherCondition: "Cool & Damp" },
  { location: "Paris", month: "Apr", avgTemperature: 13, rainfall: 35, humidity: 68, weatherCondition: "Mild & Pleasant" },
  { location: "Paris", month: "May", avgTemperature: 17, rainfall: 30, humidity: 65, weatherCondition: "Warm & Sunny" },
  { location: "Paris", month: "Jun", avgTemperature: 20, rainfall: 25, humidity: 62, weatherCondition: "Warm & Sunny" },
  { location: "Paris", month: "Jul", avgTemperature: 23, rainfall: 20, humidity: 60, weatherCondition: "Hot & Sunny" },
  { location: "Paris", month: "Aug", avgTemperature: 23, rainfall: 22, humidity: 62, weatherCondition: "Hot & Sunny" },
  { location: "Paris", month: "Sep", avgTemperature: 19, rainfall: 35, humidity: 68, weatherCondition: "Warm & Pleasant" },
  { location: "Paris", month: "Oct", avgTemperature: 14, rainfall: 45, humidity: 75, weatherCondition: "Cool & Damp" },
  { location: "Paris", month: "Nov", avgTemperature: 9, rainfall: 50, humidity: 82, weatherCondition: "Cold & Rainy" },
  { location: "Paris", month: "Dec", avgTemperature: 6, rainfall: 55, humidity: 87, weatherCondition: "Cold & Rainy" },
]

// Multi-destination weather lookup map
export const destinationWeather: Record<string, WeatherEntry[]> = {
  Paris: parisWeather,
  "New York City": [
    { location: "New York City", month: "Jan", avgTemperature: 1, rainfall: 80, humidity: 60, weatherCondition: "Cold & Snowy" },
    { location: "New York City", month: "Feb", avgTemperature: 2, rainfall: 70, humidity: 58, weatherCondition: "Cold & Snowy" },
    { location: "New York City", month: "Mar", avgTemperature: 7, rainfall: 85, humidity: 55, weatherCondition: "Cool" },
    { location: "New York City", month: "Apr", avgTemperature: 13, rainfall: 90, humidity: 53, weatherCondition: "Mild" },
    { location: "New York City", month: "May", avgTemperature: 19, rainfall: 95, humidity: 55, weatherCondition: "Warm" },
    { location: "New York City", month: "Jun", avgTemperature: 24, rainfall: 95, humidity: 60, weatherCondition: "Hot" },
    { location: "New York City", month: "Jul", avgTemperature: 27, rainfall: 100, humidity: 65, weatherCondition: "Hot & Humid" },
    { location: "New York City", month: "Aug", avgTemperature: 26, rainfall: 100, humidity: 65, weatherCondition: "Hot & Humid" },
    { location: "New York City", month: "Sep", avgTemperature: 22, rainfall: 85, humidity: 60, weatherCondition: "Warm" },
    { location: "New York City", month: "Oct", avgTemperature: 16, rainfall: 80, humidity: 58, weatherCondition: "Cool" },
    { location: "New York City", month: "Nov", avgTemperature: 10, rainfall: 75, humidity: 60, weatherCondition: "Cool" },
    { location: "New York City", month: "Dec", avgTemperature: 4, rainfall: 80, humidity: 62, weatherCondition: "Cold & Snowy" },
  ],
  Beijing: [
    { location: "Beijing", month: "Jan", avgTemperature: -3, rainfall: 3, humidity: 45, weatherCondition: "Cold & Dry" },
    { location: "Beijing", month: "Feb", avgTemperature: 0, rainfall: 5, humidity: 40, weatherCondition: "Cold & Dry" },
    { location: "Beijing", month: "Mar", avgTemperature: 7, rainfall: 8, humidity: 38, weatherCondition: "Cool & Windy" },
    { location: "Beijing", month: "Apr", avgTemperature: 15, rainfall: 20, humidity: 42, weatherCondition: "Warm & Pleasant" },
    { location: "Beijing", month: "May", avgTemperature: 22, rainfall: 35, humidity: 48, weatherCondition: "Warm & Pleasant" },
    { location: "Beijing", month: "Jun", avgTemperature: 27, rainfall: 70, humidity: 58, weatherCondition: "Hot & Humid" },
    { location: "Beijing", month: "Jul", avgTemperature: 28, rainfall: 180, humidity: 75, weatherCondition: "Hot & Rainy" },
    { location: "Beijing", month: "Aug", avgTemperature: 27, rainfall: 160, humidity: 78, weatherCondition: "Hot & Rainy" },
    { location: "Beijing", month: "Sep", avgTemperature: 22, rainfall: 50, humidity: 60, weatherCondition: "Warm & Pleasant" },
    { location: "Beijing", month: "Oct", avgTemperature: 14, rainfall: 20, humidity: 50, weatherCondition: "Cool & Pleasant" },
    { location: "Beijing", month: "Nov", avgTemperature: 5, rainfall: 10, humidity: 48, weatherCondition: "Cold" },
    { location: "Beijing", month: "Dec", avgTemperature: -1, rainfall: 3, humidity: 45, weatherCondition: "Cold & Dry" },
  ],
  Dubai: [
    { location: "Dubai", month: "Jan", avgTemperature: 20, rainfall: 10, humidity: 65, weatherCondition: "Warm & Pleasant" },
    { location: "Dubai", month: "Feb", avgTemperature: 21, rainfall: 25, humidity: 63, weatherCondition: "Warm & Pleasant" },
    { location: "Dubai", month: "Mar", avgTemperature: 24, rainfall: 20, humidity: 60, weatherCondition: "Warm" },
    { location: "Dubai", month: "Apr", avgTemperature: 29, rainfall: 5, humidity: 52, weatherCondition: "Hot" },
    { location: "Dubai", month: "May", avgTemperature: 34, rainfall: 1, humidity: 48, weatherCondition: "Very Hot" },
    { location: "Dubai", month: "Jun", avgTemperature: 37, rainfall: 0, humidity: 50, weatherCondition: "Extreme Heat" },
    { location: "Dubai", month: "Jul", avgTemperature: 40, rainfall: 0, humidity: 55, weatherCondition: "Extreme Heat" },
    { location: "Dubai", month: "Aug", avgTemperature: 40, rainfall: 0, humidity: 58, weatherCondition: "Extreme Heat" },
    { location: "Dubai", month: "Sep", avgTemperature: 36, rainfall: 0, humidity: 55, weatherCondition: "Very Hot" },
    { location: "Dubai", month: "Oct", avgTemperature: 31, rainfall: 2, humidity: 55, weatherCondition: "Hot" },
    { location: "Dubai", month: "Nov", avgTemperature: 26, rainfall: 5, humidity: 58, weatherCondition: "Warm & Pleasant" },
    { location: "Dubai", month: "Dec", avgTemperature: 22, rainfall: 10, humidity: 62, weatherCondition: "Warm & Pleasant" },
  ],
  Rome: [
    { location: "Rome", month: "Jan", avgTemperature: 8, rainfall: 65, humidity: 75, weatherCondition: "Cool & Rainy" },
    { location: "Rome", month: "Feb", avgTemperature: 9, rainfall: 60, humidity: 72, weatherCondition: "Cool" },
    { location: "Rome", month: "Mar", avgTemperature: 12, rainfall: 55, humidity: 68, weatherCondition: "Mild" },
    { location: "Rome", month: "Apr", avgTemperature: 15, rainfall: 50, humidity: 65, weatherCondition: "Mild & Pleasant" },
    { location: "Rome", month: "May", avgTemperature: 20, rainfall: 35, humidity: 58, weatherCondition: "Warm & Sunny" },
    { location: "Rome", month: "Jun", avgTemperature: 25, rainfall: 20, humidity: 52, weatherCondition: "Hot & Sunny" },
    { location: "Rome", month: "Jul", avgTemperature: 28, rainfall: 10, humidity: 48, weatherCondition: "Hot & Dry" },
    { location: "Rome", month: "Aug", avgTemperature: 28, rainfall: 15, humidity: 50, weatherCondition: "Hot & Dry" },
    { location: "Rome", month: "Sep", avgTemperature: 24, rainfall: 40, humidity: 58, weatherCondition: "Warm & Pleasant" },
    { location: "Rome", month: "Oct", avgTemperature: 19, rainfall: 60, humidity: 68, weatherCondition: "Mild" },
    { location: "Rome", month: "Nov", avgTemperature: 13, rainfall: 75, humidity: 75, weatherCondition: "Cool & Rainy" },
    { location: "Rome", month: "Dec", avgTemperature: 9, rainfall: 70, humidity: 78, weatherCondition: "Cool & Rainy" },
  ],
}

// ============================================================
// DATASET 6: NLP CHATBOT INTENTS
// Module: AI Chatbot
// Usage: Map user queries to intents, extract entities, generate replies
// ============================================================

export interface ChatIntent {
  intent: string
  patterns: string[]
  entities: string[]
  responseTemplate: string
}

export const chatIntents: ChatIntent[] = [
  {
    intent: "destination_search",
    patterns: ["where should I go", "recommend", "suggest destination", "best place", "where to travel"],
    entities: ["destination", "budget", "interest"],
    responseTemplate: "Based on your preferences, I recommend visiting {destination}. It's known for {famousFor} and is best visited during {bestTime}.",
  },
  {
    intent: "budget_inquiry",
    patterns: ["how much", "budget", "cost", "afford", "cheap", "expensive", "price"],
    entities: ["destination", "budget_range", "duration"],
    responseTemplate: "A trip to {destination} typically costs {dailyCost} per day including accommodation, food, and activities. For {duration} days, your estimated total is {totalCost}.",
  },
  {
    intent: "weather_check",
    patterns: ["weather", "temperature", "rain", "climate", "best time", "when to visit"],
    entities: ["destination", "month"],
    responseTemplate: "The weather in {destination} during {month} averages {temp}Â°C with {condition} conditions. {travelAdvice}",
  },
  {
    intent: "hotel_search",
    patterns: ["hotel", "stay", "accommodation", "where to sleep", "book room", "resort"],
    entities: ["destination", "budget", "amenities"],
    responseTemplate: "I found {count} hotels near {destination}. The top-rated option is {hotelName} with a rating of {rating}/5 at {price}/night.",
  },
  {
    intent: "itinerary_request",
    patterns: ["itinerary", "plan", "schedule", "what to do", "activities", "day plan"],
    entities: ["destination", "duration", "interests"],
    responseTemplate: "Here's a {duration}-day itinerary for {destination} tailored to your interests in {interests}.",
  },
  {
    intent: "greeting",
    patterns: ["hello", "hi", "hey", "good morning", "good evening"],
    entities: [],
    responseTemplate: "Hello! I'm your AI travel assistant. I can help you discover destinations, plan itineraries, check weather, and estimate budgets. What would you like to explore?",
  },
]

// ============================================================
// MODULE HELPER: Budget category breakdown
// Used by Budget Planner page
// ============================================================

export const budgetCategories = [
  { name: "Accommodation", amount: 1200, percentage: 35, color: "hsl(var(--chart-1))" },
  { name: "Transportation", amount: 650, percentage: 19, color: "hsl(var(--chart-2))" },
  { name: "Food & Dining", amount: 500, percentage: 15, color: "hsl(var(--chart-3))" },
  { name: "Activities", amount: 400, percentage: 12, color: "hsl(var(--chart-4))" },
  { name: "Shopping", amount: 350, percentage: 10, color: "hsl(var(--chart-5))" },
  { name: "Miscellaneous", amount: 300, percentage: 9, color: "hsl(var(--muted-foreground))" },
]

// ============================================================
// MODULE HELPER: Itinerary sample
// ============================================================

export const sampleItinerary = [
  {
    day: 1,
    title: "Arrival & Eiffel Tower",
    activities: [
      { id: "a1", time: "14:00", title: "Hotel Check-in", duration: "1h", cost: 0, location: "The Ritz Paris", type: "accommodation" },
      { id: "a2", time: "16:00", title: "Eiffel Tower Visit", duration: "2.5h", cost: 35, location: "Champ de Mars", type: "sightseeing" },
      { id: "a3", time: "19:30", title: "Dinner at Le Jules Verne", duration: "2h", cost: 120, location: "Eiffel Tower", type: "food" },
    ],
  },
  {
    day: 2,
    title: "Art & Culture Day",
    activities: [
      { id: "a4", time: "09:00", title: "Louvre Museum", duration: "4h", cost: 22, location: "Rue de Rivoli", type: "culture" },
      { id: "a5", time: "13:30", title: "Lunch at Cafe Marly", duration: "1.5h", cost: 45, location: "Louvre Courtyard", type: "food" },
      { id: "a6", time: "15:30", title: "Notre-Dame & Ile de la Cite", duration: "2h", cost: 0, location: "Ile de la Cite", type: "sightseeing" },
      { id: "a7", time: "19:00", title: "Seine River Cruise", duration: "1.5h", cost: 18, location: "Pont de l'Alma", type: "tour" },
    ],
  },
  {
    day: 3,
    title: "Versailles Excursion",
    activities: [
      { id: "a8", time: "08:30", title: "Train to Versailles", duration: "1h", cost: 8, location: "Gare Montparnasse", type: "transport" },
      { id: "a9", time: "10:00", title: "Palace of Versailles", duration: "4h", cost: 21, location: "Versailles", type: "sightseeing" },
      { id: "a10", time: "14:30", title: "Gardens & Marie Antoinette Estate", duration: "2h", cost: 0, location: "Versailles Gardens", type: "nature" },
      { id: "a11", time: "18:00", title: "Return & Farewell Dinner", duration: "2.5h", cost: 95, location: "Le Comptoir", type: "food" },
    ],
  },
]

// ============================================================
// Interest tags and chat suggestions
// ============================================================

export const interestTags = [
  "Beach",
  "Culture",
  "Adventure",
  "Food",
  "Nature",
  "Romance",
  "Shopping",
  "History",
  "Nightlife",
  "Wellness",
  "Art",
  "Photography",
  "Luxury",
]

export const chatSuggestions = [
  "Recommend a UNESCO World Heritage site",
  "Find budget-friendly destinations in Asia",
  "What's the best time to visit the Colosseum?",
  "Plan a 3-day Paris itinerary",
  "Compare hotel prices in Dubai vs Rome",
  "Adventure trips under $1500",
]

// ============================================================
// LEGACY COMPAT: weatherData for chart displays
// ============================================================

export const weatherData = parisWeather.map((w) => ({
  month: w.month,
  temp: w.avgTemperature,
  rainfall: w.rainfall,
  icon: w.avgTemperature > 20 ? "sun" : w.rainfall > 45 ? "cloud" : "cloud-sun",
}))

// ============================================================
// LEGACY COMPAT: flights data
// ============================================================

export const flights = [
  { id: "f1", airline: "Air France", from: "JFK", to: "CDG", departure: "08:30", arrival: "21:45", duration: "7h 15m", price: 650, class: "Economy" },
  { id: "f2", airline: "Delta", from: "JFK", to: "CDG", departure: "19:00", arrival: "08:30", duration: "7h 30m", price: 580, class: "Economy" },
  { id: "f3", airline: "United", from: "JFK", to: "CDG", departure: "22:00", arrival: "11:15", duration: "7h 15m", price: 720, class: "Economy" },
  { id: "f4", airline: "Emirates", from: "JFK", to: "DXB", departure: "23:00", arrival: "19:30", duration: "12h 30m", price: 890, class: "Economy" },
  { id: "f5", airline: "British Airways", from: "JFK", to: "LHR", departure: "20:00", arrival: "08:15", duration: "6h 15m", price: 620, class: "Economy" },
  { id: "f6", airline: "Virgin Atlantic", from: "LHR", to: "JFK", departure: "10:30", arrival: "13:45", duration: "8h 15m", price: 590, class: "Economy" },
  { id: "f7", airline: "Air France", from: "CDG", to: "JFK", departure: "14:00", arrival: "16:30", duration: "8h 30m", price: 610, class: "Economy" },
]


